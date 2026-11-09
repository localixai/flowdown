/** Medians across runs, and the Markdown tables `results/latest.md` and the README quote. */
import type { Pattern } from '../../packages/llx-markdown/test/chunks'
import type { Scenario } from '../../packages/llx-markdown/test/replies'
import type { RunResult } from './measure'
import type { Renderer } from './renderers'

/** 60 Hz: an update longer than this drops a frame. */
export const FRAME_MS = 1000 / 60
/** The Long Tasks API's threshold: the page stops answering input. */
export const LONG_TASK_MS = 50

export interface Row {
  scenario: string
  pattern: Pattern
  renderer: string
  version: string
  chars: number
  updates: number
  /** Percent of the updates drawn before the time budget ran out. */
  drawnShare: number
  timedOut: boolean
  totalMs: number
  msPerKb: number
  p50: number
  p95: number
  p99: number
  max: number
  overFrame: number
  overLongTask: number
  mountMs: number
  finishMs: number
  cpuMs: number
  liveBytes: number
  /** Kept after the first stream is unmounted: caches warmed by its text, and any leak. */
  leftBytes: number
  /** Kept after a second, identical stream: only a leak grows here (NaN with one run). */
  grownBytes: number
  nodes: number
}

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? Number.NaN
}
const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? Number.NaN

export function summarize(
  scenario: Scenario,
  pattern: Pattern,
  renderer: Renderer,
  results: RunResult[],
): Row {
  const per = results.map((run) => {
    const sorted = run.times.toSorted((a, b) => a - b)
    return {
      total: run.times.reduce((sum, t) => sum + t, 0),
      p50: quantile(sorted, 0.5),
      p95: quantile(sorted, 0.95),
      p99: quantile(sorted, 0.99),
      max: sorted.at(-1) ?? 0,
      overFrame: run.times.filter((t) => t > FRAME_MS).length,
      overLongTask: run.times.filter((t) => t > LONG_TASK_MS).length,
    }
  })
  const pick = (key: keyof (typeof per)[number]) => median(per.map((p) => p[key]))
  const first = results[0]!
  const totalMs = pick('total')
  const chars = scenario.text.length
  return {
    scenario: scenario.name,
    pattern,
    renderer: renderer.name,
    version: renderer.version,
    chars,
    updates: first.updates,
    drawnShare: Math.round((100 * median(results.map((r) => r.drawn))) / first.updates),
    timedOut: results.some((r) => r.timedOut),
    totalMs,
    msPerKb: totalMs / (chars / 1024),
    p50: pick('p50'),
    p95: pick('p95'),
    p99: pick('p99'),
    max: pick('max'),
    overFrame: pick('overFrame'),
    overLongTask: pick('overLongTask'),
    mountMs: median(results.map((r) => r.mountMs)),
    finishMs: median(results.map((r) => r.finishMs)),
    cpuMs: median(results.map((r) => r.cpuMs)),
    liveBytes: median(results.map((r) => r.liveBytes)),
    leftBytes: results[0]?.leftBytes ?? Number.NaN,
    // A repeat of the same reply finds every cache warm: what it keeps is what it leaks. A leak
    // shows in every repeat, while the collector now and then keeps one tree alive a run longer
    // (spikes of several MB, react-markdown's too, which caches nothing): the median, not the max.
    grownBytes: results.length > 1 ? median(results.slice(1).map((r) => r.leftBytes)) : Number.NaN,
    nodes: first.nodes,
  }
}

const mb = (bytes: number) => (Number.isNaN(bytes) ? '–' : `${(bytes / 2 ** 20).toFixed(1)}`)
const ms = (value: number) => (value >= 100 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2))

function grid(
  rows: Row[],
  renderers: readonly Renderer[],
  keys: readonly string[],
  keyOf: (row: Row) => string,
  cell: (row: Row) => string,
) {
  const head = `| | ${renderers.map((r) => `\`${r.name}\``).join(' | ')} |`
  const rule = `| --- | ${renderers.map(() => '---:').join(' | ')} |`
  const lines = keys.map((key) => {
    const cells = renderers.map((r) => {
      const row = rows.find((x) => keyOf(x) === key && x.renderer === r.name)
      return row ? cell(row) : '–'
    })
    return `| ${key} | ${cells.join(' | ')} |`
  })
  return [head, rule, ...lines].join('\n')
}

const total = (row: Row) =>
  row.timedOut ? `stopped at ${row.drawnShare}%` : `${ms(row.totalMs)} ms (${ms(row.p95)})`

export function report(meta: Record<string, unknown>, rows: Row[], renderers: readonly Renderer[]) {
  const keyed = (row: Row) => `${row.scenario} · ${row.pattern}`
  const keys = [
    ...new Set(
      rows
        .filter((r) => !r.scenario.startsWith('answer-') || (r.chars > 15_000 && r.chars < 30_000))
        .map(keyed),
    ),
  ]
  const scale = renderers.map((r) => {
    const a = rows.find((x) => x.scenario === 'answer-10k' && x.renderer === r.name)
    const b = rows.find((x) => x.scenario === 'answer-40k' && x.renderer === r.name)
    if (!a || !b) return null
    const ratio = b.totalMs / a.totalMs
    const cell = b.timedOut
      ? 'stopped'
      : `${ratio.toFixed(1)}× (n^${(Math.log(ratio) / Math.log(4)).toFixed(2)})`
    return `| \`${r.name}\` | ${ms(a.totalMs)} ms | ${b.timedOut ? 'stopped' : `${ms(b.totalMs)} ms`} | ${cell} |`
  })
  return `# Benchmark results

${Object.entries(meta)
  .filter(([key]) => !['corpus', 'renderers'].includes(key))
  .map(([key, value]) => `- **${key}:** ${String(value)}`)
  .join('\n')}
- **renderers:** ${renderers.map((r) => `${r.name} ${r.version}`).join(', ')}

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(${String(meta.budgetMs)} ms) before the reply ended.

${grid(rows, renderers, keys, keyed, total)}

## Frame budget

Updates longer than a 60 Hz frame (${FRAME_MS.toFixed(1)} ms) / longer than a long task
(${LONG_TASK_MS} ms) / the longest update.

${grid(rows, renderers, keys, keyed, (r) => `${r.overFrame} / ${r.overLongTask} / ${ms(r.max)} ms`)}

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

${grid(rows, renderers, keys, keyed, (r) => `${mb(r.liveBytes)} / ${mb(r.leftBytes)} / ${mb(r.grownBytes)}`)}

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
${scale.filter(Boolean).join('\n')}
`
}
