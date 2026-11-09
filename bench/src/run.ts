/**
 * `bun src/run.ts [--quick] [--only=a,b] [--renderers=llx,streamdown] [--runs=3] [--label=name]
 * [--no-write]`
 *
 * Every scenario, under each of its chunk patterns, through every renderer: one warm-up run, then
 * `--runs` measured ones, of which the median is kept. Writes `results/<date>-<label>.json` with
 * every number and the machine it ran on, and `results/latest.md` with the tables the README
 * quotes.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import { type Pattern, prefixes } from '../../packages/llx-markdown/test/chunks'
import { type Scenario, scaling, scenarios } from '../../packages/llx-markdown/test/replies'
import { hash } from '../../packages/llx-markdown/test/random'
import { report, type Row, summarize } from './report'

if (process.env.NODE_ENV !== 'production') {
  // React's development build checks far more on every render; the numbers would be its, not ours.
  console.error('Run with NODE_ENV=production (the `bench` script sets it).')
  process.exit(1)
}
GlobalRegistrator.register({ url: 'https://bench.test/' })
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
// Loaded after the DOM exists: React DOM and the renderers read `window` when imported.
const { RENDERERS } = await import('./renderers')
const { measure } = await import('./measure')

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const quick = process.argv.includes('--quick')
const runs = Number(flag('runs') ?? (quick ? 1 : 3))
const only = flag('only')?.split(',')
const renderers = RENDERERS.filter(
  (r) => !flag('renderers') || flag('renderers')!.split(',').includes(r.name),
)
const budgetMs = Number(flag('budget') ?? (quick ? 10_000 : 30_000))
const label = flag('label') ?? 'local'

/** The patterns a scenario runs under: every one gets `frame`; the hot paths also get `token`. */
const PATTERNS: Record<string, Pattern[]> = {
  'chat-5k': ['token', 'frame'],
  'answer-20k': ['token', 'frame', 'line'],
  'code-50k': ['token', 'frame'],
}

const [small, large] = scaling()
const all: Scenario[] = [...scenarios(), small, large].filter((s) => !only || only.includes(s.name))
const rows: Row[] = []
for (const scenario of all) {
  const patterns = quick ? (['frame'] as Pattern[]) : (PATTERNS[scenario.name] ?? ['frame'])
  for (const pattern of patterns) {
    const steps = prefixes(scenario.text, pattern)
    for (const renderer of renderers) {
      measure(renderer, scenario.history ?? [], steps.slice(0, 200), budgetMs)
      const results = Array.from({ length: runs }, () =>
        measure(renderer, scenario.history ?? [], steps, budgetMs),
      )
      const row = summarize(scenario, pattern, renderer, results)
      rows.push(row)
      console.log(
        `${scenario.name.padEnd(14)} ${pattern.padEnd(6)} ${renderer.name.padEnd(15)} ` +
          `${row.timedOut ? `timed out at ${row.drawnShare}%` : `${row.totalMs.toFixed(0)} ms`} · ` +
          `p95 ${row.p95.toFixed(2)} · max ${row.max.toFixed(1)} ms · ${(row.liveBytes / 2 ** 20).toFixed(1)} MB`,
      )
    }
  }
}

const git = (command: string) => {
  try {
    return execSync(`git ${command}`, { cwd: import.meta.dir, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}
const meta = {
  date: new Date().toISOString(),
  label,
  commit: git('rev-parse --short HEAD'),
  dirty: git('status --porcelain') !== '',
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  os: `${platform()} ${release()}`,
  runtime: `bun ${Bun.version}`,
  runs,
  quick,
  budgetMs,
  renderers: Object.fromEntries(renderers.map((r) => [r.name, r.version])),
  corpus: Object.fromEntries(all.map((s) => [s.name, hash(s.text + (s.history ?? []).join(''))])),
}

if (!process.argv.includes('--no-write')) {
  const dir = join(import.meta.dir, '..', 'results')
  mkdirSync(dir, { recursive: true })
  const stamp = meta.date.slice(0, 10)
  const json = `${JSON.stringify({ meta, rows }, null, 2)}\n`
  writeFileSync(join(dir, `${stamp}-${label}.json`), json)
  // A quick or partial run is for a look, not a record: only a full run becomes `latest`.
  if (!quick && !only && !flag('renderers')) {
    writeFileSync(join(dir, 'latest.json'), json)
    writeFileSync(join(dir, 'latest.md'), report(meta, rows, renderers))
  }
  console.log(
    `\nwrote results/${stamp}-${label}.json${quick || only ? '' : ', latest.json and latest.md'}`,
  )
}
// Not unregistered: React may still have passive work queued that reads `window`.
process.exit(0)
