/**
 * `bun bench/run.ts [--check] [--no-write]`: how fast the highlighter is against highlight.js and
 * Shiki, on what agents write and on the TextMate samples (`scripts/corpus.ts`).
 *
 * - **Whole files**: each sample, made about 1 MB long by repeating it, highlighted once.
 * - **A file that streams**: an agent's TypeScript file of 2,000 lines, 8 characters a token, as a
 *   page draws it on every token: this package line by line (`createStream`), highlight.js on the
 *   whole text so far (what a renderer without pieces does) and in pieces of 40 lines (what
 *   flowdown did), Shiki on the whole text so far. A stream that passes the time budget stops.
 * - **Growth**: the same stream four times longer, for this package: time should grow with the text.
 *
 * Writes `results/latest.json` and `results/latest.md`. `--check` holds the run to
 * `budgets.json`: relative figures, so they hold on any machine.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import hljs from 'highlight.js'
import { createHighlighter } from 'shiki'
import { corpus } from '../scripts/corpus'
import { createStream, highlight } from '../src/index'

const BUDGET_MS = 20_000
const samples = corpus(['agent', 'shiki'])
const shiki = await createHighlighter({
  themes: ['github-dark'],
  langs: [...new Set(samples.map((sample) => sample.shiki))],
})

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
const timed = (run: () => void, times = 5): number => {
  run()
  const runs: number[] = []
  for (let index = 0; index < times; index++) {
    const start = performance.now()
    run()
    runs.push(performance.now() - start)
  }
  return median(runs)
}

// Whole files, by language: the samples of each language joined and repeated to about 1 MB.
const byLanguage = new Map<string, { code: string; hljs: string; shiki: string }>()
for (const sample of samples) {
  const known = byLanguage.get(sample.language)
  byLanguage.set(sample.language, {
    code: known ? `${known.code}\n${sample.code}` : sample.code,
    hljs: sample.hljs,
    shiki: sample.shiki,
  })
}
interface WholeRow {
  language: string
  chars: number
  ours: number
  hljs: number | null
  shiki: number
}
const whole: WholeRow[] = []
for (const [language, { code: one, hljs: name, shiki: lang }] of byLanguage) {
  const code = Array.from({ length: Math.ceil(1_000_000 / one.length) }, () => one).join('\n')
  const known = hljs.getLanguage(name)
  // Shiki is read on a tenth of it: a whole megabyte takes it tens of seconds a language.
  const tenth = code.slice(0, Math.floor(code.length / 10))
  whole.push({
    language,
    chars: code.length,
    ours: timed(() => highlight(code, language)),
    hljs: known
      ? timed(() => hljs.highlight(code, { language: name, ignoreIllegals: true }))
      : null,
    shiki:
      timed(() => shiki.codeToHtml(tenth, { lang: lang as never, theme: 'github-dark' }), 1) * 10,
  })
  console.log(`whole ${language.padEnd(11)} ours ${whole.at(-1)!.ours.toFixed(1)} ms`)
}

// A file that streams.
const file = readFileSync(
  join(import.meta.dir, '..', 'test', 'agent', 'typescript-module.ts'),
  'utf8',
)
const lines = file.split('\n')
const make = (count: number) =>
  Array.from({ length: count }, (_, index) => lines[index % lines.length]).join('\n')
const TOKEN = 8

interface StreamRow {
  name: string
  ms: number
  /** Share of the stream drawn before the budget ran out: 100 when it finished. */
  drawn: number
}
function stream(
  name: string,
  code: string,
  update: (text: string, piece: string) => void,
): StreamRow {
  const start = performance.now()
  let at = 0
  for (; at < code.length; at += TOKEN) {
    update(code.slice(0, at + TOKEN), code.slice(at, at + TOKEN))
    if (performance.now() - start > BUDGET_MS) break
  }
  return {
    name,
    ms: performance.now() - start,
    drawn: Math.min(100, Math.round(((at + TOKEN) / code.length) * 100)),
  }
}

const ours = (code: string): StreamRow => {
  const writer = createStream('typescript')!
  return stream('@localix-ai/highlight, line by line', code, (_text, piece) => writer.write(piece))
}
const code = make(2_000)
const streams: StreamRow[] = [ours(code)]
console.log(`stream ours ${streams[0]!.ms.toFixed(0)} ms`)
// The last piece again on every token, the ones above once: flowdown's way before.
let pieceStart = 0
let scanned = 0
let count = 0
streams.push(
  stream('highlight.js, in pieces of 40 lines', code, (text) => {
    for (
      let index = text.indexOf('\n', scanned);
      index !== -1;
      index = text.indexOf('\n', index + 1)
    ) {
      if (++count % 40 === 0) pieceStart = index + 1
      scanned = index + 1
    }
    hljs.highlight(text.slice(pieceStart), { language: 'typescript', ignoreIllegals: true })
  }),
)
console.log(`stream hljs pieces ${streams.at(-1)!.ms.toFixed(0)} ms`)
streams.push(
  stream('highlight.js, the whole text', code, (text) =>
    hljs.highlight(text, { language: 'typescript', ignoreIllegals: true }),
  ),
)
console.log(`stream hljs whole ${streams.at(-1)!.ms.toFixed(0)} ms`)
streams.push(
  stream('Shiki, the whole text', code, (text) =>
    shiki.codeToHtml(text, { lang: 'typescript', theme: 'github-dark' }),
  ),
)
console.log(`stream shiki ${streams.at(-1)!.ms.toFixed(0)} ms`)

