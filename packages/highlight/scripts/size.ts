/**
 * `bun scripts/size.ts`: what the highlighter costs a page, minified and gzipped, every language
 * in it. Fails past the budget, so a grammar that bloats it is a decision, not an accident.
 */
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

/** KB, minified and gzipped: today's figure and a margin. */
const BUDGET = 11.8

const built = await Bun.build({
  entrypoints: [join(import.meta.dir, '..', 'src', 'index.ts')],
  minify: true,
  target: 'browser',
})
if (!built.success) throw new AggregateError(built.logs, 'build failed')
const code = await built.outputs[0]!.text()
const kb = gzipSync(code).length / 1024
const line = `${kb <= BUDGET ? '✓' : '✗'} @localix-ai/highlight  ${kb.toFixed(1)} KB / ${BUDGET} KB, ${(code.length / 1024).toFixed(1)} KB minified`
console.log(line)
if (kb > BUDGET) process.exit(1)
