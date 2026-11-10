/**
 * `llx-markdown/math`: `$…$`, `$$…$$` and a ```` ```math ```` fence typeset with KaTeX.
 *
 * Its own entry so that only a page that imports it bundles KaTeX (a quarter of a megabyte). Pass
 * it to `<Markdown math={…}>` directly, or as a loader so it is fetched the first time a document
 * holds a formula:
 *
 *     <Markdown math={() => import('llx-markdown/math')}>
 *
 * KaTeX's stylesheet is the page's to add (`import 'katex/dist/katex.min.css'`): a bundler-only
 * CSS import inside a library breaks the hosts that do not run one.
 */
import type { Extension, InlineState } from '../engine/types'
import { visit } from '../engine/visit'
import { closesInlineMath, opensInlineMath } from '../core/math-delimiters'
import { typesetMath } from './typeset'

export { typesetMath, type Typeset } from './typeset'

const DOLLAR = 36

/**
 * `$x$`, read the way a code span is: a run of dollars opens it, the next run of the same length
 * closes it, and nothing between them is Markdown. A single dollar also follows pandoc's rule
 * (`math-delimiters.ts`): `$ x $`, `$a$5` and a shell line's `$(seq 1 12) … $i` are text.
 */
function inlineMath(state: InlineState): boolean {
  const { text, pos } = state
  let open = pos
  while (text.charCodeAt(open) === DOLLAR) open++
  const size = open - pos
  if (size === 1 && !opensInlineMath(text, pos)) return false
  for (let at = text.indexOf('$', open); at !== -1; at = text.indexOf('$', at)) {
    let end = at
    while (text.charCodeAt(end) === DOLLAR) end++
    if (end - at === size && (size > 1 || closesInlineMath(text, at))) {
      let value = text.slice(open, at).replace(/\n/g, ' ')
      // One space of padding inside `$$ … $$` is not part of the formula.
      if (value.length > 2 && value.startsWith(' ') && value.endsWith(' ') && value.trim() !== '')
        value = value.slice(1, -1)
      state.push({ type: 'inlineMath', value })
      state.pos = end
      return true
    }
    at = end
  }
  return false
}

/** The math stage: what `<Markdown math>` takes. */
export const math: Extension = {
  name: 'math',
  mathFences: true,
  inline: [{ chars: '$', parse: inlineMath }],
  transform(root) {
    visit(root, (node) => {
      // GitHub's third way to write a display formula: a fence whose language is `math`.
      if (node.type === 'code' && node.lang === 'math') node.type = 'math'
      if (node.type !== 'inlineMath' && node.type !== 'math') return
      node.data = { ...node.data, ...typesetMath(node.value ?? '', node.type === 'math') }
    })
  },
}

export default math
