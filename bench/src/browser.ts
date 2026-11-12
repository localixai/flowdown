/**
 * `bun src/browser.ts`: the renderers streaming the same replies in a real browser, Chromium, whose
 * engine is V8 (Chrome, Edge, and Node's). `run.ts` measures under Bun (JavaScriptCore, Safari's
 * engine) on happy-dom, with no layout: the two engines do not cost the same code the same, and
 * this run is where a cost only V8 has shows up.
 *
 * Each renderer is bundled as a page's bundler would (production React, minified) and given the
 * reply's prefixes six per animation frame. Read from the browser's own counters
 * (`Performance.getMetrics`): script time, and the main thread's whole task time, which adds style,
 * layout and paint. flowdown is styled by its stylesheet; the others are drawn as their components
 * leave them, with the browser's defaults.
 *
 * Writes results/browser.json and results/browser.md. Needs Playwright's Chromium
 * (`bunx playwright-core install chromium-headless-shell`).
 *
 * Options: `--only=chat-5k,code-50k`, `--renderers=flowdown,streamdown`, `--runs=3`, `--no-write`.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus, tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import type { PageResult } from './browser-page'

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const runs = Number(flag('runs') ?? 3)
const budgetMs = Number(flag('budget') ?? 30_000)
const perFrame = 6

/** The scenarios of the docs' headline table and the two shapes that cost a renderer most. */
const CASES: Array<[scenario: string, pattern: string]> = (
  [
    ['chat-5k', 'token'],
    ['answer-20k', 'token'],
    ['table-20k', 'token'],
    ['code-50k', 'token'],
    ['long-100k', 'token'],
  ] as Array<[string, string]>
).filter(([scenario]) => !flag('only') || flag('only')!.split(',').includes(scenario))

const NAMES = [
  'flowdown',
  'streamdown',
  'react-markdown',
  'markdown-to-jsx',
  'markstream',
  'marked-react',
].filter((name) => !flag('renderers') || flag('renderers')!.split(',').includes(name))

// ─── The page, bundled ───

const out = mkdtempSync(join(tmpdir(), 'flowdown-browser-bench-'))
const versions: Record<string, string> = {}
const built = await Bun.build({
  entrypoints: [join(import.meta.dir, 'browser-page.tsx')],
  outdir: out,
  target: 'browser',
  minify: true,
  splitting: true,
  // Optional peers a renderer imports only when a reply needs them (markstream's diagrams, math
  // and diffs): not installed here, never asked for by these replies, as in size.ts.
  external: ['@antv/infographic', '@terrastruct/d2', 'katex', 'mermaid', 'stream-diffs'],
  conditions: ['production'],
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      // renderers.tsx reads each package's version with `createRequire`, which a page has not got:
      // the page is handed the versions read here.
      name: 'versions',
      setup(build) {
        build.onResolve({ filter: /^node:module$/ }, () => ({ path: 'versions', namespace: 'stub' }))
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: `export const createRequire = () => () => ({ version: '' })`,
          loader: 'js',
        }))
      },
    },
  ],
})
if (!built.success) throw new AggregateError(built.logs, 'could not bundle the page')
const PACKAGES: Record<string, string> = { flowdown: '@localix-ai/flowdown', markstream: 'markstream-react' }
const require = createRequire(import.meta.url)
for (const name of NAMES)
  versions[name] = (require(`${PACKAGES[name] ?? name}/package.json`) as { version: string }).version

const styles = Bun.file(join(import.meta.dir, '../../packages/flowdown/dist/styles.css'))
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url)
    if (pathname === '/') {
      const css = searchParams.get('renderer') === 'flowdown' ? '<link rel="stylesheet" href="/styles.css">' : ''
      return new Response(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">${css}<div id="root"></div><script type="module" src="/browser-page.js"></script>`,
        { headers: { 'content-type': 'text/html' } },
      )
    }
    if (pathname === '/styles.css') return new Response(styles, { headers: { 'content-type': 'text/css' } })
    const file = Bun.file(join(out, pathname))
    return (await file.exists()) ? new Response(file) : new Response('', { status: 404 })
  },
})

// ─── The runs ───

