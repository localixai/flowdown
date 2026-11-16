/**
 * Kanban boards in a terminal: the columns side by side, each its title over its cards, and each
 * card a box with its text and, under it, who it is assigned to, its ticket and its priority.
 * When the columns do not fit across they are stacked, one under the other; when a card's box
 * would not hold a word, each card is a line of a list.
 *
 * A board's columns and cards are told apart by indentation alone, so this reads the lines with
 * their indentation kept (`indentedLines`). Given lines without it, a line with metadata
 * (`@{ … }`) is taken for a card and every other for a column.
 */
import { Canvas } from './canvas'
import type { DiagramKind } from './kind'
import { bounded, indentOf, longestWord, para, readNode, within } from './kit'
import { MOST_ROWS } from './outline'
import { labelLines, widest, wrapLines } from './text'
import { BOLD, CODE, DIM, FAILED, PLAIN, WAITING, type Line, type Style } from '../style'
import { width } from '../width'
import { lineWidth, span, wrap } from '../wrap'

/** Past these a board is not read on. */
const MOST_CARDS = 2000
const MOST_COLUMNS = 200
/** Metadata may run over this many lines before its `}`; past them it is not metadata. */
const MOST_META_LINES = 20
/** A column across is no wider than this, and none narrower than the second. */
const WIDEST = 32
const NARROWEST = 12
const GAP = 1

interface Card {
  label: string[]
  assigned: string[]
  ticket: string[]
  priority: string[]
}

interface Column {
  label: string[]
  cards: Card[]
}

export const kanbanDiagram: DiagramKind = {
  matches: (header) => /^kanban\b/.test(header),
  draw(lines, columns) {
    const board = parseKanban(lines)
    if (!board || !(columns >= 2)) return null
    const room = Math.floor(columns)
    const across = acrossOf(board, room)
    if (across) return across
    const stacked = stackedOf(board, room)
    return (stacked && within(stacked, room)) || listOf(board, room)
  },
}

function parseKanban(lines: readonly string[]): Column[] | null {
  if (!/^kanban\b/.test(lines[0]?.trim() ?? '')) return null
  const body = lines.slice(1)
  const top = body.length > 0 ? indentOf(body[0]!) : 0
  const indented = body.some((line) => indentOf(line) !== top)
  const board: Column[] = []
  let cards = 0
  for (let at = 0; at < body.length && cards < MOST_CARDS; at++) {
    const deep = indentOf(body[at]!) > top
    let text = body[at]!.trim()
    // Metadata to its `}`, on this line or on the lines after it.
    const open = text.indexOf('@{')
    let meta = ''
    if (open >= 0) {
      meta = text.slice(open + 2)
      text = text.slice(0, open).trim()
      for (
        let more = 0;
        !meta.includes('}') && more < MOST_META_LINES && at + 1 < body.length;
        more++
      )
        meta += ` ${body[++at]!.trim()}`
      meta = meta.slice(0, meta.includes('}') ? meta.indexOf('}') : meta.length)
    }
    const node = readNode(text)
    const card = indented ? deep || (open >= 0 && board.length > 0) : open >= 0
    if (!card || board.length === 0) {
      if (board.length >= MOST_COLUMNS) break
      board.push({ label: node.label, cards: [] })
      if (!card) continue
    }
    const own = fields(meta)
    board.at(-1)!.cards.push({
      label: node.label,
      assigned: labelLines(own.get('assigned') ?? ''),
      ticket: labelLines(own.get('ticket') ?? ''),
      priority: labelLines(own.get('priority') ?? ''),
    })
    cards++
  }
  return board.length > 0 ? board : null
}

/** The `key: value` pairs of a card's metadata, a value in quotes or up to the next comma. */
function fields(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const match of text.matchAll(/(\w+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,]*))/g))
    out.set(match[1]!.toLowerCase(), (match[2] ?? match[3] ?? match[4] ?? '').trim())
  return out
}

const PRIORITIES: Record<string, Style> = {
  'very high': { color: 'red', bold: true },
  high: FAILED,
  medium: WAITING,
  low: DIM,
  'very low': DIM,
}

/** What is written under a card's text: `@who`, its ticket, its priority. */
function metaOf(card: Card): Line {
  const out: Line = []
  const add = (text: string, style: Style) => {
    if (out.length > 0) out.push(span(' ', PLAIN))
    out.push(span(text, style))
  }
  if (card.assigned.length > 0) add(`@${card.assigned.join(' ')}`, CODE)
  if (card.ticket.length > 0) add(card.ticket.join(' '), DIM)
  if (card.priority.length > 0) {
    const text = card.priority.join(' ')
    add(text, PRIORITIES[text.toLowerCase()] ?? PLAIN)
  }
  return out
}

