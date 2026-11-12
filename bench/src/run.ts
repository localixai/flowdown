/**
 * `bun src/run.ts [--all] [--quick] [--only=a,b] [--renderers=flowdown,streamdown] [--runs=3]
 * [--passes=1] [--label=name] [--no-write]`
 *
 * Every scenario, under each of its chunk patterns, through every renderer, each in a process of
 * its own (cell.ts): one warm-up run, then `--runs` measured ones, of which the median is kept.
 * With `--passes`, the whole table is measured that many times over and each cell keeps the median
 * of its passes (report.ts, `across`): for a machine that is not quiet. Writes
 * `results/<date>-<label>.json` with every number and the machine it ran on, and
 * `results/latest.md` with the tables the README quotes.
 *
 * Only flowdown is measured, unless `--all` is given. The other renderers do not change between
 * two runs, and they are 96% of a full run's time (react-markdown alone is half of it): their rows
 * are kept from `results/reference.json`, the mean of every full run recorded (reference.ts), for
 * as long as it is of the same version of the renderer, the same reply, the same machine, runtime
 * and time budget. A row that cannot be kept is measured. `meta.reused` names the renderers whose
 * rows were kept, and `meta.reference` what they are the mean of.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import type { Pattern } from '../../packages/flowdown/test/chunks'
import { type Scenario, scaling, scenarios } from '../../packages/flowdown/test/replies'
import { hash } from '../../packages/flowdown/test/random'
import type { RunResult } from './measure'
import { across, report, type Row, summarize } from './report'

if (process.env.NODE_ENV !== 'production') {
  // React's development build checks far more on every render; the numbers would be its, not ours.
  console.error('Run with NODE_ENV=production (the `bench` script sets it).')
  process.exit(1)
}
const { RENDERERS } = await import('./renderers')

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const quick = process.argv.includes('--quick')
const runs = Number(flag('runs') ?? (quick ? 1 : 3))
const passes = Number(flag('passes') ?? 1)
const only = flag('only')?.split(',')
const renderers = RENDERERS.filter(
  (r) => !flag('renderers') || flag('renderers')!.split(',').includes(r.name),
)
const budgetMs = Number(flag('budget') ?? (quick ? 10_000 : 30_000))
const label = flag('label') ?? 'local'
const everyone = process.argv.includes('--all')
const cpu = cpus()[0]?.model ?? 'unknown'
const runtime = `bun ${Bun.version}`
const dir = join(import.meta.dir, '..', 'results')

/** The reference: where the rows of a renderer that has not changed are kept from. */
interface Earlier {
  meta: {
    date: string
    cpu: string
    runtime: string
    budgetMs: number
    renderers: Record<string, string>
    corpus: Record<string, number | string>
    about: string
  }
  rows: Row[]
}
const before: Earlier | null =
  everyone || quick || !existsSync(join(dir, 'reference.json'))
    ? null
    : (JSON.parse(readFileSync(join(dir, 'reference.json'), 'utf8')) as Earlier)
const sameSetup =
  before !== null &&
  before.meta.cpu === cpu &&
  before.meta.runtime === runtime &&
  before.meta.budgetMs === budgetMs
/** The row measured before for this cell, if it would come out the same measured again. */
const kept = (scenario: Scenario, pattern: Pattern, renderer: { name: string; version: string }) =>
  !sameSetup ||
  renderer.name.startsWith('flowdown') ||
  before!.meta.renderers[renderer.name] !== renderer.version ||
  before!.meta.corpus[scenario.name] !== fingerprint(scenario)
    ? undefined
    : before!.rows.find(
        (row) =>
          row.scenario === scenario.name && row.pattern === pattern && row.renderer === renderer.name,
      )
const fingerprint = (scenario: Scenario) => hash(scenario.text + (scenario.history ?? []).join(''))
/** Each renderer with a row kept. */
const reused = new Set<string>()

/** The patterns a scenario runs under: every one gets `frame`; the hot paths also get `token`. */
const PATTERNS: Record<string, Pattern[]> = {
  'chat-5k': ['token', 'frame'],
  'answer-20k': ['token', 'frame', 'line'],
  'code-50k': ['token', 'frame'],
}

/** One cell in a fresh process (see cell.ts): its runs, measured on a heap of its own. */
const cell = (scenario: string, pattern: Pattern, renderer: string): RunResult[] => {
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, 'cell.ts'),
      scenario,
      pattern,
      renderer,
      String(runs),
      String(budgetMs),
    ],
    { env: process.env, stderr: 'inherit' },
  )
  if (child.exitCode !== 0)
    throw new Error(`${scenario} ${pattern} ${renderer}: exit ${child.exitCode}`)
  return JSON.parse(child.stdout.toString().trim().split('\n').at(-1) ?? '[]') as RunResult[]
}

const [small, large] = scaling()
const all: Scenario[] = [...scenarios(), small, large].filter((s) => !only || only.includes(s.name))
/** Each cell's row from every pass, in the order of the table; a kept row stands alone. */
const measured: Row[][] = []
for (let pass = 1; pass <= passes; pass++) {
  let at = 0
  for (const scenario of all) {
    const patterns = quick ? (['frame'] as Pattern[]) : (PATTERNS[scenario.name] ?? ['frame'])
    for (const pattern of patterns) {
      for (const renderer of renderers) {
        const old = kept(scenario, pattern, renderer)
        if (old) {
          if (pass === 1) {
            measured[at] = [old]
            reused.add(renderer.name)
          }
          at++
          continue
        }
        const results = cell(scenario.name, pattern, renderer.name)
        const row = summarize(scenario, pattern, renderer, results)
        ;(measured[at++] ??= []).push(row)
        console.log(
          `${passes > 1 ? `pass ${pass}/${passes}  ` : ''}` +
            `${scenario.name.padEnd(14)} ${pattern.padEnd(6)} ${renderer.name.padEnd(15)} ` +
            `${row.timedOut ? `timed out at ${row.drawnShare}%` : `${row.totalMs.toFixed(0)} ms`} · ` +
            `p95 ${row.p95.toFixed(2)} · max ${row.max.toFixed(1)} ms · ${(row.liveBytes / 2 ** 20).toFixed(1)} MB`,
        )
      }
    }
  }
}
const rows = measured.map(across)

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
  cpu,
  cores: cpus().length,
  os: `${platform()} ${release()}`,
  runtime,
  runs,
  passes,
  quick,
  budgetMs,
  renderers: Object.fromEntries(renderers.map((r) => [r.name, r.version])),
  corpus: Object.fromEntries(all.map((s) => [s.name, fingerprint(s)])),
  ...(reused.size > 0 ? { reused: [...reused], reference: before!.meta.about } : null),
}

if (!process.argv.includes('--no-write')) {
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
