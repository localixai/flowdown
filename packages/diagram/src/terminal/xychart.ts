/**
 * XY charts (`xychart-beta`) in a terminal: bars as columns against a y axis with its ticks, each
 * column's top cell filled to the eighth (`▁▂▃▄▅▆▇`) so a column half a cell taller is seen to be,
 * and lines as a mark at each value joined by `╱`, `╲` and `─` across the cells between. Each
 * series has its own fill or mark as well as its colour, and a key under the chart names them.
 *
 * `horizontal` turns the bars to run along rows, one row a value. A chart whose categories have no
 * room at the width is written as a table of its values instead, and that table as wrapped rows
 * when it does not fit either: a value is never left out to make a picture.
 */
import { Canvas } from './canvas'
import {
  across,
  bounded,
  colourOf,
  fillOf,
  fits,
  formatNumber,
  MOST_ITEMS,
  oneLabel,
  padEnd,
  padStart,
  position,
  readNumber,
  splitList,
  titleRows,
  unquoted,
  upward,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest } from './text'
import { DIM, PLAIN, type Line, type Span } from '../style'
import { width } from '../width'
import { span } from '../wrap'

interface Series {
  kind: 'bar' | 'line'
  name: string
  /** Null where the source wrote something that is not a number. */
  values: Array<number | null>
}

interface XYChart {
  title: string
  horizontal: boolean
  categories: string[] | null
  xTitle: string
  xRange: readonly [number, number] | null
  yTitle: string
  yRange: readonly [number, number] | null
  series: Series[]
}

const HEADER = /^xychart(?:-beta)?\b\s*(horizontal|vertical)?\s*$/i
const LINE = /^(title|x-axis|y-axis|bar|line)\b\s*(.*)$/i
/** Past this many series a chart is not read: its key alone would fill the screen. */
const MOST_SERIES = 40
/** The rows a vertical chart's plot takes: enough for its eighths to tell values apart. */
const HEIGHT = 10
/** A line series' mark at each of its values, told apart without colour. */
const MARKS = ['●', '○', '◆', '◇', '■', '□', '▲', '△'] as const
/** A horizontal bar shorter than this is no picture: the chart is written as a table instead. */
const LEAST_BAR = 8
const MOST_BAR = 50

export const xychartDiagram: DiagramKind = {
  matches: (header) => /^xychart(?:-beta)?\b/i.test(header),
  draw(lines, columns) {
    const chart = parse(lines)
    if (!chart) return null
    const picture = chart.horizontal ? sideways(chart, columns) : upright(chart, columns)
    return bounded(picture && fits(picture, columns) ? picture : table(chart, columns))
  },
}

function parse(lines: readonly string[]): XYChart | null {
  const header = HEADER.exec(lines[0] ?? '')
  if (!header) return null
  const chart: XYChart = {
    title: '',
    horizontal: header[1]?.toLowerCase() === 'horizontal',
    categories: null,
    xTitle: '',
    xRange: null,
    yTitle: '',
    yRange: null,
    series: [],
  }
  let read = 0
  for (const line of lines.slice(1)) {
    const match = LINE.exec(line)
    if (!match) continue
    const keyword = match[1]!.toLowerCase()
    const rest = match[2]!
    if (keyword === 'title') chart.title = oneLabel(unquoted(rest))
    else if (keyword === 'x-axis') {
      const axis = readAxis(rest)
      chart.xTitle = axis.title
      chart.xRange = axis.range
      chart.categories = axis.list && axis.list.map((item) => oneLabel(unquoted(item)))
      read += axis.list?.length ?? 0
    } else if (keyword === 'y-axis') {
      const axis = readAxis(rest)
      chart.yTitle = axis.title
      chart.yRange = axis.range
    } else {
      const axis = readAxis(rest)
      if (!axis.list) continue
      const values = axis.list.map(readNumber)
      read += values.length
      chart.series.push({ kind: keyword === 'bar' ? 'bar' : 'line', name: axis.title, values })
    }
    if (read > MOST_ITEMS || chart.series.length > MOST_SERIES) return null
  }
  return chart.series.length > 0 && count(chart) > 0 ? chart : null
}

