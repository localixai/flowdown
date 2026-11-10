/**
 * Splitting a document into top-level blocks that can be rendered, and remembered, one by one.
 *
 * A streaming reply grows at its end, and re-rendering the whole of it on every token is work
 * proportional to its length, repeated per token. Cut at its top-level blocks instead, every block
 * but the last is text that no longer changes: a renderer that memoizes each block by its source
 * parses and reconciles only the tail.
 *
 * The cut must never change the result, so the text is cut only where one parse of the whole
 * document is certain to start a new top-level block, and a block is merged with its neighbours
 * wherever that parse would read them together:
 *   - the dialect's forms: a marker-only quote (`> [!STEPS]`) governs the list after it, `[!TABS]`
 *     the run of sections after it, and a `[!PROS]` right before a `[!CONS]` is one pair;
 *   - an image alone in its paragraph and an emphasis-only line under it, its caption;
 *   - an HTML block whose tag is closed further down;
 *   - a `$$` display formula with blank lines inside;
 *   - a document with footnote or link reference definitions, which resolve across blocks, is
 *     not split at all.
 *
 * The boundaries are found by a scan of the lines (`step`), not by a Markdown lexer: it follows
 * only what decides where a top-level block can end (a fence, a list, an HTML block that blank
 * lines do not end), and where it cannot tell, it stops cutting for the rest of the document.
 * Merging is always safe, a wrong cut never is. The tests render a corpus both ways and require
 * the same markup, at every prefix.
 */
import { parseContainerMarker, type ContainerKind } from '../dialect'

export interface MarkdownBlock {
  /** The block's own source. */
  source: string
  /** Where it starts in the document: characters before it, and its 1-based line. */
  offset: number
  line: number
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const INNER_FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/
const ITEM = /^( {0,3})([-+*]|\d{1,9}[.)])(.*)$/
/** A list item that may interrupt a paragraph: a bullet, or the number 1, with text after it. */
const INTERRUPTING_ITEM = /^ {0,3}(?:[-+*]|1[.)]) +\S/
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/
const UNDERLINE = /\n {0,3}(?:=+|-+)[ \t]*(?:\n|$)/
const QUOTE = /^ {0,3}>[ \t]?(.*)$/
/** HTML blocks that a blank line does not end: how each opens, and what closes it. */
const LONG_HTML: ReadonlyArray<readonly [RegExp, RegExp]> = [
  [/^ {0,3}<(?:pre|script|style|textarea)(?=[\s>]|$)/i, /<\/(?:pre|script|style|textarea)>/i],
  [/^ {0,3}<!--/, /-->/],
  [/^ {0,3}<\?/, /\?>/],
  [/^ {0,3}<!\[CDATA\[/, /\]\]>/],
  [/^ {0,3}<![A-Za-z]/, />/],
]
const HTML_START = /^ {0,3}<[A-Za-z/!?]/
const HTML_LINE = /^ {0,3}<[A-Za-z]/m
const HTML_LINES = /^ {0,3}<([A-Za-z][\w:-]*)(?=[\s>/])/gm
const FOOTNOTE_DEFINITION = /\[\^[^\]\s]{1,200}\]:/
const LINK_DEFINITION = /^ {0,3}\[[^\]]+\]:/
const OPEN_LABEL = /^ {0,3}\[[^\]]*$/
const IMAGE_ONLY = /^!\[[^\]]*\]\([^)]*\)$/
const DOUBLE_DOLLAR = /(?<!\\)\$\$/g
const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'wbr'])

const whole = (markdown: string): MarkdownBlock[] => [{ source: markdown, offset: 0, line: 1 }]

