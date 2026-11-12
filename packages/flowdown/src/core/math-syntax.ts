/**
 * How a formula is written: `$…$`, `$$…$$` and a ```` ```math ```` fence, read into `inlineMath`
 * and `math` nodes that hold the LaTeX as written. What a formula is drawn as is the target's:
 * `@localix/flowdown/math` typesets it with KaTeX for a page, a terminal writes it in Unicode.
 */
import type { Extension, InlineRule, InlineState, Node } from '../engine/types'
import { visit } from '../engine/visit'
import { closesInlineMath, opensInlineMath } from './math-delimiters'

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

/** The inline rule of a formula. */
export const MATH_INLINE: InlineRule[] = [{ chars: '$', parse: inlineMath }]

/** A formula of a tree, with GitHub's third way to write a display one made one: a `math` fence. */
export function eachFormula(root: Node, each: (node: Node, display: boolean) => void): void {
  visit(root, (node) => {
    if (node.type === 'code' && node.lang === 'math') node.type = 'math'
    if (node.type === 'inlineMath' || node.type === 'math') each(node, node.type === 'math')
  })
}

/** Formulas read and left as their LaTeX: for a target that draws them its own way. */
export const mathSyntax: Extension = {
  name: 'math',
  mathFences: true,
  inline: MATH_INLINE,
  transform(root) {
    eachFormula(root, () => {})
  },
}