/**
 * What follows `x-axis`, `y-axis`, `bar` or `line`: a title, then a list `[a, b]` or a range
 * `0 --> 100`, each of them there or not.
 */
function readAxis(rest: string): {
  title: string
  list: string[] | null
  range: readonly [number, number] | null
} {
  const open = rest.indexOf('[')
  const close = rest.lastIndexOf(']')
  if (open >= 0 && close > open)
    return {
      title: oneLabel(unquoted(rest.slice(0, open))),
      list: splitList(rest.slice(open + 1, close)),
      range: null,
    }
  const arrow = rest.indexOf('-->')
  if (arrow >= 0) {
    const before = rest.slice(0, arrow).trim()
    const space = before.lastIndexOf(' ')
    const low = readNumber(before.slice(space + 1))
    const high = readNumber(rest.slice(arrow + 3))
    if (low !== null && high !== null && low !== high)
      return {
        title: oneLabel(unquoted(space < 0 ? '' : before.slice(0, space))),
        list: null,
        range: low < high ? [low, high] : [high, low],
      }
  }
  return { title: oneLabel(unquoted(rest)), list: null, range: null }
}

/** How many values along the x axis: the categories or the longest series. */
const count = (chart: XYChart): number =>
  chart.series.reduce(
    (most, own) => Math.max(most, own.values.length),
    chart.categories?.length ?? 0,
  )

/** Each position's name along the x axis: its category, its value in a range, or its number. */
function names(chart: XYChart): string[] {
  const many = count(chart)
  return Array.from({ length: many }, (_, at) => {
    const own = chart.categories?.[at]
    if (own !== undefined) return own
    const range = chart.xRange
    if (!range) return String(at + 1)
    const step = many > 1 ? at / (many - 1) : 0
    return formatNumber(2 * (range[0] / 2 + step * (range[1] / 2 - range[0] / 2)))
  })
}

/** The y axis's range: the one written, or the values' own with zero in it. */
function valueRange(chart: XYChart): readonly [number, number] {
  if (chart.yRange) return chart.yRange
  let low = 0
  let high = 0
  for (const own of chart.series)
    for (const value of own.values)
      if (value !== null) {
        low = Math.min(low, value)
        high = Math.max(high, value)
      }
  return high > low ? [low, high] : [low, low + 1]
}

/** Each series' name, given or made from its kind and place: `bar 1`, `line 2`. */
function seriesNames(chart: XYChart): string[] {
  const seen = { bar: 0, line: 0 }
  return chart.series.map((own) => {
    seen[own.kind]++
    return own.name || `${own.kind} ${seen[own.kind]}`
  })
}

/** What each series is drawn with: a fill for bars, a mark for lines; its colour is its place. */
function glyphs(chart: XYChart): string[] {
  const seen = { bar: 0, line: 0 }
  return chart.series.map((own) =>
    own.kind === 'bar' ? fillOf(seen.bar++) : MARKS[seen.line++ % MARKS.length]!,
  )
}

/** The key under a chart of more than one series, or of one with a name. */
function key(chart: XYChart, columns: number): Line[] {
  if (chart.series.length < 2 && !chart.series[0]!.name) return []
  const own = glyphs(chart)
  const line: Line = seriesNames(chart).flatMap((name, at) => [
    ...(at > 0 ? [span('  ', PLAIN)] : []),
    span(own[at]!, colourOf(at)),
    span(` ${name}`, PLAIN),
  ])
  return wrapped(line, columns)
}

