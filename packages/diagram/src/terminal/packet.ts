/**
 * Packet diagrams (`packet-beta`) in a terminal, drawn as an RFC draws a header: the bit numbers
 * across the top, 32 bits a row (16 when the terminal is narrow), two columns a bit, and a box
 * round each field spanning its bits. A field that runs on into the next row has no border
 * between its rows, so it reads as one box however it breaks.
 *
 * A name is wrapped inside its field's widest part; a name with a word longer than its field (a
 * flag of one bit) is a letter there and is written out under the diagram. Without the room for
 * sixteen bits, or for fields that overlap, the diagram is a list of the fields and their bits.
 */
import { Canvas } from './canvas'
import {
  bounded,
  fits,
  MOST_ITEMS,
  oneLabel,
  padEnd,
  padStart,
  titleRows,
  unquoted,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest, wrapLines } from './text'
import { BOLD, DIM, PLAIN, type Line } from '../style'
import { width } from '../width'
import { span } from '../wrap'

interface Field {
  /** The first bit and the last, both counted in. */
  start: number
  end: number
  label: string
}

interface Packet {
  title: string
  fields: Field[]
}

const HEADER = /^packet(?:-beta)?\s*$/i
const TITLE = /^title\b\s*(.*)$/i
const RANGE = /^(?:(\d{1,9})(?:\s*-\s*(\d{1,9}))?|\+(\d{1,9}))\s*:\s*(.*)$/
/** Past this many rows of bits a diagram is listed, not drawn. */
const MOST_ROWS_OF_BITS = 256
/** The marks a name too long for its field is written as there, each one column wide. */
const MARKS = '123456789abcdefghijklmnopqrstuvwxyz'

export const packetDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw(lines, columns) {
    const packet = parse(lines)
    if (!packet) return null
    const picture = [32, 16].reduce<Line[] | null>(
      (found, bits) => found ?? draw(packet, bits, columns),
      null,
    )
    return bounded(picture && fits(picture, columns) ? picture : list(packet, columns))
  },
}

function parse(lines: readonly string[]): Packet | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const packet: Packet = { title: '', fields: [] }
  let next = 0
  for (const line of lines.slice(1)) {
    const title = TITLE.exec(line)
    if (title) {
      packet.title = oneLabel(unquoted(title[1]!))
      continue
    }
    const match = RANGE.exec(line)
    if (!match) continue
    // `+8` is eight bits from where the field before it ended.
    const start = match[3] !== undefined ? next : Number(match[1])
    const end = match[3] !== undefined ? next + Number(match[3]) - 1 : Number(match[2] ?? match[1])
    if (end < start) continue
    if (packet.fields.push({ start, end, label: oneLabel(unquoted(match[4]!)) }) > MOST_ITEMS)
      return null
    next = end + 1
  }
  return packet.fields.length > 0 ? packet : null
}

