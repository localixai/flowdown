/**
 * Gantt charts in a terminal: each task a row, its name on the left and its bar on the right,
 * laid against a date axis that is scaled to what the terminal leaves for it. A bar's fill says
 * what the task is (`█` to do, `▓` active, `░` done, `▒` critical), so that it is read without
 * its colour; a milestone is a `◆`. A chart whose names leave no room for bars is written as a
 * list of its tasks with their dates.
 *
 * Dates are read and written in UTC: what a chart says is the same on every machine, and a day
 * is always twenty-four hours long. There is no today here: the same source draws the same rows.
 */
import type { DiagramKind } from './kind'
import { bounded, longestWord, pad, para, within } from './kit'
import { MOST_ROWS } from './outline'
import { labelLines, widest, wrapLines } from './text'
import {
  BOLD,
  CODE,
  DIM,
  FAILED,
  PLAIN,
  WAITING,
  lineText,
  patch,
  type Line,
  type Style,
} from '../style'
import { width } from '../width'
import { span } from '../wrap'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** Past these a chart is not read on, and past the second it is written as a list. */
const MOST_TASKS = 2000
const MOST_DRAWN = 500
/** No duration is longer than this (ten thousand years): a date past it is not one. */
const LONGEST = 10_000 * 365 * DAY
/** The days a task's end is walked over to skip what `excludes` names; past that it is left. */
const MOST_DAYS_WALKED = 4000
/** Columns a bar needs at the least, and a name, before the picture is given up for the list. */
const LEAST_BARS = 12
const LEAST_NAME = 6

type Start = { kind: 'date'; at: number } | { kind: 'after'; ids: string[] } | { kind: 'previous' }
type End =
  | { kind: 'date'; at: number }
  | { kind: 'span'; ms: number; days: boolean }
  | { kind: 'until'; ids: string[] }
  | { kind: 'none' }

interface Task {
  name: string[]
  section: number
  id: string
  done: boolean
  active: boolean
  crit: boolean
  milestone: boolean
  from: Start
  to: End
  start: number | null
  end: number | null
}

interface Gantt {
  title: string[]
  sections: string[][]
  tasks: Task[]
  axis: string | null
  /** Whether no date was written: the axis then counts days from the first. */
  relative: boolean
}

export const ganttDiagram: DiagramKind = {
  matches: (header) => /^gantt\b/.test(header),
  draw(lines, columns) {
    const chart = parseGantt(lines)
    if (!chart || !(columns >= 2)) return null
    const room = Math.floor(columns)
    const drawn = chart.tasks.length <= MOST_DRAWN ? picture(chart, room) : null
    return (drawn && within(drawn, room)) || listOf(chart, room)
  },
}

// --- Reading ---

const TAGS = new Set(['done', 'active', 'crit', 'milestone'])
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const SKIPPED =
  /^(?:todayMarker|tickInterval|weekday|topAxis|displayMode|click|includes|accTitle|accDescr)\b/i

