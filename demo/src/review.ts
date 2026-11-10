/**
 * Every form the renderer draws, in light and dark, for looking at: `bun run review [out-dir]`.
 * The scenes are demo/review/*.md; the pictures go to `out-dir` (default demo/.review).
 */
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { serve } from './serve'

const out = process.argv[2] ?? join(import.meta.dir, '../.review')
const dir = join(import.meta.dir, '../review')
const names = (await readdir(dir)).filter((name) => name.endsWith('.md')).map((n) => n.slice(0, -3))

await mkdir(out, { recursive: true })
const server = serve()
const browser = await chromium.launch()
try {
  for (const theme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width: 760, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: theme,
    })
    for (const name of names) {
      await page.goto(`${server.url.href}?review=${name}&theme=${theme}`)
      await page.waitForSelector('.llx-markdown')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(1200)
      await page.locator('[data-scene]').screenshot({ path: join(out, `${name}-${theme}.png`) })
      console.log(`  ${name}-${theme}.png`)
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.stop(true)
}
