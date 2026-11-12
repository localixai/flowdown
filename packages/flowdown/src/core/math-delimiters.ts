/**
 * When one `$` is a delimiter of inline math: pandoc's rule, which GitHub follows. The parser, the
 * KaTeX sniffer, the literal-dollar escaper and the streaming stabilizer all ask here, so they
 * agree about every `$`.
 *
 * - The opening `$` has something other than a space right after it.
 * - The closing `$` has something other than a space right before it, and no digit right after.
 *   An escaped `\$` closes nothing: it is a dollar sign inside the formula.
 *
 * So `$x$` is math, and `$ x $`, `$a$5` and a shell line's `$(seq 1 12) … $i` are not.
 */

const isSpace = (char: string | undefined) =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r'
const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9'

/** Whether a single `$` at `index` can open a formula. At the end of the text it cannot. */
export function opensInlineMath(text: string, index: number): boolean {
  const next = text[index + 1]
  return next !== undefined && next !== '$' && !isSpace(next)
}

/**
 * Whether a single `$` at `index` can close a formula. At the end of the text it can: a stream
 * that has not yet written the next character is read as if it ends there.
 */
export function closesInlineMath(text: string, index: number): boolean {
  const before = text[index - 1]
  if (before === undefined || isSpace(before) || before === '$' || isDigit(text[index + 1]))
    return false
  let slashes = 0
  while (text[index - 1 - slashes] === '\\') slashes += 1
  return slashes % 2 === 0
}