function parseGantt(lines: readonly string[]): Gantt | null {
  if (!/^gantt\b/.test(lines[0]?.trim() ?? '')) return null
  const chart: Gantt = { title: [], sections: [], tasks: [], axis: null, relative: false }
  let format = 'YYYY-MM-DD'
  let inclusive = false
  const off = { weekends: false, friday: false, days: new Set<number>(), dates: new Set<number>() }
  const excludes: string[] = []
  for (const raw of lines.slice(1)) {
    if (chart.tasks.length >= MOST_TASKS) break
    const line = raw.trim()
    let match: RegExpExecArray | null
    if ((match = /^title\s+(.*)$/i.exec(line))) chart.title = labelLines(match[1]!)
    else if ((match = /^dateFormat\s+(.+)$/i.exec(line))) format = match[1]!.trim()
    else if ((match = /^axisFormat\s+(.+)$/i.exec(line))) chart.axis = match[1]!.trim()
    else if ((match = /^excludes\s+(.+)$/i.exec(line))) excludes.push(match[1]!)
    else if ((match = /^weekend\s+(friday|saturday)\s*$/i.exec(line)))
      off.friday = match[1]!.toLowerCase() === 'friday'
    else if (/^inclusiveEndDates\b/i.test(line)) inclusive = true
    else if ((match = /^section\s+(.*)$/i.exec(line))) chart.sections.push(labelLines(match[1]!))
    else if (SKIPPED.test(line)) continue
    else if ((match = /^([^:]+):(.*)$/.exec(line))) {
      const task = readTask(match[1]!, match[2]!, format, inclusive)
      if (!task) continue
      chart.tasks.push({ ...task, section: chart.sections.length - 1 })
    }
  }
  // `excludes` is read once the format is known, wherever in the chart it was written.
  for (const list of excludes)
    for (const word of list.split(/[\s,]+/).filter(Boolean)) {
      const lower = word.toLowerCase()
      if (lower === 'weekends' || lower === 'weekend') off.weekends = true
      else if (WEEKDAYS.includes(lower)) off.days.add(WEEKDAYS.indexOf(lower))
      else {
        const at = readDate(word, format)
        if (at !== null) off.dates.add(Math.floor(at / DAY))
      }
    }
  if (chart.tasks.length === 0) return null
  const excluded = (at: number): boolean => {
    const day = new Date(at).getUTCDay()
    if (off.weekends && (off.friday ? day === 5 || day === 6 : day === 0 || day === 6)) return true
    return off.days.has(day) || off.dates.has(Math.floor(at / DAY))
  }
  const skips = off.weekends || off.days.size > 0 || off.dates.size > 0
  resolve(chart, skips ? excluded : null)
  return chart
}

function readTask(
  rawName: string,
  rawMeta: string,
  format: string,
  inclusive: boolean,
): Omit<Task, 'section'> | null {
  const name = labelLines(rawName)
  if (name.length === 0) return null
  const parts = rawMeta.split(',').map((part) => part.trim())
  const tags = new Set<string>()
  while (parts.length > 0 && TAGS.has(parts[0]!.toLowerCase()))
    tags.add(parts.shift()!.toLowerCase())
  const meta = parts.filter((part) => part !== '')
  // As Mermaid reads it: one item is the end, two are the start and the end, three the id first.
  const id = meta.length >= 3 ? meta[0]! : ''
  const start = meta.length >= 2 ? meta[meta.length >= 3 ? 1 : 0]! : null
  const end = meta.length >= 1 ? meta[meta.length >= 3 ? 2 : meta.length - 1]! : null
  return {
    name,
    id,
    done: tags.has('done'),
    active: tags.has('active'),
    crit: tags.has('crit'),
    milestone: tags.has('milestone'),
    from: start === null ? { kind: 'previous' } : readStart(start, format),
    to: end === null ? { kind: 'none' } : readEnd(end, format, inclusive),
    start: null,
    end: null,
  }
}

function readStart(text: string, format: string): Start {
  const after = /^after\s+(.+)$/i.exec(text)
  if (after) return { kind: 'after', ids: after[1]!.split(/\s+/) }
  const at = readDate(text, format)
  return at === null ? { kind: 'previous' } : { kind: 'date', at }
}

const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: MINUTE,
  h: HOUR,
  d: DAY,
  w: 7 * DAY,
}

function readEnd(text: string, format: string, inclusive: boolean): End {
  const until = /^until\s+(.+)$/i.exec(text)
  if (until) return { kind: 'until', ids: until[1]!.split(/\s+/) }
  const duration = /^(\d{1,9}(?:\.\d{1,6})?)\s*(ms|s|m|h|d|w)$/.exec(text)
  if (duration) {
    const ms = Number(duration[1]) * UNITS[duration[2]!]!
    if (!(ms <= LONGEST)) return { kind: 'none' }
    return { kind: 'span', ms, days: duration[2] === 'd' || duration[2] === 'w' }
  }
  const at = readDate(text, format)
  if (at === null) return { kind: 'none' }
  // An end date written inclusively is the end of that day.
  return { kind: 'date', at: inclusive ? at + DAY : at }
}

