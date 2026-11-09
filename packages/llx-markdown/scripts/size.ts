/**
 * What each entry costs a page, minified and gzipped: the package's own code it reaches (the
 * dependencies it imports are listed beside it; a page may already have them). Fails when an
 * entry's own code grows past its budget, so a change that bloats the renderer is a decision, not
 * an accident. Run after `build`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { packageOf, reach } from './graph'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
}

/** Budgets for each entry's own code, minified and gzipped, in KB: today's size and a margin. */
const BUDGET: Record<string, number> = {
  '.': 16,
  './remark': 7.5,
  './stream': 3.5,
  './prompt': 2,
  './html': 0.5,
  './math': 1.2,
  './highlight': 0.8,
  './styles.css': 5,
}

async function minified(target: string) {
  const result = await Bun.build({
    entrypoints: [join(root, target)],
    minify: true,
    packages: 'external',
    target: 'browser',
    throw: false,
  })
  if (!result.success) throw new AggregateError(result.logs, `could not bundle ${target}`)
  const parts = await Promise.all(result.outputs.map((output) => output.text()))
  return parts.join('\n')
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
let over = false
for (const [path, target] of Object.entries(manifest.exports)) {
  const budget = BUDGET[path]
  if (budget === undefined) continue
  const size = gzipSync(await minified(target)).length
  const imports = target.endsWith('.css')
    ? []
    : [...new Set([...reach(join(root, target)).packages].map(packageOf))].toSorted()
  const fits = size <= budget * 1024
  over ||= !fits
  console.log(
    `${fits ? '✓' : '✗'} ${path.padEnd(13)} ${kb(size).padStart(8)} / ${budget} KB   ${imports.join(', ')}`,
  )
}
if (over) process.exit(1)
