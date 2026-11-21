/**
 * `bun bench/run.ts [--check]`: this package against Mermaid, on one diagram of every kind
 * (`scripts/corpus.ts`).
 *
 * - **In a browser** (Chromium, where Mermaid runs): every diagram of the corpus drawn to SVG, the
 *   median of repeated passes, each package's own bundle loaded first.
 * - **Size**: what each costs a page, minified and gzipped.
 * - **Growth**: a flowchart chain ten times longer: time should grow with it, not faster.
 * - **Memory**: what a thousand drawings more leave on the heap than a thousand did.
 *
 * Set `CHROMIUM_PATH` to use a Chromium of your own. Writes `results/latest.json`; `--check` holds
 * the relative figures to `budgets.json`'s `bench`.
 */
import { heapStats } from 'bun:jsc'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright-core'
import { CORPUS } from '../scripts/corpus'
import { toSVG } from '../src/index'

const root = join(import.meta.dir, '..')
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')).bench as Record<
  string,
  number
>
const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!

// Our bundle for the page, as a page would load it.
const built = await Bun.build({
  entrypoints: [join(root, 'src/index.ts')],
  minify: true,
  target: 'browser',
  format: 'esm',
})
const ours =
  (await built.outputs[0]!.text()).replace(/export\s*\{[^}]*\};?\s*$/, '') +
  ';window.toSVG=' +
  /export\s*\{[^}]*?(\w+) as toSVG/.exec(await built.outputs[0]!.text())![1]
const mermaidCode = readFileSync(join(root, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8')
const kb = (code: string) => gzipSync(code).length / 1024

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage()
await page.setContent('<!doctype html><body></body>')
await page.addScriptTag({ content: ours })
await page.addScriptTag({ content: mermaidCode })
const sources = CORPUS.map(([, source]) => source)
const timings = (await page.evaluate(async (all: string[]) => {
  const w = globalThis as unknown as {
    toSVG: (source: string) => string | null
    mermaid: {
      initialize(options: object): void
      render(id: string, source: string): Promise<{ svg: string }>
    }
  }
  w.mermaid.initialize({ startOnLoad: false })
  const middle = (values: number[]) =>
    values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
  const oursRuns: number[] = []
  for (let round = 0; round < 9; round++) {
    const start = performance.now()
    for (const source of all) w.toSVG(source)
    oursRuns.push(performance.now() - start)
  }
  const mermaidRuns: number[] = []
  let failed = 0
  for (let round = 0; round < 3; round++) {
    const start = performance.now()
    for (const [at, source] of all.entries()) {
      try {
        await w.mermaid.render(`d${round}-${at}`, source)
      } catch {
        if (round === 0) failed++
      }
    }
    mermaidRuns.push(performance.now() - start)
  }
  return { ours: middle(oursRuns), mermaid: middle(mermaidRuns), failed }
}, sources)) as { ours: number; mermaid: number; failed: number }
await browser.close()

// Growth: a chain of 60 nodes against 600.
const chain = (count: number) =>
  `flowchart TD\n${Array.from({ length: count }, (_, at) => `  n${at}[step ${at}] --> n${at + 1}[step ${at + 1}]`).join('\n')}`
const timed = (run: () => void) => {
  run()
  const runs: number[] = []
  for (let round = 0; round < 5; round++) {
    const start = performance.now()
    run()
    runs.push(performance.now() - start)
  }
  return median(runs)
}
const small = timed(() => toSVG(chain(60), { columns: 400 }))
const large = timed(() => toSVG(chain(600), { columns: 400 }))
const exponent = Math.log(large / small) / Math.log(10)

// Memory: what a thousand drawings more leave on the heap than a thousand drawings: the engine's
// own memory settles, a leak would grow with the count.
const heap = () => {
  Bun.gc(true)
  return heapStats().heapSize
}
const draw = (rounds: number) => {
  for (let round = 0; round < rounds; round++) for (const source of sources) toSVG(source)
}
draw(45)
const before = heap()
draw(45)
const retainedKB = Math.max(0, heap() - before) / 1024

const results = {
  browserMs: { '@localix-ai/diagram': timings.ours, mermaid: timings.mermaid },
  mermaidFailed: timings.failed,
  vsMermaid: timings.mermaid / timings.ours,
  gzipKB: { '@localix-ai/diagram': kb(ours), mermaid: kb(mermaidCode) },
  exponent,
  retainedKB,
}
console.log(`${CORPUS.length} diagrams, every kind, in Chromium`)
console.log(
  `  @localix-ai/diagram  ${timings.ours.toFixed(1).padStart(8)} ms   ${results.gzipKB['@localix-ai/diagram'].toFixed(1).padStart(7)} KB gzipped`,
)
console.log(
  `  mermaid              ${timings.mermaid.toFixed(1).padStart(8)} ms   ${results.gzipKB.mermaid.toFixed(1).padStart(7)} KB gzipped   (${timings.failed} it could not draw)`,
)
console.log(
  `× ${results.vsMermaid.toFixed(0)} faster; growth exponent ${exponent.toFixed(2)}; heap grown by ${45 * sources.length} drawings more: ${retainedKB.toFixed(0)} KB`,
)

mkdirSync(join(import.meta.dir, 'results'), { recursive: true })
writeFileSync(
  join(import.meta.dir, 'results', 'latest.json'),
  `${JSON.stringify(results, null, 2)}\n`,
)
if (process.argv.includes('--check')) {
  const failures = [
    results.vsMermaid < budgets.vsMermaid! &&
      `${results.vsMermaid.toFixed(1)}× Mermaid, budget ${budgets.vsMermaid}×`,
    exponent > budgets.exponent! &&
      `growth exponent ${exponent.toFixed(2)}, budget ${budgets.exponent}`,
  ].filter(Boolean)
  for (const failure of failures) console.error(`✗ ${failure}`)
  if (failures.length) process.exit(1)
}