/** The chart as columns over an x axis, its categories under it; null when they have no room. */
function upright(chart: XYChart, columns: number): Line[] | null {
  const many = count(chart)
  const [low, high] = valueRange(chart)
  const ticks = tickRows(low, high)
  const tickText = ticks.map((tick) => formatNumber(tick.value))
  const axis = widest(tickText) + 1
  const bars = chart.series.filter((own) => own.kind === 'bar').length
  const least = bars > 0 ? bars + 1 : 2
  const slot = Math.min(Math.floor((columns - axis - 1) / many), bars > 0 ? 4 * bars + 2 : 8)
  if (slot < least) return null
  const labels = names(chart)
  // Each category under its own slot, or its number there and its name in a key below.
  const numbered = widest(labels) > slot - 1
  if (numbered && String(many).length > slot - 1) return null
  const plot = axis + 1
  const wide = plot + many * slot
  const canvas = new Canvas(wide, HEIGHT + 2)
  const area: Plot = { canvas, wide, bars: new Uint8Array(wide * HEIGHT) }
  for (let row = 0; row < HEIGHT; row++) {
    const tick = ticks.findIndex((own) => own.row === row)
    if (tick >= 0) canvas.text(0, row, padStart(tickText[tick]!, axis - 1), DIM)
    canvas.text(axis, row, tick >= 0 ? '┤' : '│', DIM)
  }
  canvas.text(axis, HEIGHT, '└' + '─'.repeat(many * slot), DIM)
  const centre = (at: number) => plot + at * slot + Math.floor(slot / 2)
  labels.forEach((label, at) => {
    const text = numbered ? String(at + 1) : label
    canvas.text(centre(at) - Math.floor((width(text) - 1) / 2), HEIGHT + 1, text, PLAIN)
  })
  const own = glyphs(chart)
  const thick = bars > 0 ? Math.max(1, Math.floor((slot - 1) / bars)) : 0
  const start = Math.floor((slot - thick * bars) / 2)
  // The cell boundary the columns stand on: zero, or the axis's foot when zero is off the chart.
  const base = Math.round(clampTo(position(0, low, high), 0, 1) * HEIGHT)
  let bar = 0
  chart.series.forEach((series, at) => {
    if (series.kind !== 'bar') return
    series.values.forEach((value, place) => {
      if (value === null) return
      const x = plot + place * slot + start + bar * thick
      column(area, x, thick, base, position(value, low, high) * HEIGHT * 8, own[at]!, at)
    })
    bar++
  })
  chart.series.forEach((series, at) => {
    if (series.kind === 'line') trace(area, series.values, low, high, centre, own[at]!, at)
  })
  const out = titleRows(chart.title, columns)
  if (chart.yTitle) out.push(...wrapped([span(chart.yTitle, DIM)], columns))
  out.push(...canvas.rows())
  if (chart.xTitle) {
    const pad = Math.max(0, plot + Math.floor((many * slot - width(chart.xTitle)) / 2))
    const line = [span(chart.xTitle, DIM)]
    out.push(
      ...(width(chart.xTitle) + pad <= columns
        ? [[span(' '.repeat(pad), PLAIN), ...line]]
        : wrapped(line, columns)),
    )
  }
  if (numbered)
    out.push(
      ...wrapped(
        labels.flatMap((label, at) => [
          ...(at > 0 ? [span('  ', PLAIN)] : []),
          span(`${at + 1}`, DIM),
          span(` ${label}`, PLAIN),
        ]),
        columns,
      ),
    )
  out.push(...key(chart, columns))
  return out
}

/**
 * Where `value` is on the plot, in rows from its top, between the centres of the top and the
 * bottom rows: rounded, it is the row a column of that value ends in.
 */
const rowAt = (value: number, low: number, high: number): number =>
  clampTo((1 - position(value, low, high)) * HEIGHT - 0.5, 0, HEIGHT - 1)

/**
 * The y axis's ticks: round values (a one, two or five and its zeros) about a quarter of the range
 * apart, each on the row it falls in, no two on rows side by side.
 */