/** A card's rows inside its box, at `room` columns: its text, then its metadata. */
function rowsOf(card: Card, room: number): Line[] {
  const meta = metaOf(card)
  return [
    ...wrapLines(card.label, room).map((line) => [span(line, PLAIN)]),
    ...(meta.length > 0 ? wrap(meta, room, [], []) : []),
  ]
}

const wordsOf = (board: Column[]): string[] =>
  board.flatMap((column) => [
    ...column.label,
    ...column.cards.flatMap((card) => [...card.label, ...card.assigned, ...card.ticket]),
  ])

/** A column's title: its name in bold and how many cards it holds. */
const titleOf = (column: Column): Line => [
  span(column.label.join(' ') || '…', BOLD),
  span(` (${column.cards.length})`, DIM),
]

/**
 * Each card's box on the canvas, from row `top` in the `w` columns from `x`; the row under the
 * last box is given back.
 */
function boxes(canvas: Canvas, column: Column, x: number, top: number, w: number): number {
  let row = top
  for (const card of column.cards) {
    const inside = rowsOf(card, w - 4)
    canvas.rect(x, row, w, inside.length + 2, 'solid', DIM, true)
    inside.forEach((line, at) => {
      let from = x + 2
      for (const part of line) {
        canvas.text(from, row + 1 + at, part.text, part.style)
        from += width(part.text)
      }
    })
    row += inside.length + 2
  }
  return row
}

/** The width a column takes to hold its title and its widest card unwrapped, within bounds. */
const needOf = (board: Column[]): number =>
  Math.min(
    WIDEST,
    Math.max(
      NARROWEST,
      ...board.map((column) => lineWidth(titleOf(column))),
      ...board.flatMap((column) =>
        column.cards.map((card) => Math.max(widest(card.label), lineWidth(metaOf(card))) + 4),
      ),
    ),
  )

/** The columns side by side; null when they do not fit, or a word is wider than a card. */
function acrossOf(board: Column[], columns: number): Line[] | null {
  const fair = Math.floor((columns - GAP * (board.length - 1)) / board.length)
  const w = Math.min(needOf(board), fair)
  if (w < NARROWEST || longestWord(wordsOf(board)) > w - 4) return null
  const titles = board.map((column) => wrap(titleOf(column), w, [], []))
  const head = Math.max(...titles.map((lines) => lines.length))
  const high =
    head +
    Math.max(
      ...board.map((column) =>
        column.cards.reduce((sum, card) => sum + rowsOf(card, w - 4).length + 2, 0),
      ),
    )
  if (high > MOST_ROWS) return null
  const canvas = new Canvas(columns, high)
  board.forEach((column, at) => {
    const x = at * (w + GAP)
    titles[at]!.forEach((line, row) => {
      let from = x
      for (const part of line) {
        canvas.text(from, row, part.text, part.style)
        from += width(part.text)
      }
    })
    boxes(canvas, column, x, head, w)
  })
  return within(canvas.rows(), columns)
}

/** The columns one under another, each card a box as wide as the board's widest needs. */
function stackedOf(board: Column[], columns: number): Line[] | null {
  const w = Math.min(columns, needOf(board))
  if (w < 8 || longestWord(wordsOf(board)) > w - 4) return null
  const out: Line[] = []
  for (const [at, column] of board.entries()) {
    if (out.length > MOST_ROWS) return null
    if (at > 0) out.push([])
    out.push(...para(titleOf(column), columns, 0))
    const high = column.cards.reduce((sum, card) => sum + rowsOf(card, w - 4).length + 2, 0)
    if (high + out.length > MOST_ROWS) return null
    const canvas = new Canvas(w, high)
    boxes(canvas, column, 0, 0, w)
    out.push(...canvas.rows())
  }
  return out
}

/** Each column's title, and each card a line under it with its metadata. */
function listOf(board: Column[], columns: number): Line[] | null {
  const out: Line[] = []
  for (const column of board) {
    if (out.length > MOST_ROWS) return null
    out.push(...para(titleOf(column), columns, 0))
    for (const card of column.cards) {
      const meta = metaOf(card)
      out.push(
        ...para(
          [
            span(card.label.join(' ') || '…', PLAIN),
            ...(meta.length > 0 ? [span(' ', PLAIN), ...meta] : []),
          ],
          columns,
          2,
          [span('• ', DIM)],
        ),
      )
    }
  }
  return bounded(out)
}
