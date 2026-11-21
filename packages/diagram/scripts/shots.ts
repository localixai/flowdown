/**
 * `bun scripts/shots.ts [--engines chromium,webkit,firefox] [--tag name]`: every kind of the
 * corpus drawn as SVG, on a light page and on a dark one (the SVG takes the page's colours),
 * screenshotted in each engine into `shots/<tag>-<engine>-<theme>.png`. The CI job `shots` runs it
 * on macOS, Windows and Linux. Also writes the pages themselves, `shots/light.html` and
 * `shots/dark.html`, to open in any browser.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORPUS } from './corpus'
import { toSVG } from '../src/index'

const out = join(import.meta.dir, '..', 'shots')
mkdirSync(out, { recursive: true })
const themes = { light: 'background:#fff;color:#1c2024', dark: 'background:#111113;color:#edeef0' }
for (const [theme, colours] of Object.entries(themes)) {
  const sections = CORPUS.map(
    ([name, source]) =>
      `<section><h3>${name}</h3>${toSVG(source, { title: name }) ?? '<p>(not drawn)</p>'}</section>`,
  )
  writeFileSync(
    join(out, `${theme}.html`),
    `<!doctype html><meta charset="utf-8"><title>@localix-ai/diagram, ${theme}</title><style>
body{margin:0;padding:20px;${colours};font:14px system-ui,sans-serif}
main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 36px}
h3{margin:0 0 8px;font:600 12px system-ui;opacity:.55;text-transform:uppercase;letter-spacing:.04em}
svg{max-width:100%;height:auto}
</style><main>${sections.join('')}</main>`,
  )
}

const argument = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback
}
const engines = argument('engines', 'chromium').split(',')
const tag = argument('tag', process.platform)
const { chromium, firefox, webkit } = await import('playwright-core')
const launchers = { chromium, firefox, webkit } as const
const server = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const file = Bun.file(join(out, new URL(request.url).pathname))
    return (await file.exists()) ? new Response(file) : new Response('', { status: 404 })
  },
})
for (const engine of engines) {
  const launcher = launchers[engine as keyof typeof launchers]
  const executablePath = engine === 'chromium' ? process.env.CHROMIUM_PATH : undefined
  const browser = await launcher.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  for (const theme of Object.keys(themes)) {
    await page.goto(`http://localhost:${server.port}/${theme}.html`)
    await page.waitForTimeout(150)
    await page.screenshot({ path: join(out, `${tag}-${engine}-${theme}.png`), fullPage: true })
    console.log(`shots/${tag}-${engine}-${theme}.png`)
  }
  await browser.close()
}
await server.stop()