function tickRows(low: number, high: number): Array<{ value: number; row: number }> {
  const extent = 2 * (high / 2 - low / 2)
  const raw = (Number.isFinite(extent) ? extent : Number.MAX_VALUE) / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((own) => own * power).find((own) => own >= raw) ?? raw
  const out: Array<{ value: number; row: number }> = []
  // About five steps fit in the range, a step being a quarter of it or more; eight tries at most
  // whatever rounding does at the far ends of what a double holds.
  for (let at = Math.ceil(low / step), tries = 0; at * step <= high && tries < 8; at++, tries++) {
    const value = at * step
    const row = Math.round(rowAt(value, low, high))
    if (out.every((own) => Math.abs(own.row - row) > 1)) out.push({ value, row })
  }
  return out
}

const clampTo = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value

/**
 * The plot a chart's series are drawn on, with the cells a bar has filled: a line is drawn across
 * the gaps between columns and not through them, so a column keeps its height to the eye.
 */
interface Plot {
  canvas: Canvas
  wide: number
  bars: Uint8Array
}

/**
 * One bar's column, `thick` cells wide from `x`, from the cell boundary `base` (cells up from the
 * foot) to `top` (eighths up from the foot). Up from the base its top cell is filled to the eighth;
 * down from it, below zero, a cell is whole or half (`▀`), as no glyph fills a cell from above by
 * eighths.
 */
function column(
  area: Plot,
  x: number,
  thick: number,
  base: number,
  top: number,
  fill: string,
  at: number,
): void {
  const end = Math.round(clampTo(top, 0, HEIGHT * 8))
  for (let cell = 0; cell < HEIGHT; cell++) {
    const own =
      end >= base * 8
        ? cell >= base
          ? clampTo(end - 8 * cell, 0, 8)
          : 0
        : cell < base
          ? clampTo(8 * (cell + 1) - end, 0, 8)
          : 0
    if (own === 0) continue
    const up = end >= base * 8
    const glyph = own === 8 ? fill : up ? upward(own) : own >= 4 ? '▀' : ''
    if (!glyph) continue
    area.canvas.text(x, HEIGHT - 1 - cell, glyph.repeat(thick), colourOf(at))
    area.bars.fill(
      1,
      (HEIGHT - 1 - cell) * area.wide + x,
      (HEIGHT - 1 - cell) * area.wide + x + thick,
    )
  }
}

/**
 * A line series: its mark at each value's cell, and the cells between two values joined by the
 * glyph of the way it goes there. A value that is not a number breaks the line.
 */
function trace(
  area: Plot,
  values: ReadonlyArray<number | null>,
  low: number,
  high: number,
  centre: (at: number) => number,
  mark: string,
  at: number,
): void {
  const style = colourOf(at)
  const rowOf = (value: number) => rowAt(value, low, high)
  const marks: Array<readonly [number, number]> = []
  values.forEach((value, place) => {
    if (value === null) return
    const next = values[place + 1]
    const from = centre(place)
    marks.push([from, Math.round(rowOf(value))])
    if (next === undefined || next === null) return
    const to = centre(place + 1)
    const a = rowOf(value)
    const b = rowOf(next)
    const along = (x: number) => Math.round(a + ((b - a) * (x - from)) / (to - from))
    for (let x = from + 1; x < to; x++) {
      const before = along(x - 0.5)
      const after = along(x + 0.5)
      const glyph = before === after ? '─' : after < before ? '╱' : '╲'
      for (let row = Math.min(before, after); row <= Math.max(before, after); row++)
        if (!area.bars[row * area.wide + x]) area.canvas.text(x, row, glyph, style)
    }
  })
  // The marks last, over bars too: where a line passes over a value, the value is still seen.
  for (const [x, row] of marks) area.canvas.text(x, row, mark, style)
}

