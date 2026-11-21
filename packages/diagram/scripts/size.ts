/**
 * `bun scripts/size.ts`: what each entry of the package costs a page, minified and gzipped, held to
 * `budgets.json`'s `size` (KB). Fails past a budget, so growth is a decision, not an accident.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const name = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name as string
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8')).size as Record<
  string,
  number
>

let failed = false
for (const [entry, budget] of Object.entries(budgets)) {
  const built = await Bun.build({
    entrypoints: [join(root, 'src', `${entry}.ts`)],
    minify: true,
    target: 'browser',
  })
  if (!built.success) throw new AggregateError(built.logs, `${entry}: build failed`)
  const code = await built.outputs[0]!.text()
  const kb = gzipSync(code).length / 1024
  const ok = kb <= budget
  failed ||= !ok
  console.log(
    `${ok ? '✓' : '✗'} ${name}${entry === 'index' ? '' : `/${entry}`}  ${kb.toFixed(1)} KB / ${budget} KB, ${(code.length / 1024).toFixed(1)} KB minified`,
  )
}
if (failed) process.exit(1)
