/**
 * A block that is one long list, read a piece of items at a time: what a renderer needs to draw a
 * list that grows by an item a token without reading the items above it again.
 *
 * A list's items are read on their own when nothing between them reaches across: a line that
 * starts an item at the left edge with the list's own marker ends the item before it, whatever that
 * item holds. So a piece of items parses as the same items one parse of the whole list makes, and
 * the list is that list with them all. Only a list that is surely so is cut:
 *
 * - every line at the left edge starts an item with the list's marker: no lazy line, no other block;
 * - no blank line: one makes the list loose, which is the whole list's to say;
 * - no definition of a link (`[a]: /u`), which every item reads, nor a footnote, numbered across;
 * - no line that is a thematic break, which ends the list.
 *
 * Anything else, and a list short enough to read whole, is read whole, as ever.
 */
import { checked, continues, type Grown } from '../core/continues'
import { formOf } from '../core/forms'
import type { Node } from '../engine/types'

/** How many items a piece holds: a complete piece is read once, a token reads the last again. */
export const LIST_ITEMS = 16

/** An item's line: its marker, the space after it, and something written after that. */
const ITEM = /^(?:([-*+])|\d{1,9}([.)]))[ \t]+\S/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/

/** A list's cut, kept between two readings of a text that grew. */
interface Cut {
  /** The text read up to `read`: the end of its last line read whole. */
  text: string
  read: number
  /** The list's marker: its bullet, or its numbers' delimiter. */
  bullet: string | undefined
  delimiter: string | undefined
  /** Where each item starts, and on which line. */
  items: number[]
  lines: number[]
  line: number
  /** Whether the lines read hold what keeps the list from being cut. */
  whole: boolean
  /** The fence an item holds open: its lines, blank ones among them, are its code. */
  fence: Fence | null
}

interface Fence {
  char: string
  length: number
}

/** A fence's line under an item: its run of backticks or tildes, and what follows it. */
const FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/

/** A piece read: its text, where it stands, what it was read with, and its items. */
interface Piece {
  text: string
  from: number
  scope: unknown
  list: Node | null
}

export interface ListReader {
  /**
   * The tree of `source`, a block of a document, when it is one long list read in pieces, each
   * by `parse`; null when the block is read whole. `closer` is the line that closes the fence the
   * block ends inside, read after the last piece and not as a line of the list. `scope` is what
   * `parse` reads with besides the text (its extensions, the document's link definitions): a piece
   * read with another is read again. `grown`: what the document checked of `source` against the
   * block it was last update (`grownOf`), so the source is not compared again.
   */
  read(
    source: string,
    closer: string,
    parse: (text: string) => Node,
    scope: unknown,
    grown?: Grown | null,
  ): Node | null
}

/** The reader of one document's growing block: it remembers its cut and the pieces it read. */
export function createListReader(): ListReader {
  let cut: Cut | null = null
  let pieces: Piece[] = []
  return {
    read(source, closer, parse, scope, grown) {
      cut = cutOf(source, cut, grown)
      if (cut.whole) return null
      // The line still being written is read each time, and not kept in the cut.
      let starts = cut.items
      let lines = cut.lines
      const rest = source.slice(cut.read)
      // The spaces a line under an item starts with, and nothing yet after them.
      if (rest && !(cut.items.length > 0 && /^[ \t]+$/.test(rest))) {
        const step = stepOf(cut, rest)
        if (step === null) return null
        if (step.item) {
          starts = [...starts, cut.read]
          lines = [...lines, cut.line]
        }
      }
      if (starts.length <= LIST_ITEMS) return null
      const kept = pieces
      const read: Piece[] = []
      const items: Node[] = []
      let first: Node | null = null
      for (let at = 0, index = 0; at < starts.length; at += LIST_ITEMS, index++) {
        const from = starts[at]!
        const to = starts[at + LIST_ITEMS]
        const text = to === undefined ? source.slice(from) + closer : source.slice(from, to)
        const was = kept[index]
        const piece: Piece =
          was && was.text === text && was.from === from && was.scope === scope
            ? was
            : { text, from, scope, list: listOf(parse(text), from, lines[at]!, first) }
        // A piece that does not read as items of this list: the block is read whole.
        const count = Math.min(LIST_ITEMS, starts.length - at)
        if (piece.list === null || piece.list.children?.length !== count) {
          pieces = []
          return null
        }
        read.push(piece)
        first ??= piece.list
        for (const item of piece.list.children) items.push(item)
      }
      pieces = read
      const list: Node = { ...first!, children: items }
      const start = first?.position?.start
      const end = items.at(-1)?.position?.end
      if (start && end) list.position = { start, end }
      return { type: 'root', children: [list] }
    },
  }
}

