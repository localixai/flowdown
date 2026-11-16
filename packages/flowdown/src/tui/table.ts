/**
 * A table drawn in columns: each as wide as what it holds while the row fits, and shared out by
 * what each needs when it does not. A table too narrow to draw at all (under five columns of the
 * terminal for each of its own) is written cell under cell: nothing is lost, only the grid.
 */
import type { Align } from '../engine/types'
import { BOLD, DIM, merged, patch, type Line } from './style'
import { lineWidth, span, wrap } from './wrap'
import { width } from './width'

/**
 * What a table's rows were measured and laid out as, kept by a view while the table grows: a row
 * that is the same object as last time is not measured again, and is laid out again only when
 * the widths of the columns changed. Given only for a table with nothing before its rows (no
 * quote, no list): what a row is drawn as is then its own.
 */
export type TableMemo = WeakMap<Line[], Measured>

interface Measured {
  count: number
  /** For each column, the width the row's cell takes on one line, and its longest word. */
  most: number[]
  least: number[]
  /** The widths it was last laid out for, and its rows then (merged, as a block's are). */
  sizes?: string
  laid?: Line[][]
  lines?: Line[]
}

export const createTableMemo = (): TableMemo => new WeakMap()

function measure(row: Line[], count: number, memo: TableMemo | undefined): Measured {
  const kept = memo?.get(row)
  if (kept && kept.count === count) return kept
  const most = Array.from({ length: count }, () => 1)
  const least = Array.from({ length: count }, () => 1)
  for (let at = 0; at < Math.min(count, row.length); at++) {
    const cell = row[at]!
    most[at] = Math.max(1, lineWidth(cell))
    for (const run of cell)
      for (const word of run.text.split(' ')) least[at] = Math.max(least[at]!, width(word))
  }
  const made = { count, most, least }
  memo?.set(row, made)
  return made
}

/** The width of each column: what it holds when the table fits `budget`, a fair share when not. */
function widths(measured: Measured[], columns: number, budget: number): number[] {
  const most = Array.from({ length: columns }, () => 1)
  const least = Array.from({ length: columns }, () => 1)
  for (const row of measured) {
    for (let at = 0; at < columns; at++) {
      most[at] = Math.max(most[at]!, row.most[at]!)
      least[at] = Math.max(least[at]!, row.least[at]!)
    }
  }
  if (most.reduce((sum, own) => sum + own, 0) <= budget) return most
  // No column asks for more than its share as its least: a long word is broken, not the table.
  const share = Math.max(1, Math.floor(budget / columns))
  for (let at = 0; at < columns; at++) least[at] = Math.min(least[at]!, share)
  const spare = Math.max(0, budget - least.reduce((sum, own) => sum + own, 0))
  const more = (at: number) => Math.max(0, most[at]! - least[at]!)
  let wanted = 0
  for (let at = 0; at < columns; at++) wanted += more(at)
  const out = least.map((own, at) => own + Math.floor((more(at) * spare) / Math.max(1, wanted)))
  let left = Math.max(0, budget - out.reduce((sum, own) => sum + own, 0))
  while (left > 0) {
    const before = left
    for (let at = 0; at < columns; at++) {
      if (left > 0 && out[at]! < most[at]!) {
        out[at]!++
        left--
      }
    }
    if (left === before) break
  }
  return out
}

/** `rows` of cells (the first is the header) as terminal rows no wider than `columns`. */
export function drawTable(
  rows: Line[][],
  aligns: readonly Align[],
  columns: number,
  first: Line,
  rest: Line,
  memo?: TableMemo,
): Line[] {
  const count = aligns.length
  if (count === 0) return []
  const room = Math.max(0, columns - Math.max(lineWidth(rest), lineWidth(first)))
  const out: Line[] = []
  if (room < count * 5 + 1) {
    for (const row of rows) {
      if (out.length > 0) out.push([...rest])
      for (const cell of row)
        out.push(...wrap(cell, columns, out.length === 0 ? first : rest, rest))
    }
    return out
  }
  const keep = first.length === 0 && rest.length === 0 ? memo : undefined
  const measured = rows.map((row) => measure(row, count, keep))
  const sizes = widths(measured, count, Math.max(0, room - (count * 3 + 1)))
  const key = sizes.join(',')
  const rule = sizes.map((size) => '─'.repeat(size + 2)).join('┼')
  const ruleRow: Line = [...rest, span(`├${rule}┤`, DIM)]
  const laid = rows.map((row, index) => {
    const own = measured[index]!
    if (keep && own.sizes === key && own.laid) return own.laid
    const cells = sizes.map((size, at) => wrap(row[at] ?? [], size, [], []))
    if (keep) Object.assign(own, { sizes: key, laid: cells, lines: undefined })
    return cells
  })
  // Rows of one line each need no rule between them; once one wraps, every row is ruled apart.
  const ruled = laid.slice(1).some((row) => row.some((cell) => cell.length > 1))
  const last = laid.length - 1
  laid.forEach((cells, index) => {
    const own = measured[index]!
    const header = index === 0
    // A row is the header or not for as long as it is the same object.
    if (keep && own.lines) {
      for (const line of own.lines) out.push(line)
    } else {
      const from = out.length
      const height = Math.max(1, ...cells.map((cell) => cell.length))
      for (let line = 0; line < height; line++) {
        const drawn: Line = [...(out.length === 0 ? first : rest), span('│', DIM)]
        for (let at = 0; at < count; at++) {
          const cell = cells[at]![line] ?? []
          const padding = Math.max(0, sizes[at]! - lineWidth(cell))
          const align = aligns[at]
          const left = align === 'right' ? padding : align === 'center' ? padding >> 1 : 0
          drawn.push(span(' '.repeat(left + 1), {}))
          for (const run of cell) drawn.push(header ? span(run.text, patch(run.style, BOLD)) : run)
          drawn.push(span(' '.repeat(padding - left + 1), {}), span('│', DIM))
        }
        out.push(keep ? merged(drawn) : drawn)
      }
      if (keep) own.lines = out.slice(from)
    }
    if (index === 0 || (ruled && index < last)) out.push(keep ? merged(ruleRow) : ruleRow)
  })
  return out
}
