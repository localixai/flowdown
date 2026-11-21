/**
 * `bun bench/run.ts [--check]`: this package against KaTeX and Temml on the corpus
 * (`scripts/corpus.ts`), the formulas agents write.
 *
 * - **Speed**: every formula of the corpus turned into markup, the median of repeated passes.
 * - **Output**: the markup's size, what a page holds and a stream sends again.
 * - **Streaming**: a formula of 400 terms read at every prefix, as a page draws it token by token.
 * - **Growth**: the same formula ten times longer: time should grow with the text, not faster.
 * - **Memory**: the heap a thousand formulas leave behind once collected (Bun's `heapStats`).
 *
 * Writes `results/latest.json`. `--check` holds the relative figures to `budgets.json`'s `bench`.
 */
import { heapStats } from 'bun:jsc'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import temml from 'temml'
import { CORPUS } from '../scripts/corpus'
import { toMathML, toRows, toText } from '../src/index'

const root = join(import.meta.dir, '..')
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')).bench as Record<
  string,
  number
>

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
const timed = (run: () => void, times = 15): number => {
  for (let warm = 0; warm < 3; warm++) run()
  const runs: number[] = []
  for (let index = 0; index < times; index++) {
    const start = performance.now()
    run()
    runs.push(performance.now() - start)
  }
  return median(runs)
}

const renderers = {
  '@localix-ai/math': (tex: string, display: boolean) => toMathML(tex, { display }),
  KaTeX: (tex: string, display: boolean) =>
    katex.renderToString(tex, { displayMode: display, throwOnError: false }),
  Temml: (tex: string, display: boolean) => temml.renderToString(tex, { displayMode: display }),
}

const speed: Record<string, { perFormulaUs: number; outputKB: number }> = {}
for (const [name, render] of Object.entries(renderers)) {
  const ms = timed(() => {
    for (const [, tex, display] of CORPUS) render(tex, display)
  })
  const bytes = CORPUS.reduce((sum, [, tex, display]) => sum + render(tex, display).length, 0)
  speed[name] = { perFormulaUs: (ms * 1000) / CORPUS.length, outputKB: bytes / 1024 }
}

// The terminal's two outputs, on the same corpus.
const terminalUs =
  (timed(() => {
    for (const [, tex, display] of CORPUS) {
      if (display) toRows(tex, 100)
      else toText(tex)
    }
  }) *
    1000) /
  CORPUS.length

// A long formula read at every prefix: a stream of 400 terms, token by token.
const terms = (count: number) =>
  Array.from({ length: count }, (_, at) => `\\frac{x_{${at}}^2}{${at + 1}}`).join(' + ')
const long = terms(400)
const prefixes: string[] = []
for (let at = 8; at <= long.length; at += 8) prefixes.push(long.slice(0, at))
const streaming = Object.fromEntries(
  Object.entries(renderers).map(([name, render]) => [
    name,
    timed(() => prefixes.forEach((prefix) => render(prefix, true)), 3),
  ]),
)

// Growth: ten times the terms.
const small = timed(() => toMathML(terms(200), { display: true }))
const large = timed(() => toMathML(terms(2000), { display: true }))
const exponent = Math.log(large / small) / Math.log(10)

// Memory: what a thousand formulas leave on the heap once they are dropped.
Bun.gc(true)
const before = heapStats().heapSize
let kept: string[] = []
for (let round = 0; round < 40; round++)
  for (const [, tex, display] of CORPUS) kept.push(toMathML(tex, { display }))
kept = []
Bun.gc(true)
const retainedKB = Math.max(0, heapStats().heapSize - before) / 1024

const ours = speed['@localix-ai/math']!
const results = {
  speed,
  terminalUs,
  streamingMs: streaming,
  exponent,
  retainedKB,
  vsKatex: speed.KaTeX!.perFormulaUs / ours.perFormulaUs,
  vsTemml: speed.Temml!.perFormulaUs / ours.perFormulaUs,
  outputVsKatex: speed.KaTeX!.outputKB / ours.outputKB,
}

const pad = (text: string, width: number) => text.padEnd(width)
console.log(`${CORPUS.length} formulas`)
for (const [name, figure] of Object.entries(speed)) {
  console.log(
    `  ${pad(name, 18)} ${figure.perFormulaUs.toFixed(1).padStart(7)} µs a formula   ${figure.outputKB.toFixed(1).padStart(6)} KB of markup   streaming 400 terms: ${streaming[name]!.toFixed(0)} ms`,
  )
}
console.log(`  terminal rows      ${terminalUs.toFixed(1).padStart(7)} µs a formula`)
console.log(
  `× KaTeX ${results.vsKatex.toFixed(1)} faster, ${results.outputVsKatex.toFixed(1)} times less markup; × Temml ${results.vsTemml.toFixed(1)}`,
)
console.log(
  `growth exponent ${exponent.toFixed(2)}; heap kept after 1,200 formulas: ${retainedKB.toFixed(0)} KB`,
)

mkdirSync(join(import.meta.dir, 'results'), { recursive: true })
writeFileSync(
  join(import.meta.dir, 'results', 'latest.json'),
  `${JSON.stringify(results, null, 2)}\n`,
)

if (process.argv.includes('--check')) {
  const failures = [
    results.vsKatex < budgets.vsKatex! &&
      `${results.vsKatex.toFixed(2)}× KaTeX, budget ${budgets.vsKatex}×`,
    results.outputVsKatex < budgets.outputVsKatex! &&
      `${results.outputVsKatex.toFixed(2)}× less markup than KaTeX, budget ${budgets.outputVsKatex}×`,
    exponent > budgets.exponent! &&
      `growth exponent ${exponent.toFixed(2)}, budget ${budgets.exponent}`,
  ].filter(Boolean)
  for (const failure of failures) console.error(`✗ ${failure}`)
  if (failures.length) process.exit(1)
}
