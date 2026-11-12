/**
 * Streaming-tail markdown stabilization.
 *
 * While a reply streams, the accumulated markdown frequently ends mid-construct:
 * an unterminated ``` fence renders the partial code as raw text, a dangling
 * `**` or backtick shows literal markers, a half-typed `[link](url` shows raw
 * syntax — and each of these "pops" into its formatted form a few frames later
 * once the model closes it. `closePartialMarkdown` conservatively completes
 * (or hides) those trailing constructs so the streamed view stays visually
 * stable. It is applied ONLY while streaming; the final text renders verbatim.
 */
import { parseContainerMarker } from '../dialect'
import { inlineMathClose, isLiteralDollar } from './dollars'
import { openFence } from './fence-scan'
import { opensInlineMath } from './math-delimiters'
import { isEscaped } from './prose'

/** Whether a stabilized fence is the one incomplete body still being written. */
export function isGrowingFence(growing: string | null, source: string): boolean {
  return growing !== null && growing.trimEnd() === source.trimEnd()
}

/**
 * The body of the fence a streaming text ends inside, or null when every fence is closed.
 *
 * Only the LAST fence can be unterminated, so this is how a renderer tells the one block that is
 * still being written from the finished blocks above it — a diagram above the tail is complete
 * and can be drawn now, instead of waiting for the whole reply to settle.
 */
export function openFenceBody(text: string): string | null {
  const fence = openFence(text)
  return fence ? text.slice(fence.bodyStart) : null
}

/** A trailing half-written image (`![alt](partial-url` or `![alt`) is hidden — a
 * broken-image flash is worse than a beat of nothing. */
function dropTrailingPartialImage(tail: string): string {
  return tail.replace(/!\[[^\]]*(\]\([^)]*)?$/, '')
}

/** A trailing `[text](partial-url` gets its `)` so the anchor text renders as a
 * link immediately instead of flashing raw syntax until the URL completes. */
function closeTrailingLink(tail: string): string {
  return /(^|[^!])\[[^\]]*\]\([^)]*$/.test(tail) ? `${tail})` : tail
}

/**
 * Code spans and CLOSED formulas blanked to spaces, positions kept. Emphasis has no meaning
 * inside either, and the balancers below would otherwise read `$a*b$` or `$x_i$` as an open
 * emphasis and append a stray `*` or `_` to the streaming tail.
 */