/**
 * Each task's start and end. A task may name one written after it (`after b` before `b`), so the
 * tasks are gone over until a pass places none; each pass places one at the least, or stops.
 */
function resolve(chart: Gantt, excluded: ((at: number) => boolean) | null): void {
  const ids = new Map<string, Task>()
  chart.tasks.forEach((task, at) => {
    if (!task.id) task.id = `task${at + 1}`
    if (!ids.has(task.id)) ids.set(task.id, task)
  })
  const dated = chart.tasks.flatMap((task) => [
    ...(task.from.kind === 'date' ? [task.from.at] : []),
    ...(task.to.kind === 'date' ? [task.to.at] : []),
  ])
  chart.relative = dated.length === 0
  const origin = dated.length > 0 ? Math.min(...dated) : 0
  const latest = (list: string[], pick: (task: Task) => number | null): number | null => {
    let most: number | null = null
    for (const id of list) {
      const task = ids.get(id)
      if (!task) continue
      const own = pick(task)
      if (own === null) return null
      most = most === null ? own : Math.max(most, own)
    }
    return most
  }
  for (let pass = 0; pass <= chart.tasks.length; pass++) {
    let placed = 0
    let previous: Task | null = null
    for (const task of chart.tasks) {
      if (task.start === null) {
        const from = task.from
        // `after` an id that is not there starts where the task before ends, as no `after` would.
        const after = from.kind === 'after' ? latest(from.ids, (own) => own.end) : null
        const unknown = from.kind === 'after' && from.ids.every((id) => !ids.has(id))
        task.start =
          from.kind === 'date'
            ? from.at
            : after !== null
              ? after
              : from.kind === 'after' && !unknown
                ? null
                : previous === null
                  ? origin
                  : previous.end
        if (task.start !== null) placed++
      }
      if (task.start !== null && task.end === null) {
        const to = task.to
        if (to.kind === 'date') task.end = Math.max(task.start, to.at)
        else if (to.kind === 'span')
          task.end = to.days && excluded ? skip(task.start, to.ms, excluded) : task.start + to.ms
        else if (to.kind === 'until') {
          const at = latest(to.ids, (own) => own.start)
          task.end = at === null ? null : Math.max(task.start, at)
        } else task.end = task.start
        if (task.end !== null) placed++
      }
      previous = task
    }
    if (placed === 0) break
  }
}

/** The end of `ms` of work from `start` when the days `excluded` names are not worked. */
function skip(start: number, ms: number, excluded: (at: number) => boolean): number {
  let end = start + ms
  for (let at = start, walked = 0; at < end && walked < MOST_DAYS_WALKED; at += DAY, walked++)
    if (excluded(at)) end += DAY
  return end
}

// --- Dates ---

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

// The tokens of a `dateFormat` as Day.js writes them, longest first; `[…]` is written as it is.
const FORMAT_TOKEN =
  /\[[^\]]*\]|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|HH|H|hh|h|mm|m|ss|s|SSS|SS|S|A|a|X|x|ZZ|Z/g
const PATTERNS: Record<string, string> = {
  YYYY: '([+-]?\\d{4,6})',
  YY: '(\\d{2})',
  MMMM: '([a-z]{3,9})',
  MMM: '([a-z]{3})',
  MM: '(\\d{2})',
  M: '(\\d{1,2})',
  Do: '(\\d{1,2})(?:st|nd|rd|th)',
  DD: '(\\d{2})',
  D: '(\\d{1,2})',
  HH: '(\\d{2})',
  H: '(\\d{1,2})',
  hh: '(\\d{2})',
  h: '(\\d{1,2})',
  mm: '(\\d{2})',
  m: '(\\d{1,2})',
  ss: '(\\d{2})',
  s: '(\\d{1,2})',
  SSS: '(\\d{3})',
  SS: '(\\d{2})',
  S: '(\\d)',
  A: '(am|pm)',
  a: '(am|pm)',
  X: '(\\d{1,12}(?:\\.\\d+)?)',
  x: '(\\d{1,15})',
  ZZ: '([+-]\\d{4}|z)',
  Z: '([+-]\\d{2}:\\d{2}|z)',
}

