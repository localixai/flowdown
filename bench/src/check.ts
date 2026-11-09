/**
 * `bun run bench:check [results/<file>.json]`: hold a benchmark run to `budgets.json`. Prints each
 * rule with the rows it covers and exits non-zero when one is broken. Reads `results/latest.json`
 * by default, so the numbers it judges are the ones committed beside it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Row } from './report'

interface Rule {
  id: string
  about: string
  renderer: string
  metric?: keyof Row
  max?: number
  maxChars?: number
  scaling?: [string, string]
  maxExponent?: number
  against?: string
  maxRatio?: number
}

const root = join(import.meta.dir, '..')
const file = process.argv[2] ?? join(root, 'results', 'latest.json')
const { rows } = JSON.parse(readFileSync(file, 'utf8')) as { rows: Row[] }
const { rules } = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')) as { rules: Rule[] }

const fmt = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2))
let broken = 0

for (const rule of rules) {
  const own = rows.filter((row) => row.renderer === rule.renderer)
  const failures: string[] = []
  let checked = 0

  if (rule.scaling && rule.maxExponent !== undefined) {
    const [small, large] = rule.scaling.map((name) => own.find((row) => row.scenario === name))
    if (small && large) {
      checked = 1
      const exponent = Math.log(large.totalMs / small.totalMs) / Math.log(large.chars / small.chars)
      if (large.timedOut || exponent > rule.maxExponent)
        failures.push(`${small.scenario} → ${large.scenario}: n^${exponent.toFixed(2)}`)
    }
  } else if (rule.against && rule.metric && rule.maxRatio !== undefined) {
    for (const row of own) {
      const other = rows.find(
        (x) =>
          x.renderer === rule.against && x.scenario === row.scenario && x.pattern === row.pattern,
      )
      if (!other || other.timedOut) continue
      checked += 1
      const ratio = (row[rule.metric] as number) / (other[rule.metric] as number)
      if (row.timedOut || ratio > rule.maxRatio)
        failures.push(`${row.scenario} · ${row.pattern}: ${ratio.toFixed(2)}× ${rule.against}`)
    }
  } else if (rule.metric && rule.max !== undefined) {
    for (const row of own.filter((r) => rule.maxChars === undefined || r.chars <= rule.maxChars)) {
      checked += 1
      const value = row[rule.metric] as number
      if (row.timedOut || value > rule.max)
        failures.push(`${row.scenario} · ${row.pattern}: ${fmt(value)} > ${fmt(rule.max)}`)
    }
  }

  const mark = checked === 0 ? '?' : failures.length ? '✗' : '✓'
  console.log(`${mark} ${rule.id.padEnd(10)} ${rule.about}`)
  for (const failure of failures) console.log(`    ${failure}`)
  if (checked === 0) console.log('    no rows in this run cover it')
  if (failures.length || checked === 0) broken += 1
}

process.exit(broken ? 1 : 0)
