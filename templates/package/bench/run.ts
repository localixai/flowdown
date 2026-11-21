/**
 * `bun bench/run.ts [--check]`: how fast the package is on what agents write. Times are medians of
 * repeated runs after a warm-up; `--check` holds relative figures (against a reference, or growth
 * against size) to `budgets.json`'s `bench`, so they hold on any machine. Writes
 * `results/latest.json`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hello } from '../src/index'

const root = join(import.meta.dir, '..')
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')).bench as Record<
  string,
  number
>

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
const timed = (run: () => void, times = 9): number => {
  run()
  const runs: number[] = []
  for (let index = 0; index < times; index++) {
    const start = performance.now()
    run()
    runs.push(performance.now() - start)
  }
  return median(runs)
}

// Growth: ten times the input should cost about ten times the time, not a hundred.
const small = timed(() => hello('x'.repeat(10_000)))
const large = timed(() => hello('x'.repeat(100_000)))
const exponent = Math.log(large / small) / Math.log(10)
const results = { exponent }
console.log(`growth exponent ${exponent.toFixed(2)} (budget ${budgets.exponent})`)

mkdirSync(join(import.meta.dir, 'results'), { recursive: true })
writeFileSync(
  join(import.meta.dir, 'results', 'latest.json'),
  `${JSON.stringify(results, null, 2)}\n`,
)
if (process.argv.includes('--check') && exponent > budgets.exponent!) process.exit(1)
