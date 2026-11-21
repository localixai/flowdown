/**
 * `@localix-ai/flowdown/math`: `$…$`, `$$…$$` and a ```` ```math ```` fence as MathML, which the
 * browser lays out itself (`@localix-ai/math`, built in: 13 KB, no dependency).
 *
 * Its own entry so that only a page with formulas carries it. Pass it to `<Markdown math={…}>`
 * directly, or as a loader so it is fetched the first time a document holds a formula:
 *
 *     <Markdown math={() => import('@localix-ai/flowdown/math')}>
 *
 * The math font and its few rules are the page's to add (`import '@localix-ai/flowdown/math.css'`):
 * a bundler-only CSS import inside a library breaks the hosts that do not run one.
 */
import type { Extension } from '../engine/types'
import { eachFormula, MATH_INLINE } from '../core/math-syntax'
import { typesetMath } from './typeset'

export { typesetMath, type Typeset } from './typeset'

/** The math stage: what `<Markdown math>` takes. */
export const math: Extension = {
  name: 'math',
  mathFences: true,
  inline: MATH_INLINE,
  transform(root) {
    eachFormula(root, (node, display) => {
      node.data = { ...node.data, ...typesetMath(node.value ?? '', display) }
    })
  },
}

export default math