/** What the scan knows after a line: only what decides where a top-level block can end. */
interface Scan {
  /** The opening run of the top-level fence the text is inside. */
  fence: string | null
  /** What closes the HTML block the text is inside, one that blank lines do not end. */
  html: RegExp | null
  /** The content column of the open top-level list item; 0 outside a list. */
  list: number
  /** The list may already be over: a line left of the item that was a lazy continuation or not. */
  unsure: boolean
  /** The lines since the last blank one may be an HTML block, where a fence line is not a fence. */
  markup: boolean
  /** The next line starts a block: the last one was blank or closed a fence, or there was none. */
  fresh: boolean
  /** An odd number of `$$` so far in this block: a display formula may be open. */
  odd: boolean
  /** A `[label` that has not closed yet: it may turn out to be a link definition. */
  label: boolean
  /**
   * The last line with text was indented four or more: code, or the rest of a paragraph. The
   * parser still has indented code open when it reads the next line, and reads it as one that
   * interrupts: `2. two` or an empty `-` is then text, not a list. The line after is never cut.
   */
  indented: boolean
  /** The last line with text closed a top-level fence: whatever comes next is a new block. */
  closed: boolean
  /** Text follows a closed fence in the same piece: that piece is not only a fence. */
  mixed: boolean
  /** The opening run of a fence inside the open list item. */
  inner: string | null
  /** A line with text has been read: blank lines at the very start belong to the first block. */
  seen: boolean
  /** The scan cannot tell what the next lines are: no more cuts. */
  stuck: boolean
  /** A definition that resolves across blocks: the document stays one block. */
  whole: boolean
}

const start = (): Scan => ({
  fence: null,
  html: null,
  list: 0,
  unsure: false,
  markup: false,
  fresh: true,
  odd: false,
  label: false,
  closed: false,
  indented: false,
  mixed: false,
  inner: null,
  seen: false,
  stuck: false,
  whole: false,
})

/** The column a line's text starts at, tabs to the next multiple of four; -1 for a blank line. */
function indentOf(line: string): number {
  let column = 0
  for (let index = 0; index < line.length; index += 1) {
    const code = line.charCodeAt(index)
    if (code === 32) column += 1
    else if (code === 9) column += 4 - (column % 4)
    else return column
  }
  return -1
}

/**
 * The content column of a list item's line, 0 when the line is not one, -1 when it is one whose
 * column a tab after the marker leaves unknown.
 */
function itemColumn(line: string): number {
  const item = ITEM.exec(line)
  if (!item) return 0
  const base = item[1]!.length + item[2]!.length
  const rest = item[3]!
  if (rest === '') return base + 1
  if (rest[0] === '\t') return -1
  if (rest[0] !== ' ') return 0
  const text = rest.trimStart()
  const spaces = rest.length - text.length
  if (text === '') return base + 1
  if (rest.slice(0, spaces).includes('\t')) return -1
  return base + (spaces > 4 ? 1 : spaces)
}

/**
 * One line through the scan. True when the line starts a new top-level block for certain: after a
 * blank line outside every open construct, or as the fence line of a top-level fence.
 */
function step(scan: Scan, line: string): boolean {
  const seen = scan.seen
  const closed = scan.closed
  if (!seen && line.trim() !== '') scan.seen = true
  const cut = advance(scan, line)
  // A line with text right after a fence that did not start a block: the scan was stuck on it.
  if (closed && !scan.closed && !cut) scan.mixed = true
  return cut && seen
}

