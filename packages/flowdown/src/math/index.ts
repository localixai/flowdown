/**
 * `flowdown/math`: `$…$`, `$$…$$` and a ```` ```math ```` fence typeset with KaTeX.
 *
 * Its own entry so that only a page that imports it bundles KaTeX (a quarter of a megabyte). Pass
 * it to `<Markdown math={…}>` directly, or as a loader so it is fetched the first time a document
 * holds a formula:
 *
 *     <Markdown math={() => import('flowdown/math')}>
 *
 * KaTeX's stylesheet is the page's to add (`import 'katex/dist/katex.min.css'`): a bundler-only
 * CSS import inside a library breaks the hosts that do not run one.
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
