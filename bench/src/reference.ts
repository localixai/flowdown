/**
 * `bun src/reference.ts`: results/reference.json, the other renderers' rows that `run.ts` keeps
 * instead of measuring them again.
 *
 * Each row is the mean of that cell over every full run recorded in results/ that measured it as it
 * would be measured today: the same version of the renderer, the same reply (by its hash), the
 * same machine, runtime and time budget. One run differs from the next by 10 to 15% with how busy
 * the machine was; the mean of all of them is steadier than any one, and it is the only figure
 * that does not move when flowdown is measured again.
 *
 * Run it again after a full run (`bun run bench:all`), which adds one more record to the mean.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { hash } from '../../packages/flowdown/test/random'
import { type Scenario, scaling, scenarios } from '../../packages/flowdown/test/replies'
import { RENDERERS } from './renderers'
import type { Row } from './report'

interface Recorded {
  meta: {
    cpu: string
    runtime: string
    budgetMs: number
    quick?: boolean
    reused?: string[]
    renderers: Record<string, string>
    corpus: Record<string, string>
  }
  rows: Row[]
}

const dir = join(import.meta.dir, '../results')
const cpu = cpus()[0]?.model ?? 'unknown'
const runtime = `bun ${Bun.version}`
const budgetMs = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 30_000)
const others = RENDERERS.filter((r) => !r.name.startsWith('flowdown'))
const replies: Scenario[] = [...scenarios(), ...scaling()]
const corpus = Object.fromEntries(
  replies.map((s) => [s.name, hash(s.text + (s.history ?? []).join(''))]),
)

const files = readdirSync(dir)
  .filter((name) => /^\d{4}-\d\d-\d\d-.+\.json$/.test(name))
  .sort()
/** Every row that counts, by cell. */
const cells = new Map<string, Row[]>()
const used = new Set<string>()
for (const file of files) {
  const { meta, rows } = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Recorded
  if (meta.quick || meta.cpu !== cpu || meta.runtime !== runtime || meta.budgetMs !== budgetMs) continue
  for (const row of rows) {
    const renderer = others.find((r) => r.name === row.renderer)
    if (!renderer || meta.renderers[renderer.name] !== renderer.version) continue
    // A row that was itself kept from the reference is not a measurement.
    if (meta.reused?.includes(row.renderer)) continue
    if (meta.corpus[row.scenario] !== corpus[row.scenario]) continue
    const key = `${row.scenario}\n${row.pattern}\n${row.renderer}`
    cells.set(key, [...(cells.get(key) ?? []), row])
    used.add(file)
  }
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const rows = [...cells.values()].map((of) => {
  const row = { ...of.at(-1)! } as Record<string, unknown>
  for (const [key, value] of Object.entries(row)) {
    const all = of.map((r) => (r as unknown as Record<string, unknown>)[key])
    if (typeof value === 'number') row[key] = mean(all as number[])
    // Stopped by the time budget, if it was in most of the runs.
    else if (typeof value === 'boolean') row[key] = all.filter(Boolean).length * 2 > all.length
  }
  return row as unknown as Row
})

const counts = [...cells.values()].map((of) => of.length)
const meta = {
  date: new Date().toISOString(),
  cpu,
  runtime,
  budgetMs,
  renderers: Object.fromEntries(others.map((r) => [r.name, r.version])),
  corpus,
  from: [...used],
  about: `the mean of ${Math.min(...counts)} to ${Math.max(...counts)} full runs, ${[...used][0]!.slice(0, 10)} to ${[...used].at(-1)!.slice(0, 10)}`,
}
writeFileSync(join(dir, 'reference.json'), `${JSON.stringify({ meta, rows }, null, 2)}\n`)
console.log(`wrote results/reference.json: ${rows.length} rows, ${meta.about}`)
for (const renderer of others) {
  const of = (scenario: string) =>
    rows.find((r) => r.renderer === renderer.name && r.scenario === scenario && r.pattern === 'frame')
  const spread = (scenario: string) => {
    const all = cells.get(`${scenario}\nframe\n${renderer.name}`)?.map((r) => r.totalMs) ?? []
    return `${Math.round(of(scenario)?.totalMs ?? 0)} ms (${Math.round(Math.min(...all))} to ${Math.round(Math.max(...all))}, ${all.length} runs)`
  }
  console.log(`  ${renderer.name.padEnd(16)} chat-5k ${spread('chat-5k')} · long-100k ${spread('long-100k')}`)
}
