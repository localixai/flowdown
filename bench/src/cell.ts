/**
 * `bun src/cell.ts <scenario> <pattern> <renderer> <runs> <budgetMs>`: one cell of the table, in a
 * process of its own. The orchestrator (`run.ts`) starts one per cell, so no cell runs on a heap
 * another left behind, or after another warmed the code it calls: every renderer starts equal.
 *
 * In it: one warm-up on the first 200 updates, then `runs` measured streams of the whole reply.
 * Prints the runs as one line of JSON.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { type Pattern, prefixes } from '../../packages/flowdown/test/chunks'
import { scaling, scenarios } from '../../packages/flowdown/test/replies'
import { installIdleTracking } from './idle'

GlobalRegistrator.register({ url: 'https://bench.test/' })
installIdleTracking()
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
// Loaded after the DOM exists: React DOM and the renderers read `window` when imported.
const { RENDERERS } = await import('./renderers')
const { measure } = await import('./measure')

const [name, pattern, rendererName, runs, budgetMs] = process.argv.slice(2)
const scenario = [...scenarios(), ...scaling()].find((s) => s.name === name)
const renderer = RENDERERS.find((r) => r.name === rendererName)
if (!scenario || !renderer) {
  console.error(`unknown scenario or renderer: ${name}, ${rendererName}`)
  process.exit(2)
}
const steps = prefixes(scenario.text, pattern as Pattern)
const history = scenario.history ?? []
await measure(renderer, history, steps.slice(0, 200), Number(budgetMs))
const results = []
for (let run = 0; run < Number(runs); run++) {
  results.push(await measure(renderer, history, steps, Number(budgetMs)))
}
console.log(JSON.stringify(results))
// Not unregistered: React may still have passive work queued that reads `window`.
process.exit(0)