const formats = new Map<string, { regex: RegExp; tokens: string[] } | null>()

function compiled(format: string): { regex: RegExp; tokens: string[] } | null {
  if (formats.has(format)) return formats.get(format)!
  const tokens: string[] = []
  let source = '^'
  let last = 0
  for (const match of format.matchAll(FORMAT_TOKEN)) {
    source += escape(format.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('[')) source += escape(token.slice(1, -1))
    else {
      tokens.push(token)
      source += PATTERNS[token]!
    }
    last = match.index + token.length
  }
  source += `${escape(format.slice(last))}$`
  // Formats are a chart's own text, so the cache is kept small: a reply writes one or two.
  if (formats.size > 32) formats.clear()
  const own = tokens.length > 0 ? { regex: new RegExp(source, 'i'), tokens } : null
  formats.set(format, own)
  return own
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `text` as `format` writes a date, else as ISO does; null when it is neither or no real date. */
export function readDate(text: string, format: string): number | null {
  const own = compiled(format)
  const match = own?.regex.exec(text.trim())
  if (own && match) return fromFields(own.tokens, match.slice(1))
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    text.trim(),
  )
  if (!iso) return null
  return fromFields(['YYYY', 'M', 'D', 'H', 'm', 's'], iso.slice(1))
}

function fromFields(tokens: string[], values: Array<string | undefined>): number | null {
  let year = 1970
  let month = 0
  let day = 1
  let hour = 0
  let minute = 0
  let second = 0
  let milli = 0
  let pm: boolean | null = null
  let zone = 0
  for (let at = 0; at < tokens.length; at++) {
    const value = values[at]
    if (value === undefined) continue
    const token = tokens[at]!
    const number = Number(value)
    if (token === 'X') return checked(number * 1000)
    if (token === 'x') return checked(number)
    if (token === 'YYYY') year = number
    else if (token === 'YY') year = number + (number < 69 ? 2000 : 1900)
    else if (token === 'MMMM' || token === 'MMM') {
      const own = MONTHS.findIndex((name) => name.startsWith(value.toLowerCase().slice(0, 3)))
      if (own < 0) return null
      month = own
    } else if (token === 'MM' || token === 'M') month = number - 1
    else if (token === 'Do' || token === 'DD' || token === 'D') day = number
    else if (/^[Hh]{1,2}$/.test(token)) hour = number
    else if (token === 'mm' || token === 'm') minute = number
    else if (token === 'ss' || token === 's') second = number
    else if (token.startsWith('S')) milli = Number(value.padEnd(3, '0'))
    else if (token === 'A' || token === 'a') pm = value.toLowerCase() === 'pm'
    else if (token === 'ZZ' || token === 'Z') zone = zoneOf(value)
  }
  if (pm !== null) hour = (hour % 12) + (pm ? 12 : 0)
  if (month > 11 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const at = Date.UTC(year, month, day, hour, minute, second, milli)
  // 31 February is no date: Date.UTC would read it as 3 March.
  if (new Date(at).getUTCDate() !== day) return null
  return checked(at - zone)
}

function zoneOf(value: string): number {
  if (value.toLowerCase() === 'z') return 0
  const digits = value.replace(':', '')
  const sign = digits.startsWith('-') ? -1 : 1
  return sign * (Number(digits.slice(1, 3)) * HOUR + Number(digits.slice(3, 5)) * MINUTE)
}

/** `at` when it is a date a chart can hold. */
const checked = (at: number): number | null => (Math.abs(at) <= LONGEST ? at : null)

/** `at` written as `format` (d3's `%Y-%m-%d`), in UTC. */
export function formatDate(at: number, format: string): string {
  const date = new Date(at)
  const fields = (code: string): string | null => {
    const two = (value: number) => String(value).padStart(2, '0')
    const hour = date.getUTCHours()
    switch (code) {
      case 'Y':
        return String(date.getUTCFullYear())
      case 'y':
        return two(date.getUTCFullYear() % 100)
      case 'm':
        return two(date.getUTCMonth() + 1)
      case 'd':
        return two(date.getUTCDate())
      case 'e':
        return String(date.getUTCDate()).padStart(2, ' ')
      case 'b':
        return title(MONTHS[date.getUTCMonth()]!.slice(0, 3))
      case 'B':
        return title(MONTHS[date.getUTCMonth()]!)
      case 'a':
        return title(WEEKDAYS[date.getUTCDay()]!.slice(0, 3))
      case 'A':
        return title(WEEKDAYS[date.getUTCDay()]!)
      case 'H':
        return two(hour)
      case 'I':
        return two(hour % 12 || 12)
      case 'p':
        return hour < 12 ? 'AM' : 'PM'
      case 'M':
        return two(date.getUTCMinutes())
      case 'S':
        return two(date.getUTCSeconds())
      case 'L':
        return String(date.getUTCMilliseconds()).padStart(3, '0')
      case 'j':
        return String(Math.floor((at - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY) + 1).padStart(
          3,
          '0',
        )
      case '%':
        return '%'
      default:
        return null
    }
  }
  // `%-d` is d3's way to say no padding: `Jan 5`, not `Jan 05`.
  return format.replace(/%([-_0]?)(.)/g, (whole, flag: string, code: string) => {
    const value = fields(code)
    if (value === null) return whole
    return flag === '-' ? value.replace(/^[0 ](?=.)/, '') : value
  })
}

const title = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

// --- Drawing ---

interface Fill {
  char: string
  style: Style
  name: string
}

const FILLS = {
  task: { char: '█', style: CODE, name: 'task' },
  active: { char: '▓', style: WAITING, name: 'active' },
  done: { char: '░', style: DIM, name: 'done' },
  crit: { char: '▒', style: FAILED, name: 'crit' },
  milestone: { char: '◆', style: BOLD, name: 'milestone' },
} satisfies Record<string, Fill>

function fillOf(task: Task): Fill {
  const own = task.milestone
    ? FILLS.milestone
    : task.done
      ? FILLS.done
      : task.active
        ? FILLS.active
        : task.crit
          ? FILLS.crit
          : FILLS.task
  // A critical task is red whatever else it is: done, active or a milestone.
  return task.crit ? { ...own, style: patch(own.style, { color: 'red' }) } : own
}

/** The span the axis covers, never empty: a chart of one milestone still has a day around it. */
function rangeOf(chart: Gantt): { low: number; high: number } | null {
  let low = Infinity
  let high = -Infinity
  for (const task of chart.tasks) {
    if (task.start === null || task.end === null) continue
    low = Math.min(low, task.start)
    high = Math.max(high, task.end)
  }
  if (low === Infinity) return null
  if (high - low < MINUTE) high = low + DAY
  return { low, high }
}

function picture(chart: Gantt, columns: number): Line[] | null {
  const range = rangeOf(chart)
  if (!range) return null
  const indent = chart.sections.length > 0 ? 2 : 0
  const names = chart.tasks.flatMap((task) => task.name)
  const name = Math.max(
    LEAST_NAME,
    longestWord(names),
    Math.min(widest(names), Math.floor(columns * 0.4)),
  )
  const left = indent + name + 2
  const bars = columns - left
  if (bars < LEAST_BARS) return null
  const ticks = ticksOf(range.low, range.high, bars, chart)
  const x = (at: number) => ((at - range.low) / (range.high - range.low)) * bars
  const out: Line[] = []
  if (chart.title.length > 0)
    out.push(...chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0)), [])
  let section = -2
  const used = new Set<Fill['name']>()
  for (const task of chart.tasks) {
    if (task.section !== section && task.section >= 0) {
      for (const line of chart.sections[task.section]!)
        out.push(...para([span(line, BOLD)], columns, 0))
    }
    section = task.section
    const rows = wrapLines(task.name, name)
    const fill = fillOf(task)
    rows.forEach((row, at) => {
      const line: Line = [span(' '.repeat(indent) + (at === 0 ? pad(row, name + 2) : row), PLAIN)]
      if (at === 0 && task.start !== null && task.end !== null) {
        used.add(fill.name)
        if (task.milestone) {
          const mark = Math.min(bars - 1, Math.floor(x((task.start + task.end) / 2)))
          line.push(span(' '.repeat(mark), PLAIN), span(fill.char, fill.style))
        } else {
          const from = Math.min(bars - 1, Math.floor(x(task.start)))
          const to = Math.max(from + 1, Math.min(bars, Math.round(x(task.end))))
          line.push(span(' '.repeat(from), PLAIN), span(fill.char.repeat(to - from), fill.style))
        }
      }
      out.push(line)
    })
  }
  // The axis: a rule with a tick at each date, and the dates under their ticks.
  const rule = Array.from({ length: bars }, () => '─')
  let labels = ''
  for (const tick of ticks) {
    rule[tick.x] = '┬'
    labels = pad(labels, tick.x) + tick.label
  }
  out.push([span(' '.repeat(left), PLAIN), span(rule.join(''), DIM)])
  out.push([span(' '.repeat(left) + labels, DIM)])
  // A key only when there is more than one kind of bar to tell apart.
  if (used.size > 1 || (used.size === 1 && !used.has('task'))) {
    const key: Line = []
    for (const fill of Object.values(FILLS))
      if (used.has(fill.name))
        key.push(
          ...(key.length > 0 ? [span('  ', PLAIN)] : []),
          span(fill.char, fill.name === 'milestone' ? BOLD : fill.style),
          span(` ${fill.name}`, DIM),
        )
    const plain = key.map((part) => ({ ...part, text: part.text.replace('\u00a0', ' ') }))
    out.push([], ...(width(lineText(plain)) <= columns ? [plain] : para(key, columns, 0)))
  }
  return out
}

