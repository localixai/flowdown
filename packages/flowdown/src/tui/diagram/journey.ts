/**
 * User journeys in a terminal: under each section, each task with its score as five marks
 * (`●●●○○ 3`) and who takes part. The marks are green for a good step, yellow for a middling one
 * and red for a bad one, and their count says the same without the colour. When the columns do
 * not hold a task's name, marks and actors on one row, each task takes three.
 */
import type { DiagramKind } from './kind'
import { bounded, longestWord, pad, para, within } from './kit'
import { MOST_ROWS } from './outline'
import { labelLines, widest, wrapLines } from './text'
import { BOLD, DIM, DONE, FAILED, PLAIN, WAITING, type Line } from '../style'
import { width } from '../width'
import { span } from '../wrap'

/** Past this a journey is not read on. */
const MOST_TASKS = 2000
/** The marks a score is drawn with: a score of five fills them. */
const MARKS = 5
/** The columns a list of actors needs at the least beside a task. */
const LEAST_ACTORS = 6

interface Task {
  name: string[]
  /** As it was written, to be shown so; null when it is not a number. */
  score: string | null
  value: number
  actors: string[][]
  section: number
}

interface Journey {
  title: string[]
  sections: string[][]
  tasks: Task[]
}

export const journeyDiagram: DiagramKind = {
  matches: (header) => /^journey\b/.test(header),
  draw(lines, columns) {
    const chart = parseJourney(lines)
    if (!chart || !(columns >= 2)) return null
    const room = Math.floor(columns)
    const wide = besideOf(chart, room)
    return (wide && within(wide, room)) || stackedOf(chart, room)
  },
}

function parseJourney(lines: readonly string[]): Journey | null {
  if (!/^journey\b/.test(lines[0]?.trim() ?? '')) return null
  const chart: Journey = { title: [], sections: [], tasks: [] }
  for (const raw of lines.slice(1)) {
    if (chart.tasks.length >= MOST_TASKS) break
    const line = raw.trim()
    let match: RegExpExecArray | null
    if ((match = /^title\s+(.*)$/i.exec(line))) chart.title = labelLines(match[1]!)
    else if ((match = /^section\s+(.*)$/i.exec(line))) chart.sections.push(labelLines(match[1]!))
    else if (/^(?:accTitle|accDescr)\b/.test(line)) continue
    else if ((match = /^([^:]+):([^:]*)(?::(.*))?$/.exec(line))) {
      const name = labelLines(match[1]!)
      if (name.length === 0) continue
      const written = match[2]!.trim()
      const value = /^-?\d{1,6}(?:\.\d{1,6})?$/.test(written) ? Number(written) : NaN
      chart.tasks.push({
        name,
        score: Number.isFinite(value) ? written : null,
        value: Number.isFinite(value) ? value : 0,
        actors: (match[3] ?? '')
          .split(',')
          .map(labelLines)
          .filter((actor) => actor.length > 0),
        section: chart.sections.length - 1,
      })
    }
  }
  return chart.tasks.length > 0 ? chart : null
}

/** A score as its marks and its number: `●●●○○ 3`. */
function scoreOf(task: Task, digits: number): Line {
  if (task.score === null) return [span('○'.repeat(MARKS), DIM), span(` ${pad('?', digits)}`, DIM)]
  const filled = Math.max(0, Math.min(MARKS, Math.round(task.value)))
  const style = filled >= 4 ? DONE : filled === 3 ? WAITING : FAILED
  return [
    span('●'.repeat(filled), style),
    span('○'.repeat(MARKS - filled), DIM),
    span(` ${pad(task.score, digits)}`, PLAIN),
  ]
}

const actorsOf = (task: Task): string => task.actors.map((actor) => actor.join(' ')).join(', ')

/** The rows each section starts with, and the task's indent under it. */
function heading(chart: Journey, task: Task, last: number, columns: number): Line[] {
  if (task.section === last || task.section < 0) return []
  return chart.sections[task.section]!.flatMap((line) => para([span(line, BOLD)], columns, 0))
}

/** One row a task: its name, its marks, then its actors, each in its own column. */
function besideOf(chart: Journey, columns: number): Line[] | null {
  const indent = chart.sections.length > 0 ? 2 : 0
  const names = chart.tasks.flatMap((task) => task.name)
  const name = Math.max(longestWord(names), Math.min(widest(names), Math.floor(columns * 0.4)))
  const digits = Math.max(1, ...chart.tasks.map((task) => width(task.score ?? '?')))
  const actorsAt = indent + name + 2 + MARKS + 1 + digits + 2
  const room = columns - actorsAt
  const actors = chart.tasks.map(actorsOf)
  if (room < Math.max(LEAST_ACTORS, longestWord(actors))) return null
  const out: Line[] = chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0))
  if (out.length > 0) out.push([])
  let section = -1
  for (const [at, task] of chart.tasks.entries()) {
    out.push(...heading(chart, task, section, columns))
    section = task.section
    const left = wrapLines(task.name, name)
    const right = wrapLines(actors[at] ? [actors[at]!] : [], room)
    for (let row = 0; row < Math.max(left.length, right.length); row++) {
      const line: Line = [span(' '.repeat(indent) + pad(left[row] ?? '', name + 2), PLAIN)]
      if (row === 0) line.push(...scoreOf(task, digits))
      else if (right[row]) line.push(span(' '.repeat(MARKS + 1 + digits), PLAIN))
      if (right[row]) line.push(span(`  ${right[row]}`, DIM))
      out.push(trimmed(line))
    }
  }
  return out
}

/** A row without the spaces it ends in. */
function trimmed(line: Line): Line {
  const last = line.at(-1)
  if (!last) return line
  const text = last.text.trimEnd()
  return text ? [...line.slice(0, -1), { text, style: last.style }] : trimmed(line.slice(0, -1))
}

/** Each task on rows of its own: its name, then its marks, then its actors. */
function stackedOf(chart: Journey, columns: number): Line[] | null {
  const indent = chart.sections.length > 0 ? 2 : 0
  const digits = Math.max(1, ...chart.tasks.map((task) => width(task.score ?? '?')))
  const out: Line[] = chart.title.flatMap((line) => para([span(line, BOLD)], columns, 0))
  let section = -1
  for (const task of chart.tasks) {
    if (out.length > MOST_ROWS) return null
    out.push(...heading(chart, task, section, columns))
    section = task.section
    out.push(...para([span(task.name.join(' '), PLAIN)], columns, indent))
    const actors = actorsOf(task)
    const who = actors ? [span(' · ', DIM), span(actors, DIM)] : []
    out.push(...para([...scoreOf(task, digits), ...who], columns, indent + 2))
  }
  return bounded(out)
}