function advance(scan: Scan, line: string): boolean {
  if (scan.stuck || scan.whole) return false
  if (scan.fence) {
    const closing = FENCE.exec(line)
    if (
      closing &&
      closing[1]![0] === scan.fence[0] &&
      closing[1]!.length >= scan.fence.length &&
      closing[2]!.trim() === ''
    ) {
      scan.fence = null
      scan.fresh = true
      scan.closed = true
    }
    return false
  }
  if (scan.html) {
    if (scan.html.test(line)) scan.html = null
    return false
  }
  const indent = indentOf(line)
  if (indent === -1) {
    scan.fresh = true
    scan.markup = false
    scan.label = false
    return false
  }
  const fresh = scan.fresh
  const closed = scan.closed
  scan.fresh = false
  scan.closed = false

  if (FOOTNOTE_DEFINITION.test(line) || LINK_DEFINITION.test(line)) return definition(scan)
  if (scan.label) {
    const close = line.indexOf(']')
    if (close !== -1) {
      if (line[close + 1] === ':') return definition(scan)
      scan.label = false
    }
  } else if (OPEN_LABEL.test(line)) scan.label = true

  const odd = scan.odd
  if (line.includes('$$') && (line.match(DOUBLE_DOLLAR)?.length ?? 0) % 2 === 1) scan.odd = !odd

  const fence = FENCE.exec(line)
  // A backtick fence has no backtick in its info string: ```` ```a``` ```` is inline code.
  const opensFence = fence !== null && !(fence[1]![0] === '`' && fence[2]!.includes('`'))
  // Inside a formula or an HTML block a fence line is text, and which of the two it is here
  // cannot be told from the lines alone.
  if (opensFence && (odd || scan.markup)) return stick(scan)

  if (scan.list > 0) {
    if (indent >= scan.list) {
      // In the item, if the list is still open; a top-level fence if it is not.
      if (opensFence && scan.unsure) return stick(scan)
      const inner = INNER_FENCE.exec(line)
      if (scan.inner) {
        if (
          inner &&
          inner[1]![0] === scan.inner[0] &&
          inner[1]!.length >= scan.inner.length &&
          inner[2]!.trim() === ''
        )
          scan.inner = null
      } else if (inner && !(inner[1]![0] === '`' && inner[2]!.includes('`'))) scan.inner = inner[1]!
      return false
    }
    // A fence in the item that a line left of the item ends: where its last blank lines go
    // depends on what follows, so nothing is cut from here on.
    if (scan.inner) return stick(scan)
    const column = RULE.test(line) ? 0 : itemColumn(line)
    if (column === -1) return stick(scan)
    if (column > 0) {
      // The next item of the list (or of a new one right after it).
      scan.list = column
      if (fresh) scan.unsure = false
      return false
    }
    if (
      fresh ||
      opensFence ||
      HEADING.test(line) ||
      RULE.test(line) ||
      QUOTE.test(line) ||
      LONG_HTML.some(([opens]) => opens.test(line))
    ) {
      // Left of the item after a blank line, or a block that cannot be a lazy continuation: the
      // list is over, and the line is read as a top-level one below.
      scan.list = 0
      scan.unsure = false
    } else {
      // A lazy continuation of the item's paragraph, or, if the item did not end in a paragraph,
      // the first line after the list.
      scan.unsure = true
      if (HTML_START.test(line)) scan.markup = true
      return false
    }
  }

  // Indented four or more after a blank line: indented code, which goes on over blank lines.
  // Right after a fence, any line starts a block.
  const indented = scan.indented
  scan.indented = indent >= 4
  const cut = closed || (fresh && indent < 4 && !odd && !indented)
  for (const [opens, closes] of LONG_HTML) {
    if (!opens.test(line)) continue
    if (!closes.test(line.replace(opens, ''))) scan.html = closes
    return cut
  }
  if (opensFence) {
    scan.fence = fence![1]!
    // A fence starts a block wherever it is written, and is one whatever follows it.
    return !odd
  }
  const column = indent < 4 && !RULE.test(line) ? itemColumn(line) : 0
  if (column === -1) return stick(scan)
  // After a line indented four, which was code or the rest of a paragraph, only the scan of the
  // lines before it could say which a list item that cannot interrupt is.
  if (column > 0 && indented && !INTERRUPTING_ITEM.test(line)) return stick(scan)
  if (column > 0) {
    scan.list = column
    scan.unsure = scan.markup || (!fresh && !INTERRUPTING_ITEM.test(line))
    return cut
  }
  if (HTML_START.test(line)) scan.markup = true
  return cut
}

function stick(scan: Scan): false {
  scan.stuck = true
  return false
}

function definition(scan: Scan): false {
  scan.whole = true
  return false
}

/** The line of `text` that starts at `at`, without its newline. */
function lineAt(text: string, at: number): string {
  const end = text.indexOf('\n', at)
  return text.slice(at, end === -1 ? text.length : end)
}

