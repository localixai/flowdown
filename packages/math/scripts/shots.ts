/**
 * `bun scripts/shots.ts [--engines chromium,webkit,firefox] [--tag name]`: the corpus drawn by
 * this package beside KaTeX, screenshotted in each engine into `shots/<tag>-<engine>.png`. The CI
 * job `math-shots` runs it on macOS, Windows and Linux, the systems Localix runs on.
 *
 * Also writes `shots/page.html`, the page itself, to open in any browser, and `shots/probe.html`:
 * one construct written several ways, which shows which markup each engine draws right.
 */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import { CORPUS } from './corpus'
import { toMathML } from '../src/index'

const root = join(import.meta.dir, '..')
const out = join(root, 'shots')
mkdirSync(join(out, 'katex'), { recursive: true })
cpSync(join(root, 'node_modules/katex/dist/katex.min.css'), join(out, 'katex/katex.min.css'))
cpSync(join(root, 'node_modules/katex/dist/fonts'), join(out, 'katex/fonts'), { recursive: true })
cpSync(join(root, 'src/styles.css'), join(out, 'styles.css'))
cpSync(join(import.meta.dir, 'probe.html'), join(out, 'probe.html'))
cpSync(join(root, 'fonts/math.woff2'), join(out, 'math.woff2'))
cpSync(join(root, 'fonts/math-letters.woff2'), join(out, 'math-letters.woff2'))

const rows = CORPUS.map(
  ([name, tex, display]) =>
    `<tr><th>${name}</th><td>${katex.renderToString(tex, { displayMode: display, throwOnError: false })}</td><td>${toMathML(tex, { display })}</td></tr>`,
)
writeFileSync(
  join(out, 'page.html'),
  `<!doctype html><meta charset="utf-8"><title>@localix-ai/math beside KaTeX</title>
<link rel="stylesheet" href="katex/katex.min.css"><link rel="stylesheet" href="styles.css">
<style>
body { margin: 16px; font: 16px/1.5 system-ui, sans-serif; background: #fff; color: #111 }
table { border-collapse: collapse } th, td { border: 1px solid #ddd; padding: 6px 14px; text-align: center }
thead th { font-size: 13px; background: #f6f6f6 } tbody th { font-size: 13px; text-align: left; white-space: nowrap }
td { font-size: 18px; min-width: 380px } td math[display='block'], td .katex-display { margin: 0 }
</style>
<table><thead><tr><th></th><th>KaTeX</th><th>@localix-ai/math (MathML)</th></tr></thead><tbody>
${rows.join('\n')}
</tbody></table>`,
)

const argument = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback
}
const engines = argument('engines', 'chromium').split(',')
const tag = argument('tag', process.platform)
const { chromium, firefox, webkit } = await import('playwright-core')
const launchers = { chromium, firefox, webkit } as const
const server = Bun.serve({ port: 0, fetch: async (request) => {
  const file = Bun.file(join(out, new URL(request.url).pathname))
  return (await file.exists()) ? new Response(file) : new Response('', { status: 404 })
} })
for (const engine of engines) {
  const launcher = launchers[engine as keyof typeof launchers]
  const executablePath = engine === 'chromium' ? process.env.CHROMIUM_PATH : undefined
  const browser = await launcher.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 })
  // The corpus beside KaTeX, and the probe: one construct written several ways, to see which way
  // each engine draws right.
  for (const [file, name] of [['page.html', ''], ['probe.html', '-probe']] as const) {
    await page.goto(`http://localhost:${server.port}/${file}`)
    await page.evaluate('document.fonts.ready')
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(out, `${tag}-${engine}${name}.png`), fullPage: true })
    console.log(`shots/${tag}-${engine}${name}.png`)
  }
  await browser.close()
}
await server.stop()