/** A unit of the axis: how long it is, and how a time is moved to the next one. */
interface Step {
  ms: number
  next: (at: number) => number
  format: string
}

const fixed = (ms: number, format: string): Step => ({
  ms,
  format,
  next: (at) => Math.floor(at / ms) * ms + ms,
})

const months = (count: number, format: string): Step => ({
  ms: count * 30 * DAY,
  format,
  next: (at) => {
    const date = new Date(at)
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth()
    const next = Math.floor(month / count) * count + count
    return Date.UTC(Math.floor(next / 12), next % 12, 1)
  },
})

const STEPS: Step[] = [
  fixed(MINUTE, '%H:%M'),
  fixed(5 * MINUTE, '%H:%M'),
  fixed(15 * MINUTE, '%H:%M'),
  fixed(30 * MINUTE, '%H:%M'),
  fixed(HOUR, '%H:%M'),
  fixed(3 * HOUR, '%H:%M'),
  fixed(6 * HOUR, '%H:%M'),
  fixed(12 * HOUR, '%b %-d %H:%M'),
  fixed(DAY, '%b %-d'),
  fixed(2 * DAY, '%b %-d'),
  // Weeks start on a Monday: 1970-01-01 was a Thursday, four days on from one.
  {
    ms: 7 * DAY,
    format: '%b %-d',
    next: (at) => Math.floor((at + 3 * DAY) / (7 * DAY)) * 7 * DAY + 4 * DAY,
  },
  {
    ms: 14 * DAY,
    format: '%b %-d',
    next: (at) => Math.floor((at + 3 * DAY) / (14 * DAY)) * 14 * DAY + 11 * DAY,
  },
  months(1, '%b %Y'),
  months(3, '%b %Y'),
  months(6, '%b %Y'),
  ...[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].map((count) => months(12 * count, '%Y')),
]

