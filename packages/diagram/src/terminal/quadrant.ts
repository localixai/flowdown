/**
 * Quadrant charts in a terminal: a box split into four, each quadrant's name in its outer corner,
 * and each point a `●` where its two values put it, its name beside it. A name is set where it
 * covers no other name and no other point, tried on the right first, then on the left, then a row
 * above or below; a point whose name finds no room is still drawn, and listed under the box with
 * its values.
 *
 * Without the room for a box, the chart is written as its axes and then each quadrant with the
 * points in it.
 */
import { Canvas } from './canvas'
import {
  bounded,
  fits,
  formatNumber,
  MOST_ITEMS,
  oneLabel,
  readNumber,
  titleRows,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest, wrapLines } from './text'
import { BOLD, CODE, DIM, PLAIN, type Line } from '../style'
import { width } from '../width'
import { span } from '../wrap'

interface Point {
  name: string
  x: number
  y: number
}

interface Quadrants {
  title: string
  /** Each axis's low end and high end, either of them empty when not written. */
  x: readonly [string, string]
  y: readonly [string, string]
  /** The names of quadrants 1 to 4: top right, top left, bottom left, bottom right. */
  names: [string, string, string, string]
  points: Point[]
}

const HEADER = /^quadrantChart\s*$/i
const AXIS = /^([xy])-axis\b\s*(.*)$/i
const QUADRANT = /^quadrant-([1-4])\b\s*(.*)$/i
const TITLE = /^title\b\s*(.*)$/i
const SKIPPED = /^(?:classDef|accTitle|accDescr)\b/i
/** The box is never wider than this: past it, a point's place reads no better. */
const MOST_WIDE = 72
/** Narrower than this a box holds no quadrant's name beside a point: the chart is listed. */
const LEAST_WIDE = 24
const DOT = '●'

export const quadrantDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw(lines, columns) {
    const chart = parse(lines)
    if (!chart) return null
    const picture = columns >= LEAST_WIDE ? box(chart, columns) : null
    return bounded(picture && fits(picture, columns) ? picture : list(chart, columns))
  },
}

function parse(lines: readonly string[]): Quadrants | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const chart: Quadrants = {
    title: '',
    x: ['', ''],
    y: ['', ''],
    names: ['', '', '', ''],
    points: [],
  }
  let read = false
  for (const line of lines.slice(1)) {
    const title = TITLE.exec(line)
    const axis = AXIS.exec(line)
    const quadrant = QUADRANT.exec(line)
    if (title) chart.title = oneLabel(title[1]!)
    else if (axis) {
      const arrow = axis[2]!.indexOf('-->')
      const ends = (
        arrow < 0 ? [axis[2]!, ''] : [axis[2]!.slice(0, arrow), axis[2]!.slice(arrow + 3)]
      ).map(oneLabel) as [string, string]
      if (axis[1]!.toLowerCase() === 'x') chart.x = ends
      else chart.y = ends
    } else if (quadrant) chart.names[Number(quadrant[1]) - 1] = oneLabel(quadrant[2]!)
    else if (!SKIPPED.test(line)) {
      const point = readPoint(line)
      if (point && chart.points.push(point) > MOST_ITEMS) return null
      continue
    } else continue
    read = true
  }
  return chart.points.length > 0 || read ? chart : null
}

/**
 * `Name: [0.3, 0.6]`, and what may follow it (`radius: 10, color: #f00`), which a cell cannot
 * show. A class written on the name (`Name:::hot`) is left off it. Read by hand: the name may
 * hold a colon.
 */
function readPoint(line: string): Point | null {
  const open = line.lastIndexOf('[')
  const close = line.indexOf(']', open)
  if (open < 0 || close < 0) return null
  const before = line.slice(0, open).trimEnd()
  if (!before.endsWith(':')) return null
  const values = line.slice(open + 1, close).split(',')
  if (values.length !== 2) return null
  const x = readNumber(values[0]!)
  const y = readNumber(values[1]!)
  if (x === null || y === null) return null
  const name = oneLabel(before.slice(0, -1).replace(/:::[\w-]*$/, ''))
  return name ? { name, x, y } : null
}

/** A point's quadrant: 0 to 3 for quadrants 1 to 4. A value on a half's line is in the upper half. */
const quadrantOf = (point: Point): number =>
  point.y >= 0.5 ? (point.x >= 0.5 ? 0 : 1) : point.x >= 0.5 ? 3 : 2

const clamp = (value: number): number => (value > 0 ? (value < 1 ? value : 1) : 0)