/** What a line is to the list: whether it starts an item (and with which marker), and the fence after it. */
interface Step {
  item: { bullet: string | undefined; delimiter: string | undefined } | null
  fence: Fence | null
}

/** What `text`, a line of the list, is to the cut; null when it keeps the list from being cut. */
function stepOf(cut: Cut, text: string): Step | null {
  const first = text.charCodeAt(0)
  const under = first === 32 || first === 9 || text === ''
  if (under && cut.fence !== null) {
    // Code: a blank line in it parts no blocks, and what it says is not Markdown.
    const line = FENCE.exec(text)
    const closes =
      line !== null &&
      line[1]![0] === cut.fence.char &&
      line[1]!.length >= cut.fence.length &&
      line[2]!.trim() === ''
    return { item: null, fence: closes ? null : cut.fence }
  }
  if (/^[ \t]*$/.test(text)) return null
  if (text.includes(']:') || text.includes('[^')) return null
  if (under) {
    if (cut.items.length === 0) return null
    const line = FENCE.exec(text)
    // A backtick fence has no backtick in its info string: ```` ```a``` ```` is inline code.
    const opens = line !== null && !(line[1]![0] === '`' && line[2]!.includes('`'))
    return { item: null, fence: opens ? { char: line[1]![0]!, length: line[1]!.length } : null }
  }
  // At the left edge: an item of this list, which ends the one before it and any fence it held.
  const item = ITEM.exec(text)
  if (item === null || RULE.test(text)) return null
  if (cut.items.length > 0 && (item[1] !== cut.bullet || item[2] !== cut.delimiter)) return null
  // A fence opened on an item's own line is not followed here: such a list is read whole.
  if (/^(?:[-*+]|\d{1,9}[.)])[ \t]+(?:`{3,}|~{3,})/.test(text)) return null
  return { item: { bullet: item[1], delimiter: item[2] }, fence: null }
}

/**
 * The cut of `source` over its lines read whole, going on from `before` where `source` continues
 * the text it read: a token costs the lines it added, not the list.
 */
function cutOf(source: string, before: Cut | null, grown?: Grown | null): Cut {
  const cut: Cut =
    before && continues(source, before.text, before.read, checked(grown, before.text))
      ? { ...before, items: [...before.items], lines: [...before.lines], text: source }
      : {
          text: source,
          read: 0,
          bullet: undefined,
          delimiter: undefined,
          items: [],
          lines: [],
          line: 0,
          whole: false,
          fence: null,
        }
  if (cut.whole) return cut
  for (let end = source.indexOf('\n', cut.read); end !== -1; end = source.indexOf('\n', cut.read)) {
    const step = stepOf(cut, source.slice(cut.read, end))
    // The line that stops the cut is kept in the text compared next time: should it change, the
    // list is cut again.
    if (step === null) return { ...cut, read: end + 1, whole: true }
    if (step.item) {
      if (cut.items.length === 0) {
        cut.bullet = step.item.bullet
        cut.delimiter = step.item.delimiter
      }
      cut.items.push(cut.read)
      cut.lines.push(cut.line)
    }
    cut.fence = step.fence
    cut.read = end + 1
    cut.line++
  }
  return cut
}

/**
 * The list a piece reads as, its places moved to where the piece stands in the block; null when
 * the piece is not one tight list of the kind of `first`, with no form of the dialect on it.
 */
function listOf(root: Node, from: number, line: number, first: Node | null): Node | null {
  const parts = root.children ?? []
  const list = parts[0]
  if (parts.length !== 1 || list?.type !== 'list' || list.spread || formOf(list)) return null
  if (first && Boolean(first.ordered) !== Boolean(list.ordered)) return null
  moved(list, from, line)
  return list
}

/** `node` and everything in it moved by `offset` characters and `lines` lines. */
export function moved(node: Node, offset: number, lines: number): void {
  const at = node.position
  if (at) {
    node.position = {
      start: { ...at.start, offset: at.start.offset + offset, line: at.start.line + lines },
      end: { ...at.end, offset: at.end.offset + offset, line: at.end.line + lines },
    }
  }
  for (const child of node.children ?? []) moved(child, offset, lines)
}
