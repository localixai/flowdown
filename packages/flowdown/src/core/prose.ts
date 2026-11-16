/**
 * Which characters of a markdown source are prose — the text outside fenced, indented and inline
 * code — as one mask the math sniffer, the HTML sniffer and the literal-dollar escaper all read.
 *
 * The mask keeps the source's exact length and line breaks: code characters become spaces, so an
 * index into the mask is an index into the source. The escaper depends on that — it inserts a
 * backslash at a position found in the mask — and a mask that dropped code lines (as the first
 * version here did) would shift every position after the first code block.
 */
import { codeRanges } from '../engine/code-ranges'

export function markdownProseWithoutCode(markdown: string, mathFences = true): string {
  // Nothing here can be code: no backtick or tilde run, no line indented four.
  if (!CODE_HINT.test(markdown)) return markdown
  // The blocks as the parser reads them. A scan of lines alone does not know what holds a fence:
  // under a list item a fence indented four is a fence, not indented code, and the scan took the
  // line that closes it for one that opens another, and all the text after it for code. Nor does
  // it know where a block ends: a backtick run in one paragraph and one in an HTML block below
  // it are not a code span, and were blanked as one with every line between them.
  // `mathFences`: read as a page that typesets math reads it, where `$$` fences a formula.
  const { code, inline } = codeRanges(markdown, mathFences)
  let out = ''
  let kept = 0
  // Both lists are in the order of the text, and a code block and a run of text never share a
  // line: walked together, each range is taken once, in order.
  for (let c = 0, i = 0; c < code.length || i < inline.length;) {
    const isCode = i >= inline.length || (c < code.length && code[c]! < inline[i]!)
    const from = Math.max(kept, isCode ? code[c]! : inline[i]!)
    const to = isCode ? code[c + 1]! : inline[i + 1]!
    if (isCode) c += 2
    else i += 2
    if (to <= from) continue
    const own = markdown.slice(from, to)
    out += markdown.slice(kept, from) + (isCode ? own.replace(NOT_NEWLINE, ' ') : withoutSpans(own))
    kept = to
  }
  return kept === 0 ? out + markdown : out + markdown.slice(kept)
}

/**
 * The text of one block with its code spans blanked. A span may cross line breaks inside the
 * block; only complete spans are blanked, and an unmatched backtick stays prose, as CommonMark
 * reads it.
 */
function withoutSpans(source: string): string {
  if (source.indexOf('`') === -1) return source
  let visible = ''
  let copied = 0
  for (let index = source.indexOf('`'); index !== -1; index = source.indexOf('`', index)) {
    if (isEscaped(source, index)) {
      index += 1
      continue
    }
    let delimiterLength = 1
    while (source[index + delimiterLength] === '`') delimiterLength += 1
    let closing = source.indexOf('`', index + delimiterLength)
    while (closing !== -1) {
      if (isEscaped(source, closing)) {
        closing = source.indexOf('`', closing + 1)
        continue
      }
      let closingLength = 1
      while (source[closing + closingLength] === '`') closingLength += 1
      if (closingLength === delimiterLength) break
      closing = source.indexOf('`', closing + closingLength)
    }
    if (closing === -1) {
      index += delimiterLength
      continue
    }
    const end = closing + delimiterLength
    visible += source.slice(copied, index) + source.slice(index, end).replace(NOT_NEWLINE, ' ')
    copied = end
    index = end
  }
  return copied === 0 ? source : visible + source.slice(copied)
}

const CODE_HINT = /`|~~~|^(?: {4}|\t)/m
const NOT_NEWLINE = /[^\n]/g

/** Whether the character at `index` is backslash-escaped (an odd run of `\` before it). */
export function isEscaped(text: string, index: number): boolean {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}
