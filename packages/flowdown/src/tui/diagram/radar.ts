/**
 * Radar charts (`radar-beta`) in a terminal. A polygon on spokes drawn in cells bends where the
 * cells do, not where the values are, so the chart is the table it stands for: one block an axis,
 * one row in it a curve, each value a bar from the chart's `min` to its `max` in the curve's own
 * fill and colour. Reading down a block compares the curves on one axis; reading the same row
 * down the blocks follows one curve round.
 *
 * With one curve, each axis is a single row. Without the room for a bar, the values are a list.
 */
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
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest } from './text'
import { BOLD, DIM, PLAIN, type Line } from '../style'
import { span } from '../wrap'

interface Axis {
  id: string
  label: string
}

interface Curve {
  label: string
  /** One a axis, in the axes' order; null where the curve gives the axis no value. */
  values: Array<number | null>
}

interface Radar {
  title: string
  axes: Axis[]
  curves: Curve[]
  min: number | null
  max: number | null
}

const HEADER = /^radar(?:-beta)?\s*$/i
const LINE = /^(title|axis|curve|max|min)\b\s*(.*)$/i
/** `id`, or `id["Label"]`: an axis or a curve as it is named. */
const NAMED = /^([^\s[{]+)\s*(?:\[(.*)\])?$/
const LEAST_BAR = 8
const MOST_BAR = 40

export const radarDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw(lines, columns) {
    const radar = parse(lines)
    if (!radar) return null
    const picture = bars(radar, columns)
    return bounded(picture && fits(picture, columns) ? picture : list(radar, columns))
  },
}

function parse(lines: readonly string[]): Radar | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const radar: Radar = { title: '', axes: [], curves: [], min: null, max: null }
  // A curve's values may name their axes (`{ m: 80 }`): those are matched once every axis is read.
  const pending: Array<{ curve: Curve; items: string[] }> = []
  let read = 0
  for (const line of lines.slice(1)) {
    const match = LINE.exec(line)
    if (!match) continue
    const keyword = match[1]!.toLowerCase()
    const rest = match[2]!
    if (keyword === 'title') radar.title = oneLabel(rest)
    else if (keyword === 'max' || keyword === 'min') radar[keyword] = readNumber(rest)
    else if (keyword === 'axis')
      for (const item of splitList(rest)) {
        const named = NAMED.exec(item)
        if (named) radar.axes.push({ id: named[1]!, label: oneLabel(named[2] ?? named[1]!) })
      }
    else {
      const open = rest.indexOf('{')
      const close = rest.lastIndexOf('}')
      if (open < 0 || close < open) continue
      const named = NAMED.exec(rest.slice(0, open).trim())
      if (!named) continue
      const curve: Curve = { label: oneLabel(named[2] ?? named[1]!), values: [] }
      const items = splitList(rest.slice(open + 1, close))
      read += items.length
      radar.curves.push(curve)
      pending.push({ curve, items })
    }
    if (read + radar.axes.length > MOST_ITEMS) return null
  }
  const ids = radar.axes.map((axis) => axis.id)
  for (const { curve, items } of pending) {
    curve.values = ids.map(() => null)
    items.forEach((item, at) => {
      const colon = item.indexOf(':')
      const place = colon < 0 ? at : ids.indexOf(item.slice(0, colon).trim())
      if (place >= 0 && place < ids.length)
        curve.values[place] = readNumber(colon < 0 ? item : item.slice(colon + 1))
    })
  }
  return radar.axes.length > 0 && radar.curves.length > 0 ? radar : null
}

/** The range the bars run over: `min` and `max` as written, or zero and the largest value. */
function range(radar: Radar): readonly [number, number] {
  const values = radar.curves.flatMap((curve) => curve.values.filter((value) => value !== null))
  const low = radar.min ?? Math.min(0, ...values)
  const high = radar.max ?? Math.max(low + 1, ...values)
  return high > low ? [low, high] : [low, low + 1]
}

const text = (value: number | null): string => (value === null ? '-' : formatNumber(value))

/** Each axis's curves as bars; null when the names leave the bars no room. */
function bars(radar: Radar, columns: number): Line[] | null {
  const [low, high] = range(radar)
  const single = radar.curves.length === 1
  const names = single
    ? widest(radar.axes.map((axis) => axis.label))
    : widest(radar.curves.map((curve) => curve.label)) + 4
  const values = widest(radar.curves.flatMap((curve) => curve.values.map(text)))
  const room = Math.min(MOST_BAR, columns - names - 2 - values)
  if (room < LEAST_BAR) return null
  const bar = (curve: Curve, at: number, axis: number, name: string): Line => {
    const value = curve.values[axis]!
    const drawn = value === null ? '' : across(position(value, low, high), room, fillOf(at))
    return [
      span(padEnd(name, names + 1), PLAIN),
      span(drawn, colourOf(at)),
      span(' '.repeat(room - [...drawn].length + 1), PLAIN),
      span(padStart(text(value), values), DIM),
    ]
  }
  const out = titleRows(radar.title, columns)
  // Over the bars, the range they run over; with one curve, its name too, as no row has it.
  const heading = single
    ? [span(fillOf(0), colourOf(0)), span(` ${radar.curves[0]!.label}  `, PLAIN)]
    : []
  out.push([
    span(' '.repeat(names + 1), PLAIN),
    ...heading,
    span(`${formatNumber(low)} to ${formatNumber(high)}`, DIM),
  ])
  radar.axes.forEach((axis, place) => {
    if (single) {
      out.push(bar(radar.curves[0]!, 0, place, axis.label))
      return
    }
    out.push(...wrapped([span(axis.label, BOLD)], columns))
    radar.curves.forEach((curve, at) =>
      out.push(bar(curve, at, place, `  ${fillOf(at)} ${curve.label}`)),
    )
  })
  return out
}

/** Each axis, then each curve's value on it, wrapped: `▓ Bob 70`. */
function list(radar: Radar, columns: number): Line[] {
  const out = titleRows(radar.title, columns)
  radar.axes.forEach((axis, place) => {
    out.push(...wrapped([span(axis.label, BOLD)], columns))
    radar.curves.forEach((curve, at) => {
      out.push(
        ...wrapped(
          [
            span(fillOf(at), colourOf(at)),
            span(` ${curve.label}`, PLAIN),
            span(` ${text(curve.values[place]!)}`, DIM),
          ],
          columns,
          2,
        ),
      )
    })
  })
  return out
}
