import { inlineMathClose, isLiteralDollar } from './dollars'
import { opensInlineMath } from './math-delimiters'
import { isEscaped, markdownProseWithoutCode } from './prose'

/**
 * Whether the prose holds a formula, so KaTeX is worth loading: a `$$…$$` pair, or a single-dollar
 * pair by the parser's rule (`math-delimiters.ts`). Prices, shell variables and code do not count.
 */
export function hasMathSyntax(markdown: string): boolean {
  if (!markdown.includes('$')) return false
  const text = markdownProseWithoutCode(markdown)

  for (let index = text.indexOf('$'); index !== -1; index = text.indexOf('$', index + 1)) {
    if (isEscaped(text, index)) continue
    if (text[index + 1] === '$') {
      const closing = text.indexOf('$$', index + 2)
      if (closing !== -1 && text.slice(index + 2, closing).trim()) return true
      index = closing === -1 ? index + 1 : closing + 1
      continue
    }
    if (text[index - 1] === '$' || isLiteralDollar(text, index)) continue
    if (opensInlineMath(text, index) && inlineMathClose(text, index) !== -1) return true
  }

  return false
}

/** Raw HTML only matters in prose. Tags shown inside fenced/indented/inline code
 * stay literal, so they must not enable the full rehype-raw + sanitize pipeline. */
export function hasHtmlSyntax(markdown: string): boolean {
  const tag = /<[a-zA-Z][\w-]*[\s/>]/
  // A tag in the prose starts with `<` and a letter that are prose, so the same two characters
  // are in the text. Without them the mask, which parses the text, is not made: most blocks have
  // none. (Not `tag` itself: the mask blanks code to spaces, and `<div` before a code span
  // matches it only there.)
  if (!/<[a-z]/i.test(markdown)) return false
  // Whether a `$$` line fences a formula moves where code is, and the page may typeset math or
  // not: a tag that is prose in either reading is HTML. Only a text with `$$` reads two ways.
  return (
    tag.test(markdownProseWithoutCode(markdown)) ||
    (markdown.includes('$$') && tag.test(markdownProseWithoutCode(markdown, false)))
  )
}