/** The diagram with `bits` to a row; null when it is too wide, too long, or its fields overlap. */
function draw(packet: Packet, bits: number, columns: number): Line[] | null {
  const last = packet.fields.reduce((most, field) => Math.max(most, field.end), 0)
  const rows = Math.floor(last / bits) + 1
  if (rows > MOST_ROWS_OF_BITS) return null
  const gutter = String((rows - 1) * bits).length + 1
  const wide = gutter + 2 * bits + 1
  if (wide > columns) return null
  const owner = new Int32Array(rows * bits).fill(-1)
  for (const [at, field] of packet.fields.entries())
    for (let bit = field.start; bit <= field.end; bit++) {
      if (owner[bit] !== -1) return null
      owner[bit] = at
    }
  const own = (row: number, bit: number) =>
    row < 0 || row >= rows || bit < 0 || bit >= bits ? -1 : owner[row * bits + bit]!
  // Each field's name goes in its widest part, the first of them when two are as wide.
  const marked: Field[] = []
  const placed = packet.fields.map((field) => {
    let row = Math.floor(field.start / bits)
    let most = 0
    for (let at = row; at <= Math.floor(field.end / bits); at++) {
      const from = Math.max(field.start, at * bits)
      const to = Math.min(field.end, at * bits + bits - 1)
      if (to - from + 1 > most) {
        most = to - from + 1
        row = at
      }
    }
    const inner = 2 * most - 1
    const lines = wrapLines(field.label ? [field.label] : [], inner)
    // A word cut to fit would be read down its field, not across: such a name is written out below.
    if (field.label.split(' ').every((word) => width(word) <= inner))
      return { row, lines, from: Math.max(field.start, row * bits), inner }
    marked.push(field)
    return {
      row,
      lines: [MARKS[marked.length - 1] ?? ''],
      from: Math.max(field.start, row * bits),
      inner,
    }
  })
  if (marked.length > MARKS.length) return null
  // A row no field reaches is a gap in the packet: one blank row, not a row of nothing numbered.
  const heights = Array.from({ length: rows }, (_, row): number =>
    owner.subarray(row * bits, row * bits + bits).some((at) => at >= 0) ? 1 : 0,
  )
  for (const place of placed) heights[place.row] = Math.max(heights[place.row]!, place.lines.length)
  const tops: number[] = []
  let y = 2
  for (const height of heights) {
    tops.push(y)
    y += height + 1
  }
  const canvas = new Canvas(wide, y + 1)
  for (let bit = 0; bit < bits; bit++) {
    const x = gutter + 2 * bit + 1
    if (bit % 10 === 0) canvas.text(x, 0, String(bit / 10), DIM)
    canvas.text(x, 1, String(bit % 10), DIM)
  }
  for (let row = 0; row <= rows; row++) {
    const top = row < rows ? tops[row]! : y
    for (let bit = 0; bit < bits; bit++)
      if (own(row - 1, bit) !== own(row, bit))
        canvas.stroke(
          [
            [gutter + 2 * bit, top],
            [gutter + 2 * bit + 2, top],
          ],
          'solid',
          DIM,
          false,
        )
    if (row === rows) break
    if (heights[row]! > 0) canvas.text(0, top + 1, padStart(String(row * bits), gutter - 1), DIM)
    for (let edge = 0; edge <= bits; edge++)
      if (own(row, edge - 1) !== own(row, edge))
        canvas.stroke(
          [
            [gutter + 2 * edge, top],
            [gutter + 2 * edge, top + heights[row]! + 1],
          ],
          'solid',
          DIM,
          false,
        )
  }
  placed.forEach((place, at) => {
    const left = gutter + 2 * (place.from - place.row * bits) + 1
    const style = marked.includes(packet.fields[at]!) ? BOLD : PLAIN
    const down = Math.floor((heights[place.row]! - place.lines.length) / 2)
    place.lines.forEach((line, row) => {
      const x = left + Math.floor((place.inner - width(line)) / 2)
      canvas.text(x, tops[place.row]! + 1 + down + row, line, style)
    })
  })
  const out = [...titleRows(packet.title, columns), ...canvas.rows()]
  marked.forEach((field, at) => {
    out.push(
      ...wrapped(
        [span(MARKS[at]!, BOLD), span(` ${field.label}`, PLAIN), span(` ${bitsOf(field)}`, DIM)],
        columns,
      ),
    )
  })
  return out
}

/** A field's bits as written: `106`, or `0-15`. */
const bitsOf = (field: Field): string =>
  field.start === field.end ? String(field.start) : `${field.start}-${field.end}`

/** Each field's bits and its name, the names in a column of their own when the width holds them. */
function list(packet: Packet, columns: number): Line[] {
  const ranges = packet.fields.map(bitsOf)
  const room = widest(ranges) + 2
  const aligned = room + widest(packet.fields.map((field) => field.label)) <= columns
  return [
    ...titleRows(packet.title, columns),
    ...packet.fields.flatMap((field, at) =>
      aligned
        ? [[span(padEnd(ranges[at]!, room), DIM), span(field.label, PLAIN)]]
        : wrapped([span(ranges[at]!, DIM), span(` ${field.label}`, PLAIN)], columns),
    ),
  ]
}
