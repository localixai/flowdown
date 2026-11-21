/**
 * `bun src/machines.ts`: results/machines.md, the same scenarios on every machine a full run was
 * recorded on. The machine the README quotes is `results/latest.json`; another one's full run is
 * `results/machines/<name>/latest.json` (`run.ts --machine=<name>`). Each table is one scenario
 * streamed frame by frame, one row a machine, so a reader sees what holds on a slower machine and
 * what does not: the ratios, the order of the renderers, where a lead shrinks or turns.
 *
 * Its figures are copied from those files and nothing else, so the README can quote this page.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Row } from './report'

interface Recorded {
  meta: { date: string; label: string; commit: string; cpu: string; cores: number; os: string }
  rows: Row[]
}

const results = join(import.meta.dir, '../results')
const machines: [string, Recorded][] = [
  ['quoted in the README', JSON.parse(readFileSync(join(results, 'latest.json'), 'utf8')) as Recorded],
]
const others = join(results, 'machines')
if (existsSync(others))
  for (const name of readdirSync(others).sort()) {
    const file = join(others, name, 'latest.json')
    if (existsSync(file)) machines.push([name, JSON.parse(readFileSync(file, 'utf8')) as Recorded])
  }

const SCENARIOS = ['chat-5k', 'answer-20k', 'code-50k', 'long-100k']
const RENDERERS = ['flowdown', 'markdown-to-jsx', 'marked-react', 'streamdown', 'markstream', 'react-markdown']

const cell = (rows: Row[], scenario: string, renderer: string): string => {
  const row = rows.find(
    (r) => r.scenario === scenario && r.pattern === 'frame' && r.renderer === renderer,
  )
  if (!row) return '—'
  if (row.timedOut) return `stopped at ${Math.round(row.drawnShare)}%`
  return `${row.totalMs >= 100 ? row.totalMs.toFixed(0) : row.totalMs.toFixed(1)} ms`
}
/** How many times flowdown's whole stream is faster than the fastest other renderer's. */
const lead = (rows: Row[], scenario: string): string => {
  const total = (renderer: string) =>
    rows.find((r) => r.scenario === scenario && r.pattern === 'frame' && r.renderer === renderer)
  const ours = total('flowdown')
  const best = RENDERERS.slice(1)
    .map(total)
    .filter((row): row is Row => row !== undefined && !row.timedOut)
    .sort((a, b) => a.totalMs - b.totalMs)[0]
  if (!ours || !best) return '—'
  const ratio = best.totalMs / ours.totalMs
  return ratio >= 1
    ? `${ratio.toFixed(1)}× faster than ${best.renderer}`
    : `${(1 / ratio).toFixed(1)}× slower than ${best.renderer}`
}

const lines = [
  '# The same benchmark on every machine',
  '',
  'Total main-thread time to stream each reply frame by frame (20 characters an update), from each',
  'machine’s last full run (`bun run bench:all`, three passes). Lower is better; "stopped" means the',
  'renderer used up the 30 s budget first. Absolute times are each machine’s own: compare the',
  'renderers on one row, and the rows for how the order holds. `bun src/machines.ts` writes this',
  'page from the files below.',
  '',
  '| Machine | CPU | Run |',
  '| --- | --- | --- |',
  ...machines.map(
    ([name, { meta }]) =>
      `| ${name} | ${meta.cpu}, ${meta.cores} cores, ${meta.os.split(' ')[0]} | ${meta.date.slice(0, 10)}, ${meta.label}, ${meta.commit} |`,
  ),
]
for (const scenario of SCENARIOS) {
  lines.push(
    '',
    `## ${scenario}`,
    '',
    `| Machine | ${RENDERERS.map((r) => `\`${r}\``).join(' | ')} | flowdown |`,
    `| --- | ${RENDERERS.map(() => '---:').join(' | ')} | --- |`,
    ...machines.map(
      ([name, { rows }]) =>
        `| ${name} | ${RENDERERS.map((r) => cell(rows, scenario, r)).join(' | ')} | ${lead(rows, scenario)} |`,
    ),
  )
}
writeFileSync(join(results, 'machines.md'), `${lines.join('\n')}\n`)
console.log(`wrote results/machines.md: ${machines.length} machines`)