/** Whether `raw` has a line that opens an HTML tag still open at its end. */
function htmlOpen(raw: string): boolean {
  // A comment left open takes whatever follows it.
  if (raw.includes('<!--') && raw.split('<!--').length > raw.split('-->').length) return true
  if (!HTML_LINE.test(raw)) return false
  const tried = new Set<string>()
  for (const opener of raw.matchAll(HTML_LINES)) {
    const tag = opener[1]!.toLowerCase()
    if (tried.has(tag) || VOID_TAGS.has(tag)) continue
    tried.add(tag)
    const rest = raw.slice(opener.index)
    const openers = rest.match(new RegExp(`<${tag}(?=[\\s>/])[^>]*>`, 'gi')) ?? []
    const opened = openers.filter((found) => !found.endsWith('/>')).length
    const closed = rest.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0
    if (opened > closed) return true
  }
  return false
}

/**
 * The pieces the scan cut (`starts`, offsets into `text`) joined into the blocks that must render
 * together: the offsets where a block starts. Read by the same grammar as the remark pass.
 */
function group(text: string, starts: readonly number[]): number[] {
  const count = starts.length
  const endOf = (piece: number) => (piece + 1 < count ? starts[piece + 1]! : text.length)
  const first = (piece: number) => (piece < count ? lineAt(text, starts[piece]!) : '')
  const kindOf = (line: string): ContainerKind | null => {
    const quoted = QUOTE.exec(line)
    return quoted ? (parseContainerMarker(quoted[1]!.trimStart())?.kind ?? null) : null
  }
  const isItem = (line: string) => !RULE.test(line) && itemColumn(line) !== 0
  /** The piece after the tabs whose first heading is in `holder`, on `line` or underlined. */
  const tabsEnd = (holder: number, line: string, fallback: number): number => {
    if (holder >= count) return fallback
    const opening = HEADING.exec(line)
    // A heading underlined with `===` has a depth this scan does not read: it ends at a `---`.
    if (!opening && !UNDERLINE.test(text.slice(starts[holder]!, endOf(holder)))) return fallback
    const depth = opening ? opening[1]!.length : 1
    let end = holder + 1
    for (; end < count; end += 1) {
      const next = first(end)
      if (RULE.test(next)) break
      const heading = HEADING.exec(next)
      if (heading && heading[1]!.length < depth) break
    }
    return end
  }
  /**
   * The form a piece holds a marker line for, and the piece after everything it governs. A list
   * form takes the one list right after it; tabs take the sections from the heading right after
   * them up to a shallower heading, a `---` or the end. The marker is a quote of its own, on any
   * line of the piece: on the last, what it governs is the next piece. A marker whose quote goes
   * on (`> [!PROS]\n> - a`) holds its own content. Of several markers, the one that reaches
   * furthest decides.
   */
  const form = (piece: number): { kind: ContainerKind; end: number } | null => {
    if (piece >= count) return null
    const body = text.slice(starts[piece]!, endOf(piece)).trimEnd()
    if (!body.includes('[!')) return null
    const lines = body.split('\n')
    let found: { kind: ContainerKind; end: number } | null = null
    for (let index = 0; index < lines.length; index += 1) {
      const kind = kindOf(lines[index]!)
      // The marker opens its quote: the line above it is not of the same quote.
      if (!kind || (index > 0 && QUOTE.test(lines[index - 1]!))) continue
      const next = lines[index + 1]
      let end = piece + 1
      if (next === undefined) {
        if (kind === 'tabs') end = tabsEnd(piece + 1, first(piece + 1), piece + 1)
        else if (isItem(first(piece + 1))) end = piece + 2
      } else if (kind === 'tabs' && !QUOTE.test(next)) end = tabsEnd(piece, next, piece + 1)
      const reach: number = found ? found.end : 0
      found = { kind, end: Math.max(end, reach) }
    }
    return found
  }

  const blocks: number[] = []
  let piece = 0
  while (piece < count) {
    const from = piece
    const found = form(piece)
    piece = found ? found.end : piece + 1

    // A pros right before a cons (or the reverse) is set as one pair.
    if (found && (found.kind === 'pros' || found.kind === 'cons')) {
      const other = form(piece)
      if (other && other.kind === (found.kind === 'pros' ? 'cons' : 'pros')) piece = other.end
    }

    // An image alone in its paragraph takes the emphasis line under it as its caption. Merging is
    // always safe (it is what one parse does anyway), so the test here can be loose.
    if (
      piece === from + 1 &&
      piece < count &&
      IMAGE_ONLY.test(text.slice(starts[from]!, endOf(from)).trim()) &&
      /^[*_]/.test(first(piece).trimStart())
    )
      piece += 1

    // An HTML block whose tag closes further down.
    while (piece < count && htmlOpen(text.slice(starts[from]!, starts[piece]!))) piece += 1

    blocks.push(starts[from]!)
  }
  return blocks
}

