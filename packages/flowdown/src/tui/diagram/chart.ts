/**
 * What the charts of this folder share: numbers read and written as a reader expects them, bars
 * measured in eighths of a cell, the fill and colour each series is told apart by, and rows
 * wrapped with their continuation indented. Nothing here knows which chart it is drawing.
 *
 * A chart is told apart by its fills first and its colours second: a terminal without colour, a
 * reader who cannot tell red from green and a copy pasted as text all still see `█` against `▓`.
 */
import { MOST_ROWS } from './outline'
import { labelLines } from './text'
import { BOLD, PLAIN, type Colour, type Line, type Style } from '../style'
import { width } from '../width'
import { lineWidth, span, wrap } from '../wrap'

/** Past this many items (slices, points, fields, nodes, values) a chart is not read. */
export const MOST_ITEMS = 1000

/** The fills series are told apart by, densest first: each reads as itself in one cell. */
export const FILLS = ['█', '▓', '▒', '░', '▚', '▞', '▙', '▟', '▛', '▜'] as const
/** The colours series take in turn; each has a readable shade on light and dark themes alike. */
const COLOURS: readonly Colour[] = ['cyan', 'magenta', 'yellow', 'green', 'red']

export const fillOf = (at: number): string => FILLS[at % FILLS.length]!
export const colourOf = (at: number): Style => ({ color: COLOURS[at % COLOURS.length]! })

// A cell's part of a bar, in eighths: across for a bar along a row, up for a column.
const ACROSS = ' ▏▎▍▌▋▊▉'
const UP = ' ▁▂▃▄▅▆▇'

const clamp = (value: number): number => (value > 0 ? (value < 1 ? value : 1) : 0)

/**
 * A bar along a row, `fraction` (0 to 1) of `cells`: whole cells of `fill`, then the eighth of a
 * cell that is left, so two bars a cell apart in length still differ. Never longer than `cells`.
 */
export function across(fraction: number, cells: number, fill: string): string {
  const eighths = Math.round(clamp(fraction) * Math.max(0, cells) * 8)
  const part = eighths % 8
  return fill.repeat(Math.floor(eighths / 8)) + (part ? ACROSS[part]! : '')
}

/** The glyph of a column's top cell holding `eighths` (1 to 7) of it, filled from below. */
export const upward = (eighths: number): string => UP[Math.max(0, Math.min(7, eighths))]!

// A number as Markdown and Mermaid write one; anything else (`1,000`, `12%`, `NaN`) is not one.
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

/** `text` as a number, or null when it is not one or is past what a double holds. */
export function readNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed.length > 40 || !NUMBER.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/**
 * `value` as a reader expects to see it: two decimals at most, and a figure too large or too small
 * to read in digits written with its exponent (`1.20e15`), so no value takes more than 13 columns.
 */
export function formatNumber(value: number): string {
  const size = Math.abs(value)
  if (size !== 0 && (size >= 1e9 || size < 0.01)) return value.toExponential(2).replace('e+', 'e')
  const rounded = Math.round(value * 100) / 100
  return String(rounded === 0 ? 0 : rounded)
}

/** A share (0 to 1) as a percentage with one decimal: `79.0%`. */
export const percent = (share: number): string => `${(100 * clamp(share)).toFixed(1)}%`

/**
 * Each value's share of the positive values' sum, from 0 to 1; a value below zero has none.
 * Measured against the largest, so values near the most a double holds do not add up past it.
 */
export function shares(values: readonly number[]): number[] {
  const largest = values.reduce((most, value) => Math.max(most, value), 0)
  if (largest <= 0) return values.map(() => 0)
  const scaled = values.map((value) => Math.max(0, value) / largest)
  const total = scaled.reduce((sum, value) => sum + value, 0)
  return scaled.map((value) => value / total)
}

/**
 * Where `value` sits from `low` (0) to `high` (1), unbounded; halved first, so that a range
 * from the least a double holds to the most does not overflow.
 */
export function position(value: number, low: number, high: number): number {
  const extent = high / 2 - low / 2
  return extent > 0 ? (value / 2 - low / 2) / extent : 0
}

/**
 * `cells` shared out by `parts` (each from 0 to 1, summing to 1): each gets its whole cells, and
 * the cells left go to the largest remainders, so the parts fill the whole and no more.
 */
export function apportion(parts: readonly number[], cells: number): number[] {
  const exact = parts.map((part) => part * cells)
  const out = exact.map(Math.floor)
  let left = cells - out.reduce((sum, own) => sum + own, 0)
  const order = exact
    .map((own, at) => ({ at, rest: own - Math.floor(own) }))
    .toSorted((a, b) => b.rest - a.rest || a.at - b.at)
  for (const { at, rest } of order) {
    if (left <= 0 || rest <= 0) break
    out[at]!++
    left--
  }
  return out
}

/** A label's rows joined as one: a chart writes a name on one row, or wraps it as words. */
export const oneLabel = (raw: string): string => labelLines(raw).join(' ')

/** `text` with spaces after it to `columns`. */
export const padEnd = (text: string, columns: number): string =>
  text + ' '.repeat(Math.max(0, columns - width(text)))

/** `text` with spaces before it to `columns`. */
export const padStart = (text: string, columns: number): string =>
  ' '.repeat(Math.max(0, columns - width(text))) + text

/**
 * `line` wrapped to `columns`, starting `indent` columns in and going on two further in. An indent
 * leaves two columns at least: a character two columns wide must fit after it.
 */
export function wrapped(line: Line, columns: number, indent = 0): Line[] {
  const first = Math.min(indent, Math.max(0, columns - 2))
  const rest = Math.min(indent + 2, Math.max(0, columns - 2))
  return wrap(
    line,
    columns,
    first ? [span(' '.repeat(first), PLAIN)] : [],
    rest ? [span(' '.repeat(rest), PLAIN)] : [],
  )
}

/** A chart's title as its first rows, bold and wrapped flush left; none when it has no title. */
export const titleRows = (title: string, columns: number): Line[] =>
  title ? wrap([span(title, BOLD)], columns, [], []) : []

/** Whether no row of `lines` is wider than `columns`. */
export const fits = (lines: readonly Line[], columns: number): boolean =>
  lines.every((line) => lineWidth(line) <= columns)

/** `lines`, or null when they are more rows than a reply holds. */
export const bounded = (lines: Line[]): Line[] | null => (lines.length > MOST_ROWS ? null : lines)

/**
 * The items of a list as Mermaid writes one, `a, "b, c", d`: split at the commas outside quotes,
 * each trimmed. Read in one pass, whatever the list holds.
 */
export function splitList(text: string): string[] {
  const items: string[] = []
  let item = ''
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    if (char === ',' && !quoted) {
      items.push(item.trim())
      item = ''
    } else item += char
  }
  items.push(item.trim())
  return items.length === 1 && items[0] === '' ? [] : items
}

/** What a `"quoted"` word is without its quotes; a word not quoted is itself. */
export const unquoted = (text: string): string => {
  const trimmed = text.trim()
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed
}