/**
 * The dates the axis is marked at: the finest unit whose labels, each starting at its tick, do
 * not run into the next one. A unit with more ticks than the axis has columns is not counted out.
 */
function ticksOf(
  low: number,
  high: number,
  bars: number,
  chart: Gantt,
): Array<{ x: number; label: string }> {
  const label = (at: number, step: Step) =>
    chart.relative ? relative(at - low, step.ms) : formatDate(at, chart.axis ?? step.format)
  for (const step of STEPS) {
    if ((high - low) / step.ms > bars) continue
    // A relative axis counts from its start, so its first tick is the start.
    const ticks: Array<{ x: number; label: string }> = []
    let at = chart.relative ? low : step.next(low - 1)
    let room = true
    for (
      let count = 0;
      at <= high && count <= bars;
      count++, at = relativeNext(at, step, chart, low)
    ) {
      const x = Math.floor(((at - low) / (high - low)) * bars)
      if (x >= bars) break
      const text = label(at, step)
      // A date that would pass the right edge is left off; one that runs into the last is not.
      if (x + width(text) > bars) break
      const last = ticks.at(-1)
      if (last && x < last.x + width(last.label) + 2) {
        room = false
        break
      }
      ticks.push({ x, label: text })
    }
    if (room && ticks.length > 0) return ticks
  }
  const first = label(low, STEPS.at(-1)!)
  return width(first) <= bars ? [{ x: 0, label: first }] : []
}

