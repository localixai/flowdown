import { closesInlineMath, opensInlineMath } from './math-delimiters'
import { isEscaped, markdownProseWithoutCode } from './prose'

/**
 * Which `$` in a reply is a dollar sign rather than a math delimiter — one rule for the renderer
 * and for the streaming stabilizer.
 *
 * remark-math pairs ANY two single dollars in a paragraph, so the moment a reply held one real
 * formula, "costs $5 and $10" was typeset as the formula `5 and`, and "$HOME/bin and $PATH" became
 * italic math that also swallowed the backticks after it. The sniffer that decides whether to load
 * KaTeX already knew better; the parser did not. So the literal dollars are escaped (`\$`) before
 * the parser sees them, which CommonMark renders as a plain `$` — and the rule is kept here, once,
 * because the stabilizer must make the same call about the dollar a streaming tail ends on.
 */

/** A currency amount: digits, an optional magnitude, then a non-math character (`/` for a price per
 * unit, `$5/GB`) or the end. */
const CURRENCY = /^\d[\d.,]*(?:[kKmMbB])?(?=[\s.,;:!?)\]'"`–—/-]|$)/
/** A shell or environment variable: an upper-case name, ended by a path or list separator. */
const VARIABLE = /^[A-Z_][A-Z0-9_]+(?=[/:.,;)\]'"`]|$)/
/** A longer upper-case name also ends at a space (`$PATH before`); `$AB = CD$` stays math. */
const LONG_VARIABLE = /^[A-Z_][A-Z0-9_]{2,}(?=\s)/

/** A sign only math writes: what a formula that starts with a number shows itself by. */
const MATH_SIGN = /[=^_\\{}<>]/

/**
 * Whether the `$` at `index` is a dollar sign: a price or a shell variable by its own look. A
 * formula may start with a number too (`$2 + 2 = 4$`): a price-looking `$` still opens one when
 * a `$` of no such look closes it in its paragraph and what lies between holds a sign only math
 * writes and no other `$`, which "$5 and $10", "pay $5 now and 7$ later" and "from $5 for $n^2$"
 * do not. A `$` that pairs with no other
 * (`$ x`, the shell line `$(seq 1 12) … $i`) is text as well, but that takes the whole paragraph
 * to tell: `literalDollars` asks both.
 */
export function isLiteralDollar(text: string, index: number): boolean {
  if (!looksLiteral(text, index)) return false
  if (!CURRENCY.test(text.slice(index + 1, index + 48)) || !opensInlineMath(text, index))
    return true
  const close = inlineMathClose(text, index)
  if (close === -1) return true
  const inner = text.slice(index + 1, close)
  return inner.includes('$') || !MATH_SIGN.test(inner)
}

/** A dollar sign by its own look: a price or a variable, whatever follows in the paragraph. */
function looksLiteral(text: string, index: number): boolean {
  if (text[index] !== '$' || isEscaped(text, index)) return false
  // `$$` is display math, never a dollar sign.
  if (text[index - 1] === '$' || text[index + 1] === '$') return false
  const after = text.slice(index + 1, index + 48)
  return CURRENCY.test(after) || VARIABLE.test(after) || LONG_VARIABLE.test(after)
}

/** A single `$`, neither escaped nor part of a `$$` run. */
const isSingleDollar = (text: string, index: number) =>
  text[index] === '$' &&
  text[index - 1] !== '$' &&
  text[index + 1] !== '$' &&
  !isEscaped(text, index)

/** Where the paragraph holding `index` ends: inline math never crosses a blank line. */
function paragraphEnd(text: string, index: number): number {
  const blank = /\n[ \t]*\n/g
  blank.lastIndex = index
  return blank.exec(text)?.index ?? text.length
}

/**
 * The single `$` that closes the formula opened at `open`, or -1 when none in its paragraph does.
 * A dollar sign by its look (`$5`) is skipped: it is text, so it closes nothing.
 */
export function inlineMathClose(text: string, open: number): number {
  const end = paragraphEnd(text, open)
  for (
    let at = text.indexOf('$', open + 1);
    at !== -1 && at < end;
    at = text.indexOf('$', at + 1)
  ) {
    if (isSingleDollar(text, at) && !looksLiteral(text, at) && closesInlineMath(text, at)) return at
  }
  return -1
}

/**
 * Every single `$` in prose that is text rather than a delimiter, read left to right the way the
 * parser reads them: a price or a variable, a `$` that cannot open (`$ x`), and one that opens but
 * finds no closing `$` in its paragraph. A `$` that closes a formula is not in the list.
 */
export function literalDollars(prose: string): number[] {
  const literal: number[] = []
  for (let index = prose.indexOf('$'); index !== -1; index = prose.indexOf('$', index + 1)) {
    if (prose[index + 1] === '$') {
      // A `$$` run is display math, or the parser's to pair by length: skip the whole run.
      while (prose[index + 1] === '$') index += 1
      continue
    }
    if (!isSingleDollar(prose, index)) continue
    const close =
      isLiteralDollar(prose, index) || !opensInlineMath(prose, index)
        ? -1
        : inlineMathClose(prose, index)
    if (close === -1) literal.push(index)
    else index = close
  }
  return literal
}

/**
 * The source with every dollar in prose that is not a delimiter escaped (`\$`), so a parser
 * that pairs any two dollars (remark-math) reads the same formulas `<Markdown>` does. Code is left
 * byte for byte.
 */
export function escapeLiteralDollars(markdown: string): string {
  if (!markdown.includes('$')) return markdown
  const literal = literalDollars(markdownProseWithoutCode(markdown))
  if (literal.length === 0) return markdown
  let escaped = ''
  let copied = 0
  for (const index of literal) {
    escaped += `${markdown.slice(copied, index)}\\`
    copied = index
  }
  return escaped + markdown.slice(copied)
}
