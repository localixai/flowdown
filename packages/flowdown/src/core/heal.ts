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

/** A trailing half-written image (`![alt](partial-url`, `![alt]` or `![alt`) is hidden — a
 * broken-image flash is worse than a beat of nothing. So is the `[` of the link it stands in,
 * when it is a badge (`[![alt](src)](href)`); and a badge whose image is written and whose link
 * is not, `[![alt](src)` or `[![alt](src)]`, is drawn as its image, without the brackets that
 * make it a link a few tokens later. */
function dropTrailingPartialImage(tail: string): string {
  return tail
    .replace(/\[?!\[[^\]]*(\](\([^)]*)?)?$/, '')
    .replace(/\[(!\[[^\]]*\]\([^)]*\))\]?$/, '$1')
}

/**
 * A footnote reference still being typed (`[^`, `[^note`) is hidden until its `]`: `[^` opens
 * nothing but a reference, so the text it hides was never prose. Inside an open code span it is
 * code, and stays.
 */
function dropTrailingPartialFootnote(tail: string): string {
  const open = /\[\^[^\]\s]*$/.exec(tail)
  const before = open ? tail.slice(0, open.index) : tail
  // An odd number of backticks before it: an open code span.
  return before.split('`').length % 2 ? before : tail
}

/** A trailing `[text](partial-url` gets its `)` so the anchor text renders as a
 * link immediately instead of flashing raw syntax until the URL completes. The text may be a
 * badge's image. */
function closeTrailingLink(tail: string): string {
  return /(^|[^!])\[(?:[^\]]*|!\[[^\]]*\]\([^)]*\))\]\([^)]*$/.test(tail) ? `${tail})` : tail
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

/** A row of dashes under a header still being typed: pipes, colons, dashes and space, one pipe. */
const PARTIAL_DELIMITER = /^ {0,3}[|:\- \t]*\|[|:\- \t]*$/

/**
 * The row of dashes under a table's header (`|--`, `| --- | -`) is held back while it is the line
 * being typed: drawn as it comes it prints under the header as text, and a token later both turn
 * into a table. Only under a line with a pipe in it: a row of dashes is never prose.
 */
function dropTrailingPartialDelimiterRow(text: string): string {
  const nl = text.lastIndexOf('\n')
  if (nl <= 0 || !PARTIAL_DELIMITER.test(text.slice(nl + 1))) return text
  const header = text.slice(text.lastIndexOf('\n', nl - 1) + 1, nl)
  return header.includes('|') && !PARTIAL_DELIMITER.test(header) ? text.slice(0, nl + 1) : text
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
  // `trimEnd`, not `/\s+$/`: the pattern is tried at every run of blank space in the text.
  const trimmed = text.trimEnd()
  const nl = trimmed.lastIndexOf('\n')
  const quoted = /^\s{0,3}>[ \t]?(.*)$/.exec(trimmed.slice(nl + 1))
  if (!quoted || !parseContainerMarker(quoted[1]!.trim())) return text
  return nl === -1 ? '' : trimmed.slice(0, nl + 1)
}

/**
 * A last line that is so far only the marker of a block (`-`, `*`, `+`, `##`, `12.`, `>`), or a run
 * of `-` or `=`, is held back until the first word of what it opens. Drawn at once it is an empty
 * list item, heading or quote for a frame; and a `-` under a paragraph is read as the line that
 * makes the paragraph a heading, so the paragraph flashes as one until the item's text arrives.
 * The marker is shown with that word, a token later.
 */
// Inside a quote too (`> -`): the dialect's forms are quotes, and their lists and headings are in them.
// A task's box before its first word (`- [`, `- [x`, `1. [ ]`) is the item's marker too: drawn, it
// is an item reading "[x" a token before it is a checkbox.
const BARE_BLOCK_MARKER =
  /^[ \t]*(?:>[ \t]?)*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+\[[ xX]?\]?|[-*+=]+|#{1,6}|\d{1,9}[.)]?|>)[ \t]*$/

function dropTrailingBareBlockMarker(text: string): string {
  const nl = text.lastIndexOf('\n')
  // A marker is short: a long last line is read no further.
  if (text.length - nl > 16) return text
  return BARE_BLOCK_MARKER.test(text.slice(nl + 1)) ? text.slice(0, nl + 1) : text
}