function relativeNext(at: number, step: Step, chart: Gantt, low: number): number {
  return chart.relative ? low + Math.round((at - low) / step.ms + 1) * step.ms : step.next(at)
}

/** A time counted from the start: `day 8` on an axis of days, `+6h` on one of hours. */
function relative(ms: number, unit: number): string {
  if (unit >= DAY) return `day ${Math.round(ms / DAY) + 1}`
  if (unit >= HOUR) return `+${Math.round(ms / HOUR)}h`
  return `+${Math.round(ms / MINUTE)}m`
}

// --- The list ---

/** The chart as a list: each task with its dates and what it is, under its section. */
function listOf(chart: Gantt, columns: number): Line[] | null {
  const timed = chart.tasks.some(
    (task) => task.start !== null && (task.start % DAY !== 0 || (task.end ?? 0) % DAY !== 0),
  )
  const date = (at: number) =>
    chart.relative
      ? relative(at - (rangeOf(chart)?.low ?? 0), timed ? HOUR : DAY)
      : formatDate(at, timed ? '%Y-%m-%d %H:%M' : '%Y-%m-%d')
  const out: Line[] = chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0))
  const indent = chart.sections.length > 0 ? 2 : 0
  let section = -2
  for (const task of chart.tasks) {
    if (out.length > MOST_ROWS) return null
    if (task.section !== section && task.section >= 0)
      for (const line of chart.sections[task.section]!)
        out.push(...para([span(line, BOLD)], columns, 0))
    section = task.section
    const fill = fillOf(task)
    // A day's end is shown as the last day worked: a task of one day is that day alone.
    const last = task.end === null ? null : timed ? task.end : task.end - DAY
    const when =
      task.start === null || last === null
        ? []
        : task.milestone || last <= task.start
          ? [span(` ${date(task.start)}`, DIM)]
          : [span(` ${date(task.start)} → ${date(last)}`, DIM)]
    out.push(
      ...para(
        [span(`${fill.char} `, fill.style), span(task.name.join(' '), PLAIN), ...when],
        columns,
        indent,
      ),
    )
  }
  return bounded(out)
}
