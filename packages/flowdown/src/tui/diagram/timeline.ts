/**
 * Timelines in a terminal: a rail with a `●` for each period, its name over the rail and its
 * events under it, each period a column and each section a rule over its periods. When the
 * columns do not fit across, the rail turns down the left edge and each period's events hang
 * from it; when not even that leaves room for a word, it is a list.
 */
import type { DiagramKind } from './kind'
import { bounded, longestWord, para, within } from './kit'
import { MOST_ROWS } from './outline'
import { labelLines, widest, wrapLines } from './text'
import { BOLD, CODE, DIM, PLAIN, merged, type Line } from '../style'
import { width } from '../width'
import { lineWidth, span } from '../wrap'

/** Past these a timeline is not read on. */
const MOST_PERIODS = 2000
const MOST_EVENTS = 200
/** The width a period's name and events are wrapped at when the periods stand across. */
const COLUMN = 18
/** Columns between two periods across. */
const GAP = 3
/** The columns a word needs at the least down the rail; below it the timeline is a list. */
const LEAST = 4

interface Period {
  label: string[]
  events: string[][]
  section: number
}

interface Timeline {
  title: string[]
  sections: string[][]
  periods: Period[]
}

export const timelineDiagram: DiagramKind = {
  matches: (header) => /^timeline\b/.test(header),
  draw(lines, columns) {
    const chart = parseTimeline(lines)
    if (!chart || !(columns >= 2)) return null
    const room = Math.floor(columns)
    const across = acrossOf(chart, room)
    if (across) return across
    const down = downOf(chart, room)
    return (down && within(down, room)) || listOf(chart, room)
  },
}

function parseTimeline(lines: readonly string[]): Timeline | null {
  if (!/^timeline\b/.test(lines[0]?.trim() ?? '')) return null
  const chart: Timeline = { title: [], sections: [], periods: [] }
  for (const raw of lines.slice(1)) {
    const line = raw.trim()
    let match: RegExpExecArray | null
    if ((match = /^title\s+(.*)$/i.exec(line))) chart.title = labelLines(match[1]!)
    else if ((match = /^section\s+(.*)$/i.exec(line))) chart.sections.push(labelLines(match[1]!))
    else if (/^(?:accTitle|accDescr)\b/.test(line)) continue
    else {
      const parts = line.split(':')
      const events = parts
        .slice(1)
        .map(labelLines)
        .filter((event) => event.length > 0)
      const last = chart.periods.at(-1)
      // A line that starts with `:` goes on with the events of the period before.
      if (parts[0]!.trim() === '') {
        if (last) last.events.push(...events.slice(0, MOST_EVENTS - last.events.length))
        continue
      }
      if (chart.periods.length >= MOST_PERIODS) break
      const label = labelLines(parts[0]!)
      if (label.length === 0) continue
      chart.periods.push({
        label,
        events: events.slice(0, MOST_EVENTS),
        section: chart.sections.length - 1,
      })
    }
  }
  return chart.periods.length > 0 ? chart : null
}

const titleRows = (chart: Timeline, columns: number): Line[] =>
  chart.title.length > 0
    ? [...chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0)), []]
    : []

/**
 * The periods side by side: a row of section rules, the names, the rail, then the events, each a
 * `•` and its words. Null when they are wider than the columns, or a word is wider than a period.
 */
