/**
 * Sankey diagrams in a terminal. A sankey's bands cross and merge in curves cells cannot draw, so
 * each flow is written as what it says: grouped under its source, with the source's total, one row
 * a flow, `──▶ Target ████▌ 124.7`. Every bar is measured against the largest flow of the whole
 * diagram, so a thin flow under one source and a thick one under another compare at a glance.
 *
 * A source that is also some flow's target is marked `↳` before its name: the reader sees where
 * a group continues one above it. Without room for the bars, each flow is a wrapped row.
 */
import {
  across,
  bounded,
  colourOf,
  fits,
  formatNumber,
  MOST_ITEMS,
  oneLabel,
  padEnd,
  padStart,
  position,
  readNumber,
  wrapped,
} from './chart'
import type { DiagramKind } from './kind'
import { widest } from './text'
import { BOLD, DIM, PLAIN, type Line } from '../style'
import { width } from '../width'
import { span } from '../wrap'

interface Flow {
  target: string
  value: number
}

interface Source {
  name: string
  flows: Flow[]
  /** Whether some flow ends here: the source is a step between others. */
  between: boolean
}

const HEADER = /^sankey(?:-beta)?\s*$/i
const ARROW = '──▶ '
const LEAST_BAR = 6
const MOST_BAR = 40

export const sankeyDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw(lines, columns) {
    const sources = parse(lines)
    if (!sources) return null
    const picture = bars(sources, columns)
    return bounded(picture && fits(picture, columns) ? picture : list(sources, columns))
  },
}

function parse(lines: readonly string[]): Source[] | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const sources: Source[] = []
  const index = new Map<string, number>()
  const targets = new Set<string>()
  let read = 0
  for (const line of lines.slice(1)) {
    const fields = csv(line)
    if (fields.length !== 3) continue
    const value = readNumber(fields[2]!)
    if (value === null) continue
    if (++read > MOST_ITEMS) return null
    const name = oneLabel(fields[0]!)
    const target = oneLabel(fields[1]!)
    let at = index.get(name)
    if (at === undefined) {
      at = sources.push({ name, flows: [], between: false }) - 1
      index.set(name, at)
    }
    sources[at]!.flows.push({ target, value })
    targets.add(target)
  }
  for (const source of sources) source.between = targets.has(source.name)
  return sources.length > 0 ? sources : null
}

/**
 * A row of CSV as Mermaid reads it: fields split at commas, a field in double quotes may hold
 * commas, and `""` in it is one quote.
 */
function csv(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let at = 0; at < line.length; at++) {
    const char = line[at]!
    if (quoted) {
      if (char !== '"') field += char
      else if (line[at + 1] === '"') {
        field += '"'
        at++
      } else quoted = false
    } else if (char === '"') quoted = true
    else if (char === ',') {
      fields.push(field)
      field = ''
    } else field += char
  }
  fields.push(field)
  return fields.map((own) => own.trim())
}

const total = (source: Source): number =>
  // Halved and doubled: values near the most a double holds do not add past it.
  2 * source.flows.reduce((sum, flow) => sum + flow.value / 2, 0)

const sourceName = (source: Source): string => (source.between ? `↳ ${source.name}` : source.name)

/** Each source's flows as bars under it; null when the names leave the bars no room. */
function bars(sources: readonly Source[], columns: number): Line[] | null {
  const flows = sources.flatMap((source) => source.flows)
  const largest = flows.reduce((most, flow) => Math.max(most, flow.value), 0)
  const name = widest(flows.map((flow) => flow.target))
  const values = widest(flows.map((flow) => formatNumber(flow.value)))
  // Two columns in, the arrow, the target, a space, the bar, a space, the value.
  const room = Math.min(MOST_BAR, columns - 2 - width(ARROW) - name - 2 - values)
  if (room < LEAST_BAR) return null
  const out: Line[] = []
  sources.forEach((source, at) => {
    out.push(
      ...wrapped(
        [span(sourceName(source), BOLD), span(` ${formatNumber(total(source))}`, DIM)],
        columns,
      ),
    )
    for (const flow of source.flows) {
      const bar = across(largest > 0 ? position(flow.value, 0, largest) : 0, room, '█')
      out.push([
        span(`  ${ARROW}`, DIM),
        span(padEnd(flow.target, name + 1), PLAIN),
        span(bar, colourOf(at)),
        span(' '.repeat(room - [...bar].length + 1), PLAIN),
        span(padStart(formatNumber(flow.value), values), DIM),
      ])
    }
  })
  return out
}

/** Each source and its total, then its flows as wrapped rows, `──▶ Target 124.7`. */
function list(sources: readonly Source[], columns: number): Line[] {
  return sources.flatMap((source) => [
    ...wrapped(
      [span(sourceName(source), BOLD), span(` ${formatNumber(total(source))}`, DIM)],
      columns,
    ),
    ...source.flows.flatMap((flow) =>
      wrapped(
        [span(ARROW, DIM), span(flow.target, PLAIN), span(` ${formatNumber(flow.value)}`, DIM)],
        columns,
        2,
      ),
    ),
  ])
}