/**
 * Line endings as the scan reads them: `\r\n` and `\r` become `\n`. Offsets of the blocks are into
 * the normalized text, which is what the renderer draws from.
 */
export const normalizeLineEndings = (markdown: string): string =>
  markdown.includes('\r') ? markdown.replace(/\r\n?/g, '\n') : markdown

/** Blocks that are one fenced code block and nothing else: no prose, HTML, math or heading. */
const fenced = new WeakSet<MarkdownBlock>()

/** Whether the splitter cut this block as one fenced code block. */
export const isFenceBlock = (block: MarkdownBlock): boolean => fenced.has(block)

/** The scan after a complete line: the next text can go on from there. */
interface Mark {
  /** The offset after that line. */
  at: number
  scan: Scan
  /** How many pieces had been cut by then. */
  count: number
}

/** Where a scan can be resumed. */
interface Progress {
  /** Where the scan started: the end of the blocks kept as final. */
  from: number
  /** The pieces cut up to the last mark, `from` first. */
  starts: number[]
  /**
   * The scan after each of the last complete lines, oldest first. Several, because a healed
   * stream rewrites its end: the fence it closes or the row it drops is a line that the next
   * update does not have, and the scan then goes on from the line before.
   */
  marks: Mark[]
}

const MARKS = 3

/**
 * The pieces of `text` from `from` on: the offsets where the scan cut, or null when a definition
 * keeps the document whole. `progress` and `mark` are where an earlier scan of the same start
 * can go on from.
 */
function pieces(
  text: string,
  from: number,
  progress: Progress | null,
  mark: Mark | null,
): { starts: number[]; progress: Progress; mixed: boolean } | null {
  const scan = mark ? { ...mark.scan } : start()
  const starts = progress && mark ? progress.starts.slice(0, mark.count) : [from]
  const marks = progress && mark ? progress.marks.filter((kept) => kept.at <= mark.at) : []
  let at = mark ? mark.at : from
  // Marks are left after the last complete lines only.
  let marked = text.length
  for (let back = 0; back < MARKS && marked > at; back += 1)
    marked = text.lastIndexOf('\n', marked - 1)
  for (let end = text.indexOf('\n', at); end !== -1; end = text.indexOf('\n', at)) {
    if (step(scan, text.slice(at, end)) && at > from) starts.push(at)
    at = end + 1
    if (end >= marked) marks.push({ at, scan: { ...scan }, count: starts.length })
  }
  const next: Progress = { from, starts: [...starts], marks: marks.slice(-MARKS) }
  // The last line is still being written: read, but not remembered.
  if (at < text.length && step(scan, text.slice(at)) && at > from) starts.push(at)
  return scan.whole ? null : { starts, progress: next, mixed: scan.mixed }
}

/** The blocks of `text` that the pieces at `cuts` make, the first on line `line`. */
function build(
  text: string,
  cuts: readonly number[],
  line: number,
  mixed: boolean,
): MarkdownBlock[] {
  const starts = group(text, cuts)
  const blocks: MarkdownBlock[] = []
  let current = line
  let piece = 0
  for (let index = 0; index < starts.length; index += 1) {
    const offset = starts[index]!
    const end = starts[index + 1] ?? text.length
    const source = text.slice(offset, end)
    const block = { source, offset, line: current }
    while (cuts[piece]! < offset) piece += 1
    // One piece that opens with a fence line is that fence and the blank lines after it: the scan
    // cuts before a top-level fence and after the line that closes it.
    // (When the scan got stuck after a fence, the last piece holds more than that fence.)
    if ((cuts[piece + 1] ?? text.length) === end && !(mixed && end === text.length)) {
      const opening = FENCE.exec(lineAt(text, offset))
      if (opening && !(opening[1]![0] === '`' && opening[2]!.includes('`'))) fenced.add(block)
    }
    blocks.push(block)
    // The last block's lines place nothing: a fence that grows is not counted on every token.
    if (index + 1 === starts.length) break
    for (let at = source.indexOf('\n'); at !== -1; at = source.indexOf('\n', at + 1)) current += 1
  }
  return blocks
}