function acrossOf(chart: Timeline, columns: number): Line[] | null {
  const names = chart.periods.map((period) => wrapLines(period.label, COLUMN))
  const events = chart.periods.map((period) =>
    period.events.map((event) => wrapLines(event, COLUMN - 2)),
  )
  const words = chart.periods.flatMap((period) => [...period.label, ...period.events.flat()])
  if (longestWord(words) > COLUMN - 2) return null
  const wide = chart.periods.map((_, at) =>
    Math.max(widest(names[at]!), ...events[at]!.map((lines) => widest(lines) + 2)),
  )
  // A section's rule holds its name: its last period is widened to make room.
  const sections = chart.sections.map(() => ({ from: -1, to: -1 }))
  chart.periods.forEach((period, at) => {
    const own = sections[period.section]
    if (!own) return
    if (own.from < 0) own.from = at
    own.to = at
  })
  sections.forEach((own, at) => {
    if (own.from < 0) return
    let room = -GAP
    for (let period = own.from; period <= own.to; period++) room += wide[period]! + GAP
    const need = width(chart.sections[at]!.join(' ')) + 2 - room
    if (need > 0) wide[own.to]! += need
  })
  const x: number[] = []
  let at = 1
  for (const own of wide) {
    x.push(at)
    at += own + GAP
  }
  const total = at - GAP + 1
  if (total > columns) return null
  const out = titleRows(chart, columns)
  if (sections.some((own) => own.from >= 0)) out.push([])
  sections.forEach((own, section) => {
    if (own.from < 0) return
    const text = chart.sections[section]!.join(' ')
    const from = x[own.from]!
    const rule = x[own.to]! + wide[own.to]! - from - width(text) - 1
    out
      .at(-1)!
      .push(
        ...placed(out.at(-1)!, from, [
          span(text, BOLD),
          span(` ${'─'.repeat(Math.max(1, rule))}`, DIM),
        ]),
      )
  })
  const tall = Math.max(...names.map((lines) => lines.length))
  for (let row = 0; row < tall; row++) {
    const line: Line = []
    names.forEach((lines, own) =>
      line.push(...placed(line, x[own]!, [span(lines[row] ?? '', BOLD)])),
    )
    out.push(line)
  }
  const rail = Array.from({ length: total }, () => '─')
  for (const own of x) rail[own] = '●'
  out.push(merged(rail.map((char) => span(char, char === '●' ? CODE : DIM))))
  const hung = events.map((list) =>
    list.flatMap((lines) => lines.map((line, row) => ({ line, row }))),
  )
  const deep = Math.max(0, ...hung.map((list) => list.length))
  for (let row = 0; row < deep; row++) {
    const line: Line = []
    hung.forEach((list, own) => {
      const one = list[row]
      if (one)
        line.push(
          ...placed(line, x[own]!, [span(one.row === 0 ? '• ' : '  ', DIM), span(one.line, PLAIN)]),
        )
    })
    out.push(line)
  }
  return within(out, columns)
}

/** `spans` to be added to `line` so that they start at column `x`: the spaces before them first. */
function placed(line: Line, x: number, spans: Line): Line {
  const gap = x - lineWidth(line)
  return gap > 0 ? [span(' '.repeat(gap), PLAIN), ...spans] : spans
}

/** The rail down the left edge: `● 2021`, and under it `│ • an event`. */
function downOf(chart: Timeline, columns: number): Line[] | null {
  const room = columns - 4
  const words = chart.periods.flatMap((period) => [...period.label, ...period.events.flat()])
  if (room < LEAST || longestWord(words) > room) return null
  const out = titleRows(chart, columns)
  let section = -1
  chart.periods.forEach((period, at) => {
    if (period.section !== section && period.section >= 0) {
      if (at > 0) out.push([])
      for (const line of chart.sections[period.section]!)
        out.push(...para([span(line, BOLD)], columns, 0))
    }
    section = period.section
    const next = chart.periods[at + 1]
    const rail = next && next.section === period.section ? '│' : ' '
    wrapLines(period.label, columns - 2).forEach((line, row) =>
      out.push([span(row === 0 ? '●' : rail, row === 0 ? CODE : DIM), span(` ${line}`, BOLD)]),
    )
    for (const event of period.events)
      wrapLines(event, room).forEach((line, row) =>
        out.push([span(rail, DIM), span(row === 0 ? ' • ' : '   ', DIM), span(line, PLAIN)]),
      )
  })
  return out
}

/** Each period and its events, the events indented under it. */
function listOf(chart: Timeline, columns: number): Line[] | null {
  const out = chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0))
  let section = -1
  for (const period of chart.periods) {
    if (out.length > MOST_ROWS) return null
    const indent = period.section >= 0 ? 2 : 0
    if (period.section !== section && period.section >= 0)
      for (const line of chart.sections[period.section]!)
        out.push(...para([span(line, BOLD)], columns, 0))
    section = period.section
    out.push(...para([span(period.label.join(' '), BOLD)], columns, indent))
    for (const event of period.events)
      out.push(...para([span(event.join(' '), PLAIN)], columns, indent + 2))
  }
  return bounded(out)
}