/** The chart as a box with its points in it; null when its quadrants' names leave no room. */
function box(chart: Quadrants, columns: number): Line[] | null {
  const wide = Math.min(columns, MOST_WIDE)
  // The box's halves, each with a border, and the quadrants' names wrapped to the inside of one.
  const half = Math.floor((wide - 3) / 2)
  if (half < 6) return null
  const names = chart.names.map((name) => wrapLines(name ? [name] : [], half - 2))
  if (names.some((rows) => widest(rows) > half - 2)) return null
  const tallest = names.reduce((most, rows) => Math.max(most, rows.length), 0)
  // A cell is about twice as tall as it is wide: a square box is half as many rows as columns.
  const tall = Math.max(Math.round(wide / 12), tallest + 2)
  const inner = 2 * half + 1
  const high = 2 * tall + 3
  const canvas = new Canvas(inner + 2, high)
  const taken = new Uint8Array((inner + 2) * high)
  const take = (x: number, y: number, w: number) => {
    for (let at = x; at < x + w; at++) taken[y * (inner + 2) + at] = 1
  }
  const free = (x: number, y: number, w: number) => {
    if (x < 1 || x + w > inner + 1 || y < 1 || y > high - 2) return false
    for (let at = x; at < x + w; at++) if (taken[y * (inner + 2) + at]) return false
    return true
  }
  canvas.rect(0, 0, inner + 2, high, 'solid', DIM, false)
  canvas.stroke(
    [
      [half + 1, 0],
      [half + 1, high - 1],
    ],
    'solid',
    DIM,
    false,
  )
  canvas.stroke(
    [
      [0, tall + 1],
      [inner + 1, tall + 1],
    ],
    'solid',
    DIM,
    false,
  )
  // Each name in its quadrant's outer corner: the top ones at the top, flush to the box's side.
  names.forEach((rows, at) => {
    const right = at === 0 || at === 3
    const top = at < 2
    rows.forEach((row, line) => {
      const y = top ? 1 + line : high - 1 - rows.length + line
      const x = right ? inner + 1 - width(row) : 1
      canvas.text(x, y, row, BOLD)
      take(x, y, width(row))
    })
  })
  // A point that falls on a quadrant's name is not drawn over it: it is listed under the box.
  const places = chart.points.map((point) => {
    const x = 1 + Math.round(clamp(point.x) * (inner - 1))
    const y = 1 + Math.round((1 - clamp(point.y)) * (high - 3))
    return free(x, y, 1) ? ([x, y] as const) : null
  })
  for (const place of places) if (place) take(place[0], place[1], 1)
  const unplaced: Point[] = []
  chart.points.forEach((point, at) => {
    const place = places[at]
    if (!place) {
      unplaced.push(point)
      return
    }
    const [x, y] = place
    canvas.text(x, y, DOT, CODE)
    const w = width(point.name)
    const tries: Array<readonly [number, number]> = [
      [x + 2, y],
      [x - 1 - w, y],
      [x + 1, y - 1],
      [x - w, y - 1],
      [x + 1, y + 1],
      [x - w, y + 1],
    ]
    const spot = tries.find(([left, row]) => free(left, row, w))
    if (!spot) {
      unplaced.push(point)
      return
    }
    canvas.text(spot[0], spot[1], point.name, PLAIN)
    take(spot[0], spot[1], w)
  })
  const out = titleRows(chart.title, columns)
  if (chart.y[1]) out.push(...wrapped([span(`↑ ${chart.y[1]}`, DIM)], columns))
  out.push(...canvas.rows())
  if (chart.y[0]) out.push(...wrapped([span(`↓ ${chart.y[0]}`, DIM)], columns))
  out.push(...axisRow(chart.x, inner + 2, columns))
  for (const point of unplaced)
    out.push(
      ...wrapped(
        [span(`${DOT} `, CODE), span(point.name, PLAIN), span(` ${at(point)}`, DIM)],
        columns,
      ),
    )
  return out
}

/** A point's values as it was written: `(0.3, 0.6)`. */
const at = (point: Point): string => `(${formatNumber(point.x)}, ${formatNumber(point.y)})`

/** The x axis's ends under the box, `← Low` at its left and `High →` at its right, or a row each. */
function axisRow(ends: readonly [string, string], wide: number, columns: number): Line[] {
  const low = ends[0] ? `← ${ends[0]}` : ''
  const high = ends[1] ? `${ends[1]} →` : ''
  const gap = wide - width(low) - width(high)
  if (low && high && gap >= 2) return [[span(low + ' '.repeat(gap) + high, DIM)]]
  return [low, high].filter(Boolean).flatMap((text) => wrapped([span(text, DIM)], columns))
}

/** The chart as text: its axes, then each quadrant's name with the points in it. */
function list(chart: Quadrants, columns: number): Line[] {
  const out = titleRows(chart.title, columns)
  const axes: Array<[string, readonly [string, string]]> = [
    ['x', chart.x],
    ['y', chart.y],
  ]
  for (const [name, ends] of axes)
    if (ends[0] || ends[1])
      out.push(
        ...wrapped(
          [span(`${name}: ${[ends[0], ends[1]].filter(Boolean).join(' → ')}`, DIM)],
          columns,
        ),
      )
  const corners = ['top right', 'top left', 'bottom left', 'bottom right']
  corners.forEach((corner, quadrant) => {
    const points = chart.points.filter((point) => quadrantOf(point) === quadrant)
    const name = chart.names[quadrant]!
    if (!name && points.length === 0) return
    out.push(
      ...wrapped(
        [span(name || `quadrant ${quadrant + 1}`, BOLD), span(` (${corner})`, DIM)],
        columns,
      ),
    )
    for (const point of points)
      out.push(
        ...wrapped(
          [span(`${DOT} `, CODE), span(point.name, PLAIN), span(` ${at(point)}`, DIM)],
          columns,
          2,
        ),
      )
  })
  return out
}
