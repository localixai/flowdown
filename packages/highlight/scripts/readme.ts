/**
 * `bun scripts/readme.ts [--chrome=/path/to/chrome]`: the README's pictures, into `docs/assets/`,
 * drawn from this package and its result files, never by hand:
 *
 * - `stream.gif`: an agent's file streaming into a code block, coloured line by line as it comes
 *   (the frames are `createStream`'s lines at each point), on a dark page;
 * - `languages-light.png` and `languages-dark.png`: six of the languages, in the colours of
 *   flowdown's stylesheet (`@localix-ai/flowdown/styles.css`, which colours highlight.js's classes);
 * - `speed.png`: the benchmark (`bench/results/latest.json`), one light card.
 *
 * Needs a Chromium (Playwright's, or `--chrome`), flowdown built (its stylesheet) and ffmpeg.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createStream, highlight } from '../src/index'

const root = join(import.meta.dir, '..')
const out = join(root, 'docs', 'assets')
mkdirSync(out, { recursive: true })
const chrome =
  process.argv.find((arg) => arg.startsWith('--chrome='))?.slice(9) ?? '/usr/bin/google-chrome'
const css = readFileSync(join(root, '..', 'flowdown', 'dist', 'styles.css'), 'utf8')
const agent = (file: string) =>
  readFileSync(join(root, 'test', 'agent', file), 'utf8').replace(/\n$/, '')

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const block = (html: string, language: string, title: string) =>
  `<div class="fd-code"><div class="bar"><span>${title}</span><span>${language}</span></div><pre><code class="language-${language} fd-highlighted">${html}</code></pre></div>`
const page = (theme: 'light' | 'dark', body: string, width: number) => `<!doctype html>
<html data-theme="${theme}"><head><meta charset="utf-8"><style>${css}
body { margin: 0; padding: 24px; width: ${width}px; font: 14px ${FONT}; background: ${theme === 'dark' ? '#0d1117' : '#ffffff'}; color: ${theme === 'dark' ? '#e6edf3' : '#1f2328'}; }
.flowdown .fd-code { border-radius: 10px; overflow: hidden; }
.flowdown .bar { display: flex; justify-content: space-between; padding: 8px 14px; font: 12px ${FONT}; opacity: .7; border-bottom: 1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'}; }
.flowdown pre { margin: 0; padding: 12px 14px; font: 13px/1.55 ${MONO}; white-space: pre; overflow: hidden; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style></head><body><div class="flowdown">${body}</div></body></html>`

const browser = await chromium.launch({ executablePath: chrome })

// The languages.
const SAMPLES: Array<[file: string, language: string, from: number, to: number]> = [
  ['console-session.txt', 'console', 0, 11],
  ['diff-patch.diff', 'diff', 19, 30],
  ['tsx-component.tsx', 'tsx', 9, 20],
  ['python-script.py', 'python', 13, 24],
  ['yaml-workflow.yaml', 'yaml', 11, 22],
  ['rust-cli.rs', 'rust', 31, 42],
]
for (const theme of ['light', 'dark'] as const) {
  const body = `<div class="grid">${SAMPLES.map(([file, language, from, to]) => {
    const code = agent(file).split('\n').slice(from, to).join('\n')
    return block(highlight(code, language)!, language, file.replace(/^[a-z]+-/, ''))
  }).join('')}</div>`
  // Wide enough for a line of 75 characters in each column; shown at the README's 878.
  const tab = await browser.newPage({
    viewport: { width: 1300, height: 800 },
    deviceScaleFactor: 1.5,
  })
  await tab.setContent(page(theme, body, 1180))
  await tab.locator('body').screenshot({ path: join(out, `languages-${theme}.png`) })
  await tab.close()
}

// The stream: the file as it arrives, the last 22 lines in view, a frame every 60 characters.
const file = agent('typescript-module.ts')
const frames = mkdtempSync(join(tmpdir(), 'stream-'))
{
  const tab = await browser.newPage({
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 1.5,
  })
  const stream = createStream('typescript')!
  const done: string[] = []
  let current = ''
  let frame = 0
  let box: { width: number; height: number } | undefined
  const STEP = 60
  for (let at = 0; at < file.length + STEP * 6; at += STEP) {
    const update = stream.write(file.slice(at, at + STEP))
    done.push(...update.done)
    current = update.current
    const lines = [...done, `${current}<span class="caret">▍</span>`].slice(-22)
    while (lines.length < 22) lines.push('')
    await tab.setContent(
      page('dark', block(lines.join('\n'), 'ts', 'queue.ts · streaming'), 878).replace(
        '</style>',
        '.caret { color: #8b949e; }</style>',
      ),
    )
    // Every frame the size of the first, or the animation cannot be made of them.
    box ??= (await tab.locator('body').boundingBox())!
    await tab.screenshot({
      path: join(frames, `${String(frame++).padStart(4, '0')}.png`),
      clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) },
    })
  }
  await tab.close()
}
const ffmpeg = (args: string[]) => {
  const run = Bun.spawnSync(['ffmpeg', '-v', 'error', '-y', ...args], { stderr: 'inherit' })
  if (run.exitCode !== 0) throw new Error(`ffmpeg ${args.join(' ')}`)
}
const palette = join(frames, 'palette.png')
ffmpeg([
  '-framerate',
  '8',
  '-i',
  join(frames, '%04d.png'),
  '-vf',
  'palettegen=max_colors=64',
  palette,
])
ffmpeg([
  '-framerate',
  '8',
  '-i',
  join(frames, '%04d.png'),
  '-i',
  palette,
  '-lavfi',
  'paletteuse=dither=none',
  '-loop',
  '0',
  join(out, 'stream.gif'),
])
rmSync(frames, { recursive: true })

// The benchmark, one light card.
const bench = JSON.parse(readFileSync(join(root, 'bench', 'results', 'latest.json'), 'utf8')) as {
  meta: { cpu: string; cores: number; runtime: string; budgetMs: number }
  whole: Array<{ ours: number; hljs: number | null; shiki: number }>
  streams: Array<{ name: string; ms: number; drawn: number }>
}
const withHljs = bench.whole.filter((row) => row.hljs !== null)
const whole = [
  ['@localix-ai/highlight', withHljs.reduce((sum, row) => sum + row.ours, 0), 100],
  ['highlight.js', withHljs.reduce((sum, row) => sum + row.hljs!, 0), 100],
  ['Shiki', withHljs.reduce((sum, row) => sum + row.shiki, 0), 100],
] as const
const streamed = bench.streams.map((row) => [row.name, row.ms, row.drawn] as const)
const bars = (
  title: string,
  note: string,
  rows: ReadonlyArray<readonly [string, number, number]>,
) => {
  const top = Math.max(...rows.map(([, ms]) => ms))
  return `<section><h2>${title}</h2><p>${note}</p>${rows
    .map(([label, ms, drawn], index) => {
      const value =
        drawn < 100
          ? `stopped at ${drawn}% after ${(ms / 1000).toFixed(0)} s`
          : ms >= 1000
            ? `${(ms / 1000).toFixed(1)} s`
            : `${ms.toFixed(0)} ms`
      return `<div class="row"><span class="label${index === 0 ? ' ours' : ''}">${label}</span><span class="track"><span class="fill${index === 0 ? ' ours' : ''}" style="width:${Math.max(0.6, (ms / top) * 100)}%"></span></span><span class="value${index === 0 ? ' ours' : ''}">${value}</span></div>`
    })
    .join('')}</section>`
}
{
  const tab = await browser.newPage({
    viewport: { width: 1000, height: 600 },
    deviceScaleFactor: 2,
  })
  await tab.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
body { margin: 0; padding: 28px 32px; width: 814px; font: 13px ${FONT}; background: #fff; color: #1c1c1b; }
h2 { font-size: 15px; margin: 0 0 2px; } p { margin: 0 0 12px; color: #5f5f5b; font-size: 12px; }
section + section { margin-top: 26px; }
.row { display: grid; grid-template-columns: 250px 1fr 190px; align-items: center; gap: 12px; margin: 7px 0; }
.track { height: 14px; } .fill { display: block; height: 100%; background: #d6d6d3; border-radius: 3px; }
.fill.ours { background: #6e56cf; } .ours { color: #6e56cf; font-weight: 600; }
.value { color: #5f5f5b; font-variant-numeric: tabular-nums; } .value.ours { color: #6e56cf; }
footer { margin-top: 22px; color: #5f5f5b; font-size: 11.5px; } code { font: 11px ${MONO}; }
</style></head><body>
${bars('A file that streams', '59,597 characters of TypeScript, 8 a token, drawn on every token. Lower is better.', streamed)}
${bars('Whole files', 'About 1 MB in each language both highlighters have, highlighted once. Lower is better.', whole)}
<footer>${bench.meta.cpu}, ${bench.meta.cores} cores, ${bench.meta.runtime}. A stream stops past ${bench.meta.budgetMs / 1000} s. <code>bun run bench</code></footer>
</body></html>`)
  await tab.locator('body').screenshot({ path: join(out, 'speed.png') })
  await tab.close()
}

await browser.close()
console.log(`wrote ${out}`)