interface Row {
  scenario: string
  pattern: string
  renderer: string
  updates: number
  done: number
  stopped: boolean
  /** Medians of the runs, in milliseconds. */
  scriptMs: number
  layoutMs: number
  styleMs: number
  taskMs: number
  p95Ms: number
  maxMs: number
  worstFrameMs: number
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!
const browser = await chromium.launch()
const rows: Row[] = []

for (const [scenario, pattern] of CASES) {
  const samples = new Map<string, Array<PageResult & Record<'script' | 'layout' | 'style' | 'task', number>>>()
  // Round by round, so a slow minute of the machine falls on every renderer alike.
  for (let run = 0; run < runs; run++) {
    for (const renderer of NAMES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      const session = await page.context().newCDPSession(page)
      await session.send('Performance.enable')
      const query = new URLSearchParams({ renderer, scenario, pattern, per: String(perFrame), budget: String(budgetMs) })
      await page.goto(`http://localhost:${server.port}/?${query}`)
      await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready)
      const counters = async () =>
        Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
      const before = await counters()
      const result = (await page.evaluate(() =>
        (window as unknown as { run: () => Promise<PageResult> }).run(),
      )) as PageResult
      const after = await counters()
      const spent = (name: string) => ((after[name] ?? 0) - (before[name] ?? 0)) * 1000
      const sample = {
        ...result,
        script: spent('ScriptDuration'),
        layout: spent('LayoutDuration'),
        style: spent('RecalcStyleDuration'),
        task: spent('TaskDuration'),
      }
      samples.set(renderer, [...(samples.get(renderer) ?? []), sample])
      await page.close()
    }
  }
  for (const renderer of NAMES) {
    const of = samples.get(renderer)!
    const row: Row = {
      scenario,
      pattern,
      renderer,
      updates: of[0]!.updates,
      done: Math.min(...of.map((s) => s.done)),
      stopped: of.some((s) => s.done < s.updates),
      scriptMs: median(of.map((s) => s.script)),
      layoutMs: median(of.map((s) => s.layout)),
      styleMs: median(of.map((s) => s.style)),
      taskMs: median(of.map((s) => s.task)),
      p95Ms: median(of.map((s) => s.p95Ms)),
      maxMs: median(of.map((s) => s.maxMs)),
      worstFrameMs: median(of.map((s) => s.worstFrameMs)),
    }
    rows.push(row)
    console.log(
      `${scenario} · ${pattern}`.padEnd(22),
      renderer.padEnd(16),
      row.stopped ? `stopped at ${row.done} of ${row.updates}` : `script ${Math.round(row.scriptMs)} ms`,
      `task ${Math.round(row.taskMs)} ms`,
      `p95 ${row.p95Ms.toFixed(2)} ms`,
    )
  }
}

const version = browser.version()
await browser.close()
void server.stop(true)
rmSync(out, { recursive: true, force: true })

// ─── The report ───

const git = (command: string) => {
  try {
    return execSync(command, { cwd: import.meta.dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}
const meta = {
  date: new Date().toISOString(),
  commit: git('git rev-parse --short HEAD'),
  dirty: git('git status --porcelain') !== '',
  cpu: cpus()[0]?.model ?? '',
  cores: cpus().length,
  os: `${process.platform} ${process.arch}`,
  browser: `Chromium ${version}`,
  runs,
  perFrame,
  budgetMs,
  renderers: NAMES.map((name) => `${name} ${versions[name] ?? ''}`.trim()),
}

const ms = (value: number) =>
  value >= 100 ? `${Math.round(value).toLocaleString('en-US')} ms` : `${value.toFixed(1)} ms`
const table = (cell: (row: Row) => string) =>
  [
    `| | ${NAMES.map((name) => `\`${name}\``).join(' | ')} |`,
    `| --- | ${NAMES.map(() => '---:').join(' | ')} |`,
    ...CASES.map(
      ([scenario, pattern]) =>
        `| ${scenario} · ${pattern} | ${NAMES.map((name) => cell(rows.find((r) => r.scenario === scenario && r.renderer === name)!)).join(' | ')} |`,
    ),
  ].join('\n')
const or = (cell: (row: Row) => string) => (row: Row) =>
  row.stopped ? `stopped at ${Math.round((row.done / row.updates) * 100)}%` : cell(row)

const markdown = `# Benchmark results, in a browser

${Object.entries(meta)
  .map(([key, value]) => `- **${key}:** ${Array.isArray(value) ? value.join(', ') : value}`)
  .join('\n')}

Each renderer streams the reply in Chromium, ${perFrame} updates per animation frame. The numbers are
the browser's own counters, the median of ${runs} runs. Lower is better. "Stopped" means the renderer
spent the time budget (${budgetMs.toLocaleString('en-US')} ms inside its updates) before the reply
ended, and how far it had got.

## Script

Time the main thread spent running script while the reply streamed.

${table(or((row) => ms(row.scriptMs)))}

## The whole main thread

Script, style, layout and paint together: everything that kept the page from answering.

${table(or((row) => ms(row.taskMs)))}

## One update

The 95th percentile of one update, with the longest in brackets, in milliseconds.

${table((row) => `${row.p95Ms.toFixed(2)} (${row.maxMs.toFixed(1)})`)}
`

if (process.argv.includes('--no-write')) console.log(`\n${markdown}`)
else {
  const dir = join(import.meta.dir, '../results')
  writeFileSync(join(dir, 'browser.json'), `${JSON.stringify({ meta, rows }, null, 2)}\n`)
  writeFileSync(join(dir, 'browser.md'), markdown)
  console.log(`\nwrote results/browser.md and results/browser.json`)
}