/** The top-level blocks of a document, cut where one parse of the whole would not join them. */
export function splitBlocks(input: string): MarkdownBlock[] {
  const markdown = normalizeLineEndings(input)
  if (!markdown) return whole(markdown)
  const cut = pieces(markdown, 0, null, null)
  return cut ? build(markdown, cut.starts, 1, cut.mixed) : whole(markdown)
}

/**
 * How many blocks at the end are read again. Text appended to a document can change only the
 * group it is appended to, and that group can join the one before it (a `[!CONS]` arriving
 * under a `[!PROS]`); every group above those two is final.
 */
const REOPENED = 2

export interface BlockSplitter {
  /** The same blocks as `splitBlocks(markdown)`; the ones that did not change are the same objects. */
  split(markdown: string): MarkdownBlock[]
  /** Characters scanned so far: the work the splitter has done. */
  readonly lexed: number
}

/**
 * `splitBlocks` for a document that grows at its end, as a streaming reply does. It remembers the
 * blocks it cut last time and where its scan stopped: when the new text still starts with all of
 * them but the last two, it keeps those, as the very same objects, and scans only the lines that
 * are new. Any other text (a reply that was regenerated, or edited above its end) is split afresh.
 * Each update then costs the new characters, not the reply: a stream is linear in its length.
 */
export function createBlockSplitter(): BlockSplitter {
  let text = ''
  let blocks: MarkdownBlock[] = []
  let progress: Progress | null = null
  let lexed = 0

  return {
    get lexed() {
      return lexed
    },
    split(input) {
      const markdown = normalizeLineEndings(input)
      if (!markdown) {
        text = ''
        blocks = []
        progress = null
        return whole(markdown)
      }
      let kept = blocks.slice(0, Math.max(0, blocks.length - REOPENED))
      let last = kept.at(-1)
      let from = last ? last.offset + last.source.length : 0
      if (from > 0 && !(markdown.length >= from && markdown.startsWith(text.slice(0, from)))) {
        kept = []
        last = undefined
        from = 0
      }
      // The scan goes on from the last line it read that is still there, when it started at the
      // same place.
      let mark: Mark | null = null
      if (progress !== null && progress.from === from) {
        for (let index = progress.marks.length - 1; index >= 0 && !mark; index -= 1) {
          const tried = progress.marks[index]!
          if (markdown.length >= tried.at && markdown.startsWith(text.slice(from, tried.at), from))
            mark = tried
        }
      }
      lexed += markdown.length - (mark ? mark.at : from)
      const cut = pieces(markdown, from, mark ? progress : null, mark)
      text = markdown
      if (!cut) {
        // A definition arrived: what was cut before it is one block with it now.
        blocks = []
        progress = null
        return whole(markdown)
      }
      progress = cut.progress
      let line = 1
      if (last) {
        line = last.line
        for (let at = last.source.indexOf('\n'); at !== -1; at = last.source.indexOf('\n', at + 1))
          line += 1
      }
      const rest = build(markdown, cut.starts, line, cut.mixed)
      // A block that reads the same as last time is the same object, with what was worked out
      // from it.
      for (let index = 0; index < rest.length; index += 1) {
        const before = blocks[kept.length + index]
        const after = rest[index]!
        if (before && before.offset === after.offset && before.source === after.source) {
          rest[index] = before
        }
      }
      blocks = [...kept, ...rest]
      return blocks
    },
  }
}
