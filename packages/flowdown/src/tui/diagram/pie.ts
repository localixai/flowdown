/**
 * Pie charts in a terminal. A circle drawn in cells is a blot, so each slice is a bar of its share
 * along a row, in the order the source gives them: `Dogs ▓▓▓▓▓▓▓▓▌ 79.0%`, and its value after it
 * with `showData`. Above them one row stacks every slice into the whole, each in its own fill: the
 * bar of a slice is as long as its part of that row, so either reading checks the other.
 *
 * Where the labels leave a bar no room, the slices are written as a list with the stacked row under
 * the title. A value below zero has no share of a pie: it is listed, at 0%.
 */
import {
  across,
  apportion,
  bounded,
  colourOf,
  fillOf,
  fits,
  formatNumber,
  MOST_ITEMS,
  oneLabel,
  padEnd,
  padStart,
  percent,
  readNumber,
  shares,
  titleRows,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest } from './text'
import { DIM, PLAIN, type Line, type Span } from '../style'
import { span } from '../wrap'

interface Slice {
  label: string
  value: number
}

interface Pie {
  title: string
  showData: boolean
  slices: Slice[]
}

const HEADER = /^pie\b(?:\s+(showData)\b)?(?:\s+title\b\s*(.*))?$/i
const TITLE = /^title\b\s*(.*)$/i
/** A bar shorter than this is no picture: the slices are listed instead. */
const LEAST_BAR = 8
/** A bar longer than this says no more, and its row is harder to read across. */
const MOST_BAR = 40

export const pieDiagram: DiagramKind = {
  matches: (header) => /^pie\b/i.test(header),
  draw(lines, columns) {
    const pie = parse(lines)
    if (!pie) return null
    const picture = bars(pie, columns)
    return bounded(picture && fits(picture, columns) ? picture : list(pie, columns))
  },
}

function parse(lines: readonly string[]): Pie | null {
  const header = HEADER.exec(lines[0] ?? '')
  if (!header) return null
  const pie: Pie = { title: oneLabel(header[2] ?? ''), showData: !!header[1], slices: [] }
  for (const line of lines.slice(1)) {
    const title = TITLE.exec(line)
    if (title) pie.title = oneLabel(title[1]!)
    else if (/^showData$/i.test(line)) pie.showData = true
    else {
      const slice = readSlice(line)
      if (slice && pie.slices.push(slice) > MOST_ITEMS) return null
    }
  }
  return pie.slices.length > 0 ? pie : null
}

/**
 * `"Label" : 42`. Read by hand, not by one pattern: a pattern with a lazy label and spaces around
 * the colon would try every split of a long line that has none.
 */
function readSlice(line: string): Slice | null {
  const quote = line[0] === '"' || line[0] === "'" ? line[0] : ''
  const close = quote ? line.indexOf(quote, 1) : -1
  if (quote && close < 0) return null
  const colon = line.indexOf(':', quote ? close + 1 : 0)
  if (colon < 0 || (quote && line.slice(close + 1, colon).trim() !== '')) return null
  const value = readNumber(line.slice(colon + 1).replace(/;$/, ''))
  if (value === null) return null
  return { label: oneLabel(quote ? line.slice(1, close) : line.slice(0, colon)), value }
}

/** The slices as bars beside their labels, under the whole as one stacked row; null if too narrow. */
function bars(pie: Pie, columns: number): Line[] | null {
  const parts = shares(pie.slices.map((slice) => slice.value))
  const labels = widest(pie.slices.map((slice) => slice.label))
  const values = pie.slices.map((slice) => formatNumber(slice.value))
  const data = pie.showData ? widest(values) + 2 : 0
  // A label, a space, the bar, a space, the share (`100.0%`), and the value.
  const room = Math.min(MOST_BAR, columns - labels - 8 - data)
  if (room < LEAST_BAR) return null
  const out = titleRows(pie.title, columns)
  const indent = span(' '.repeat(labels + 1), PLAIN)
  const stacked = stack(parts, room)
  if (stacked.length > 1) out.push([indent, ...stacked])
  pie.slices.forEach((slice, at) => {
    const bar = across(parts[at]!, room, fillOf(at))
    out.push([
      span(padEnd(slice.label, labels + 1), PLAIN),
      span(bar, colourOf(at)),
      span(' '.repeat(room - [...bar].length + 1), PLAIN),
      span(padStart(percent(parts[at]!), 6), DIM),
      ...(pie.showData ? [span(padStart(values[at]!, data), PLAIN)] : []),
    ])
  })
  return out
}

/** The slices one to a row, `▓ Cats 18.1% 85`, wrapped; the stacked row under the title. */
function list(pie: Pie, columns: number): Line[] {
  const parts = shares(pie.slices.map((slice) => slice.value))
  const out = titleRows(pie.title, columns)
  const stacked = stack(parts, Math.min(columns, MOST_BAR))
  if (stacked.length > 1) out.push(stacked)
  pie.slices.forEach((slice, at) => {
    const line: Line = [
      span(fillOf(at), colourOf(at)),
      span(' ', PLAIN),
      ...(slice.label ? [span(slice.label, PLAIN), span(' ', PLAIN)] : []),
      span(percent(parts[at]!), DIM),
      ...(pie.showData ? [span(` ${formatNumber(slice.value)}`, PLAIN)] : []),
    ]
    out.push(...wrapped(line, columns))
  })
  return out
}

/**
 * The whole as one row of `cells`, each slice its share of them in its own fill and colour. A
 * slice too small for a cell has none here; its own row still says what it is.
 */
function stack(parts: readonly number[], cells: number): Span[] {
  return apportion(parts, cells).flatMap((own, at) =>
    own > 0 ? [span(fillOf(at).repeat(own), colourOf(at))] : [],
  )
}
