/**
 * A block that is one long quote, read a piece of its blocks at a time: what a renderer needs to
 * draw a quote (a callout, a quoted passage) that grows on every token without reading all of it
 * again.
 *
 * A quote's blocks are read on their own when they are parted by a blank line of the quote and the
 * next one starts at its left edge: nothing before such a line reaches past it. A piece is lines
 * of the quote as written, `>` and all, so it parses as a quote with those blocks in it, and the
 * quote is the first piece's (a callout marked on it, as its first line says) with every piece's
 * blocks. Only a quote that is surely so is cut:
 *
 * - every line is marked (`>`, no tab after it): no lazy line;
 * - no form of the dialect but a callout on the first line (`[!STEPS]` takes the list after it,
 *   and an attribution, `— Name`, is read off the quote's last paragraph);
 * - no raw HTML at the start of a line, whose blocks blank lines do not all end;
 * - no definition of a link nor a footnote, which every block reads.
 *
 * Anything else, and a quote short enough to read whole, is read whole, as ever.
 */
import { checked, continues, type Grown } from '../core/continues'
import { formOf } from '../core/forms'
import { parseContainerMarker } from '../dialect'
import type { Node } from '../engine/types'
import { moved } from './list'

/** How many of a quote's blocks a piece holds. */
export const QUOTE_BLOCKS = 8

const MARK = /^ {0,3}> ?/
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/
const FORMULA = /^[ \t]{0,3}\$\$[ \t]*$/
const ATTRIBUTION = /^[ \t]*(?:—|--)[ \t]+/
const ITEM = /^(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/

interface Cut {
  text: string
  read: number
  line: number
  /** Where each block of the quote that may start a piece starts, and on which line. */
  starts: number[]
  lines: number[]
  /** The fence the lines read are inside: its marker, or `$$`. */
  fence: { char: string; length: number } | null
  /** Whether the last line read was a blank line of the quote. */
  blank: boolean
  whole: boolean
}

interface Piece {
  text: string
  from: number
  scope: unknown
  quote: Node | null
}

export interface QuoteReader {
  /** As `ListReader.read`, for a block that is one long quote. */
  read(
    source: string,
    closer: string,
    parse: (text: string) => Node,
    scope: unknown,
    grown?: Grown | null,
  ): Node | null
}

export function createQuoteReader(): QuoteReader {
  let cut: Cut | null = null
  let pieces: Piece[] = []
  return {
    read(source, closer, parse, scope, grown) {
      cut = cutOf(source, cut, grown)
      if (cut.whole) return null
      let starts = cut.starts
      let lines = cut.lines
      const rest = source.slice(cut.read)
      if (rest) {
        // Read on a copy: what the line being written opens is not the cut's yet.
        const step = stepOf({ ...cut }, rest)
        if (step === null) return null
        if (step.starts) {
          starts = [...starts, cut.read]
          lines = [...lines, cut.line]
        }
      }
      if (starts.length <= QUOTE_BLOCKS) return null
      const kept = pieces
      const read: Piece[] = []
      const blocks: Node[] = []
      let first: Node | null = null
      let last: Node | null = null
      for (let at = 0, index = 0; at < starts.length; at += QUOTE_BLOCKS, index++) {
        const from = starts[at]!
        const to = starts[at + QUOTE_BLOCKS]
        const text = to === undefined ? source.slice(from) + closer : source.slice(from, to)
        const was = kept[index]
        const piece: Piece =
          was && was.text === text && was.from === from && was.scope === scope
            ? was
            : { text, from, scope, quote: quoteOf(parse(text), from, lines[at]!, index === 0) }
        if (piece.quote === null) {
          pieces = []
          return null
        }
        read.push(piece)
        first ??= piece.quote
        last = piece.quote
        for (const block of piece.quote.children ?? []) blocks.push(block)
      }
      pieces = read
      const quote: Node = { ...first!, children: blocks }
      const start = first?.position?.start
      const end = last?.position?.end
      if (start && end) quote.position = { start, end }
      return { type: 'root', children: [quote] }
    },
  }
}

/** What a line of the quote is to the cut; null when it keeps the quote from being cut. */
function stepOf(cut: Cut, line: string): { starts: boolean } | null {
  const mark = MARK.exec(line)
  if (mark === null || line.charCodeAt(mark[0].length) === 9) return null
  const inside = line.slice(mark[0].length)
  const fence = cut.fence
  if (fence !== null) {
    // Code or a formula: its blank lines part nothing, and what it says is not Markdown.
    const closing = fence.char === '$' ? FORMULA.test(inside) : closes(inside, fence)
    if (closing) cut.fence = null
    return { starts: false }
  }
  if (/^[ \t]*$/.test(inside)) {
    cut.blank = true
    return { starts: false }
  }
  if (cut.read === 0 && cut.starts.length === 0) {
    // The first line may mark a callout, which is the first piece's; not a form that takes more.
    if (parseContainerMarker(inside.trim())) return null
  } else if (inside.includes('[!')) return null
  if (inside.includes(']:') || inside.includes('[^') || ATTRIBUTION.test(inside)) return null
  if (/^[ \t]*</.test(inside)) return null
  // After a blank line, a line at the left edge starts a block of its own; an item does not, since a
  // list goes on over blank lines to an item of its kind.
  const starts =
    cut.starts.length === 0 || (cut.blank && /^[^ \t]/.test(inside) && !ITEM.test(inside))
  cut.blank = false
  const opens = FENCE.exec(inside)
  if (opens && !(opens[1]![0] === '`' && opens[2]!.includes('`')))
    cut.fence = { char: opens[1]![0]!, length: opens[1]!.length }
  else if (FORMULA.test(inside)) cut.fence = { char: '$', length: 2 }
  return { starts }
}

const closes = (inside: string, fence: { char: string; length: number }): boolean => {
  const line = FENCE.exec(inside)
  return (
    line !== null &&
    line[1]![0] === fence.char &&
    line[1]!.length >= fence.length &&
    line[2]!.trim() === ''
  )
}

function cutOf(source: string, before: Cut | null, grown?: Grown | null): Cut {
  const cut: Cut =
    before && continues(source, before.text, before.read, checked(grown, before.text))
      ? { ...before, starts: [...before.starts], lines: [...before.lines], text: source }
      : {
          text: source,
          read: 0,
          line: 0,
          starts: [],
          lines: [],
          fence: null,
          blank: false,
          whole: false,
        }
  if (cut.whole) return cut
  for (let end = source.indexOf('\n', cut.read); end !== -1; end = source.indexOf('\n', cut.read)) {
    const step = stepOf(cut, source.slice(cut.read, end))
    if (step === null) return { ...cut, read: end + 1, whole: true }
    if (step.starts) {
      cut.starts.push(cut.read)
      cut.lines.push(cut.line)
    }
    cut.read = end + 1
    cut.line++
  }
  return cut
}

/**
 * The quote a piece reads as, its places moved to where the piece stands; null when it is not one
 * quote, or when a piece but the first is marked as a form.
 */
function quoteOf(root: Node, from: number, line: number, first: boolean): Node | null {
  const parts = root.children ?? []
  const quote = parts[0]
  if (parts.length !== 1 || quote?.type !== 'blockquote') return null
  if (!first && (formOf(quote) || quote.data)) return null
  moved(quote, from, line)
  return quote
}