/** A bullet item's first line: one ends the paragraph above it, whatever that paragraph holds. */
const BULLET_LINE = /^ {0,3}[-*+][ \t]+\S/

/**
 * Where the last paragraph of `text` starts: after its last blank line, or at its last line that
 * starts a bullet item, which no inline construct runs across. A long list with no blank line in
 * it is one run of lines; read from the item being written, a token costs that item, not the list.
 */
function lastParagraph(text: string): number {
  const blank = text.lastIndexOf('\n\n')
  const from = blank === -1 ? 0 : blank + 2
  for (let at = text.lastIndexOf('\n'); at >= from; at = text.lastIndexOf('\n', at - 1)) {
    if (BULLET_LINE.test(text.slice(at + 1, at + 16))) return at + 1
    if (at === 0) break
  }
  return from
}

export function closePartialMarkdown(text: string): string {
  if (!text) return text

  // Inside an unterminated fence: close it and skip inline fixes — everything
  // after the opener is code, where emphasis/link syntax has no meaning.
  const fence = openFence(text)
  if (fence) return `${text}${text.endsWith('\n') ? '' : '\n'}${fence.indent}${fence.marker}`
  return closePartialProse(text)
}

/**
 * `closePartialMarkdown` for a text known to end outside a fenced code block: the renderer asks
 * its own scanner about the fence, and comes here with the answer.
 */
export function closePartialProse(text: string): string {
  return healProse(text).text
}

/**
 * `closePartialProse`, and how much of the text it left as it was: the healed text starts with
 * `kept` characters of the text. Every step holds back an end or completes the last paragraph, so
 * what is above is the same; a document that checked the text against the last one knows, from
 * this, how much of what it splits it checked too.
 */
export function healProse(text: string): { text: string; kept: number } {
  if (!text) return { text, kept: 0 }
  const cut = (healed: string) => ({ text: healed, kept: healed.length })

  // A half-typed table row is its own kind of flash — hide it. The active edit
  // is that row, so there's nothing else to stabilize this frame.
  const detabled = dropTrailingPartialTableRow(text)
  if (detabled !== text) return cut(detabled)
  // The row of dashes that would make a table of the line above it, still being typed.
  const delimited = dropTrailingPartialDelimiterRow(text)
  if (delimited !== text) return healProse(delimited)
  // Same for a callout marker still being typed on its quote line.
  const unmarked = dropTrailingPartialCalloutMarker(text)
  if (unmarked !== text) return cut(unmarked)
  const bare = dropTrailingBareFormMarker(text)
  if (bare !== text) return cut(bare)
  // The text above a marker held back may itself end mid-construct (`**bold` on the line before).
  const held = dropTrailingBareBlockMarker(text)
  if (held !== text) return healProse(held)

  // Inline constructs cannot span a blank line, so only the last paragraph can
  // be dangling — operate on it alone and keep the rest byte-identical.
  const splitAt = lastParagraph(text)
  const head = text.slice(0, splitAt)
  let tail = text.slice(splitAt)
  if (!tail) return { text, kept: text.length }
  // What is completed goes where the text stops, before the line break or the space it may end
  // in: `**` after a line break opens nothing and closes nothing, and shows, with the `**` it was
  // to close (`A **long bold⏎`).
  let end = tail.length
  while (end > 0 && /\s/.test(tail[end - 1]!)) end -= 1
  const after = end === tail.length ? '' : tail.slice(end)
  if (after) tail = tail.slice(0, end)

  tail = dropTrailingPartialImage(tail)
  tail = dropTrailingPartialFootnote(tail)
  tail = withholdPartialMath(tail)
  tail = closeTrailingLink(tail)
  tail = balanceInlineCode(tail)
  tail = balanceDoubleDelimiter(tail, '**')
  tail = balanceDoubleDelimiter(tail, '~~')
  tail = balanceSingleEmphasis(tail, '*')
  tail = balanceSingleEmphasis(tail, '_')
  tail += after
  // Nothing to complete: the very text, so a long reply is not copied on every token.
  if (head.length + tail.length === text.length && text.endsWith(tail))
    return { text, kept: text.length }
  // What was hidden may leave a marker bare (`- *` is `- `): it is held back as one typed so.
  const healed = dropTrailingBareBlockMarker(head + tail)
  return { text: healed, kept: Math.min(splitAt, healed.length) }
}