// Growth: four times the text should cost about four times the time, not sixteen.
const small = median([0, 1, 2].map(() => ours(make(1_000)).ms))
const large = median([0, 1, 2].map(() => ours(make(4_000)).ms))
const exponent = Math.log(large / small) / Math.log(4)

const total = (key: 'ours' | 'hljs' | 'shiki') =>
  whole.reduce((sum, row) => sum + (key === 'hljs' ? (row.hljs ?? 0) : row[key]), 0)
const withHljs = whole.filter((row) => row.hljs !== null)
const hljsTotal = withHljs.reduce((sum, row) => sum + row.hljs!, 0)
const oursOnThose = withHljs.reduce((sum, row) => sum + row.ours, 0)
const result = {
  meta: {
    date: new Date().toISOString(),
    cpu: cpus()[0]?.model ?? 'unknown',
    cores: cpus().length,
    os: `${platform()} ${release()}`,
    runtime: `bun ${Bun.version}`,
    budgetMs: BUDGET_MS,
    token: TOKEN,
  },
  whole,
  streams,
  growth: { small, large, exponent },
  summary: {
    wholeVsHljs: hljsTotal / oursOnThose,
    wholeVsShiki: total('shiki') / total('ours'),
    streamVsPieces: streams[1]!.ms / streams[0]!.ms,
  },
}

const ms = (value: number) => (value >= 100 ? value.toFixed(0) : value.toFixed(1))
const table = [
  '# Highlighter benchmark',
  '',
  `${result.meta.cpu}, ${result.meta.cores} cores, ${result.meta.os}, ${result.meta.runtime}; ${result.meta.date.slice(0, 10)}.`,
  '',
  '## Whole files',
  '',
  'Each language’s samples repeated to about 1 MB, highlighted once; milliseconds, lower is better.',
  '',
  '| Language | `@localix-ai/highlight` | highlight.js | Shiki |',
  '| --- | ---: | ---: | ---: |',
  ...whole.map(
    (row) =>
      `| ${row.language} | ${ms(row.ours)} | ${row.hljs === null ? '—' : ms(row.hljs)} | ${ms(row.shiki)} |`,
  ),
  '',
  `On the languages both have, highlight.js takes ${result.summary.wholeVsHljs.toFixed(1)}× as long; Shiki ${result.summary.wholeVsShiki.toFixed(0)}×.`,
  '',
  '## A file that streams',
  '',
  `${code.length.toLocaleString('en')} characters of TypeScript, ${TOKEN} a token, drawn on every token; stopped past ${BUDGET_MS / 1000} s.`,
  '',
  '| Highlighter | Total | Drawn |',
  '| --- | ---: | ---: |',
  ...streams.map((row) => `| ${row.name} | ${ms(row.ms)} ms | ${row.drawn}% |`),
  '',
  `Four times the file costs ${(large / small).toFixed(1)}× the time (exponent ${exponent.toFixed(2)}).`,
  '',
].join('\n')

if (!process.argv.includes('--no-write')) {
  writeFileSync(
    join(import.meta.dir, 'results', 'latest.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  )
  writeFileSync(join(import.meta.dir, 'results', 'latest.md'), table)
}
console.log(`\n${table}`)

if (process.argv.includes('--check')) {
  const budgets = JSON.parse(readFileSync(join(import.meta.dir, 'budgets.json'), 'utf8')) as {
    wholeVsHljs: number
    streamVsPieces: number
    exponent: number
  }
  const checks = [
    [
      result.summary.wholeVsHljs >= budgets.wholeVsHljs,
      `whole files at least ${budgets.wholeVsHljs}× as fast as highlight.js`,
    ],
    [
      result.summary.streamVsPieces >= budgets.streamVsPieces,
      `a stream at least ${budgets.streamVsPieces}× as fast as highlight.js in pieces`,
    ],
    [
      exponent <= budgets.exponent,
      `a stream's time grows with its text: exponent under ${budgets.exponent}`,
    ],
  ] as const
  for (const [ok, what] of checks) console.log(`${ok ? '✓' : '✗'} ${what}`)
  if (checks.some(([ok]) => !ok)) process.exit(1)
}