function maskInert(tail: string): string {
  const blank = (span: string) => ' '.repeat(span.length)
  return tail.replace(/`[^`]*`/g, blank).replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, blank)
}

/**
 * A formula still being typed is withheld from its opening `$` until the closing one arrives.
 * Math is typeset while a reply streams, so a half-typed `$\frac{a}{` would otherwise print as
 * raw LaTeX and then jump into a formula. Dollars are paired by the renderer's own rule
 * (`literalDollars`, `math-delimiters.ts`), so the two never disagree about one `$`: a price, a
 * shell variable or a `$` with a space after it (`5$ and`) opens nothing and hides nothing.
 *
 * Only the first `$` left open is withheld, and only while no `$` follows it: a `$` that came and
 * did not close it (the shell line `$(seq 1 12); do printf "%s" $i`) shows these dollars are text.
 */
function withholdPartialMath(tail: string): string {
  const code = tail.replace(/`[^`]*`/g, (span) => ' '.repeat(span.length))
  const displays: number[] = []
  for (let index = code.indexOf('$$'); index !== -1; index = code.indexOf('$$', index + 2)) {
    if (!isEscaped(code, index)) displays.push(index)
  }
  if (displays.length % 2 === 1) return tail.slice(0, displays.at(-1)).trimEnd()

  const inline = code.replace(/\$\$[\s\S]*?\$\$/g, (span) => ' '.repeat(span.length))
  for (let index = inline.indexOf('$'); index !== -1; index = inline.indexOf('$', index + 1)) {
    if (isEscaped(inline, index) || isLiteralDollar(inline, index)) continue
    // The last character: the one after it, which says whether it opens, is not written yet.
    const last = index === inline.length - 1
    if (!last && !opensInlineMath(inline, index)) continue
    const close = last ? -1 : inlineMathClose(inline, index)
    if (close !== -1) {
      index = close
      continue
    }
    return inline.includes('$', index + 1) ? tail : tail.slice(0, index).trimEnd()
  }
  return tail
}

/** Balance inline code: an odd number of backticks means an open span. A bare
 * trailing opener is stripped (closing it would render an empty span as
 * literal ``` `` ```); an opener with content gets closed. */
function balanceInlineCode(tail: string): string {
  const count = (tail.replace(/\\`/g, '').match(/`/g) ?? []).length
  if (count % 2 === 0) return tail
  return tail.endsWith('`') ? tail.slice(0, -1) : `${tail}\``
}

/** Balance a two-char emphasis delimiter (`**` / `~~`). Occurrences inside
 * inline code spans are ignored. A bare trailing opener is stripped (closing
 * an empty pair would render four literal characters); one with content after
 * it gets closed. */
function balanceDoubleDelimiter(tail: string, delim: string): string {
  const stripped = maskInert(tail)
  let count = 0
  for (let i = 0; (i = stripped.indexOf(delim, i)) !== -1; i += delim.length) count += 1
  if (count % 2 === 0) return tail
  return tail.endsWith(delim) ? tail.slice(0, -delim.length) : `${tail}${delim}`
}

const WORD_RE = /\w/

/**
 * Balance a single-char emphasis delimiter (`*` or `_`) — the most common
 * mid-stream flash after `**`: `*italic` shows the literal `*` until the model
 * closes it, then pops into italics. We append the missing closer so it renders
 * as emphasis immediately.
 *
 * The danger is false positives — a wrongly appended `*`/`_` italicises text the
 * author never marked up. So we count ONLY "emphasis-capable" lone delimiters:
 *   - runs of length ≥ 2 are skipped (they belong to `**`/`__`/`~~` handling);
 *   - inside inline code is masked out;
 *   - `*` counts only when it touches a word char on one side — excludes globs
 *     (`*.ts`), multiplication (`a * b`) and bullets (`* item`), where the `*` is
 *     flanked by whitespace/punctuation;
 *   - `_` additionally requires the word char to be on the OPENING side only —
 *     so intraword underscores (`file_name`, `__init__`, `snake_case`) never
 *     count, matching CommonMark's "no intraword `_` emphasis" rule.
 * An odd active count ⇒ a trailing opener is dangling: append one closer (or
 * strip a bare trailing opener, mirroring the double-delimiter rule).
 */
function balanceSingleEmphasis(tail: string, char: '*' | '_'): string {
  const masked = maskInert(tail)
  let active = 0
  let i = 0
  while (i < masked.length) {
    if (masked[i] !== char) {
      i += 1
      continue
    }
    let j = i
    while (j < masked.length && masked[j] === char) j += 1
    if (j - i === 1) {
      const prevWord = WORD_RE.test(masked[i - 1] ?? '')
      const nextWord = WORD_RE.test(masked[j] ?? '')
      const counts =
        char === '*' ? prevWord || nextWord : (!prevWord && nextWord) || (prevWord && !nextWord)
      if (counts) active += 1
    }
    i = j
  }
  if (active % 2 === 0) return tail
  return tail.endsWith(char) ? tail.slice(0, -1) : `${tail}${char}`
}

const ROW_START = /^\s{0,3}\|/
/** The row of dashes under a table's header: `|---|:--:|`, its outer pipes optional. */
const DELIMITER_ROW = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/

/** Hide only a partial row of an already established GFM table. A line starting
 * with `|` outside a table may be ordinary prose and must remain visible. */
function dropTrailingPartialTableRow(text: string): string {
  if (text.endsWith('\n')) return text
  const nl = text.lastIndexOf('\n')
  if (nl === -1 || !ROW_START.test(text.slice(nl + 1))) return text

  // Up the lines above, one at a time: the rows of the table, to the row of dashes under its
  // header. The reply is not cut into its lines; a long one would be on every token of a row.
  for (let end = nl; end > 0;) {
    const start = text.lastIndexOf('\n', end - 1) + 1
    // The first line of the text has no header above it.
    if (start === 0) break
    const line = text.slice(start, end)
    if (DELIMITER_ROW.test(line)) {
      const above = start === 1 ? 0 : text.lastIndexOf('\n', start - 2) + 1
      return ROW_START.test(text.slice(above, start - 1)) ? text.slice(0, nl) : text
    }
    if (!ROW_START.test(line)) break
    end = start - 1
  }
  return text
}

/**
 * A quote line that is still typing its callout marker (`> [`, `> [!`, `> [!WARN`) is hidden
 * until the `]` arrives: it would otherwise print as a grey quote reading "[!WARN" and a beat
 * later turn into a note. A complete marker is kept — it already renders as the empty note.
 */
function dropTrailingPartialCalloutMarker(text: string): string {
  const nl = text.lastIndexOf('\n')
  const lastLine = text.slice(nl + 1)
  if (!/^\s{0,3}>[ \t]?\[(?:!\w*)?$/.test(lastLine)) return text
  return nl === -1 ? '' : text.slice(0, nl)
}

/**
 * A form's marker that arrived before its content (`> [!STEPS]` and nothing yet) is hidden: alone,
 * it is a quote reading "[!STEPS]", and the steps replace it a token later. Hidden only while
 * nothing follows it but blank space; once the list starts, the form renders.
 */
function dropTrailingBareFormMarker(text: string): string {
  const trimmed = text.replace(/\s+$/, '')
  const nl = trimmed.lastIndexOf('\n')
  const quoted = /^\s{0,3}>[ \t]?(.*)$/.exec(trimmed.slice(nl + 1))
  if (!quoted || !parseContainerMarker(quoted[1]!.trim())) return text
  return nl === -1 ? '' : trimmed.slice(0, nl + 1)
}

export function closePartialMarkdown(text: string): string {
  if (!text) return text

  // Inside an unterminated fence: close it and skip inline fixes — everything
  // after the opener is code, where emphasis/link syntax has no meaning.
  const fence = openFence(text)
  if (fence) return `${text}${text.endsWith('\n') ? '' : '\n'}${fence.marker}`
  return closePartialProse(text)
}

/**
 * `closePartialMarkdown` for a text known to end outside a fenced code block: the renderer asks
 * its own scanner about the fence, and comes here with the answer.
 */
export function closePartialProse(text: string): string {
  if (!text) return text

  // A half-typed table row is its own kind of flash — hide it. The active edit
  // is that row, so there's nothing else to stabilize this frame.
  const detabled = dropTrailingPartialTableRow(text)
  if (detabled !== text) return detabled
  // Same for a callout marker still being typed on its quote line.
  const unmarked = dropTrailingPartialCalloutMarker(text)
  if (unmarked !== text) return unmarked
  const bare = dropTrailingBareFormMarker(text)
  if (bare !== text) return bare

  // Inline constructs cannot span a blank line, so only the last paragraph can
  // be dangling — operate on it alone and keep the rest byte-identical.
  const splitAt = text.lastIndexOf('\n\n')
  const head = splitAt === -1 ? '' : text.slice(0, splitAt + 2)
  let tail = splitAt === -1 ? text : text.slice(splitAt + 2)
  if (!tail) return text

  tail = dropTrailingPartialImage(tail)
  tail = withholdPartialMath(tail)
  tail = closeTrailingLink(tail)
  tail = balanceInlineCode(tail)
  tail = balanceDoubleDelimiter(tail, '**')
  tail = balanceDoubleDelimiter(tail, '~~')
  tail = balanceSingleEmphasis(tail, '*')
  tail = balanceSingleEmphasis(tail, '_')
  // Nothing to complete: the very text, so a long reply is not copied on every token.
  if (head.length + tail.length === text.length && text.endsWith(tail)) return text
  return head + tail
}