/** The chart turned: one row a value, each bar along its row from the foot of the range. */
function sideways(chart: XYChart, columns: number): Line[] | null {
  const [low, high] = valueRange(chart)
  // A bar along a row starts at the row's left: a range below zero would show less as shorter.
  if (low < 0) return null
  const labels = names(chart)
  const own = glyphs(chart)
  const name = widest(labels)
  const values = chart.series.flatMap((series) =>
    series.values.map((value) => (value === null ? '-' : formatNumber(value))),
  )
  const room = Math.min(MOST_BAR, columns - name - 3 - widest(values))
  if (room < LEAST_BAR) return null
  const out = titleRows(chart.title, columns)
  if (chart.yTitle) out.push([span(' '.repeat(name + 2), PLAIN), span(chart.yTitle, DIM)])
  labels.forEach((label, place) => {
    let named = false
    chart.series.forEach((series, at) => {
      const value = series.values[place]
      if (value === undefined) return
      const share = value === null ? 0 : clampTo(position(value, low, high), 0, 1)
      const drawn =
        value === null
          ? ''
          : series.kind === 'bar'
            ? across(share, room, own[at]!)
            : ' '.repeat(Math.min(room - 1, Math.round(share * (room - 1)))) + own[at]!
      out.push([
        span(padEnd(named ? '' : label, name), PLAIN),
        span(' │', DIM),
        span(drawn, colourOf(at)),
        span(' '.repeat(room - [...drawn].length + 1), PLAIN),
        span(value === null ? '-' : formatNumber(value), DIM),
      ])
      named = true
    })
    // A category no series reaches is still on the axis: a row with its name and no value.
    if (!named) out.push([span(padEnd(label, name), PLAIN), span(' │', DIM)])
  })
  if (chart.xTitle) out.push(...wrapped([span(chart.xTitle, DIM)], columns))
  out.push(...key(chart, columns))
  return out
}

/**
 * The chart as a table: the series across, the categories down. Too wide for the columns, each
 * category is one wrapped row, `jan: █ 5000 ● 5100`, the key above saying which is which.
 */
function table(chart: XYChart, columns: number): Line[] {
  const labels = names(chart)
  const own = glyphs(chart)
  const heads = seriesNames(chart).map((name, at) => `${own[at]!} ${name}`)
  const cells = labels.map((_, place) =>
    chart.series.map((series) => {
      const value = series.values[place]
      return value === undefined || value === null ? '-' : formatNumber(value)
    }),
  )
  const first = widest(labels)
  const sizes = heads.map((head, at) =>
    Math.max(width(head), ...cells.map((row) => width(row[at]!))),
  )
  const out = titleRows(chart.title, columns)
  const axes = [
    ...(chart.xTitle ? [`x: ${chart.xTitle}`] : []),
    ...(chart.yTitle ? [`y: ${chart.yTitle}`] : []),
  ]
  for (const text of axes) out.push(...wrapped([span(text, DIM)], columns))
  const fitsRow = first + sizes.reduce((sum, size) => sum + size + 2, 0) <= columns
  if (fitsRow) {
    const row = (head: string, texts: readonly string[], heading: boolean): Line => [
      span(padEnd(head, first), PLAIN),
      ...texts.flatMap((text, at): Span[] => [
        span('  ', PLAIN),
        span(
          heading ? padEnd(text, sizes[at]!) : padStart(text, sizes[at]!),
          heading ? colourOf(at) : PLAIN,
        ),
      ]),
    ]
    out.push(row('', heads, true))
    labels.forEach((label, place) => out.push(row(label, cells[place]!, false)))
    return out
  }
  out.push(...heads.flatMap((head, at) => wrapped([span(head, colourOf(at))], columns)))
  labels.forEach((label, place) => {
    const line: Line = [span(`${label}:`, PLAIN)]
    cells[place]!.forEach((text, at) => {
      line.push(span(' ', PLAIN), span(own[at]!, colourOf(at)), span(` ${text}`, PLAIN))
    })
    out.push(...wrapped(line, columns))
  })
  return out
}
