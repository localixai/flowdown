/**
 * Git graphs in a terminal: each branch a rail down a column of its own, its name at the top,
 * and each commit a row of the graph in the order it was made, `○` on its branch's rail with its
 * id, tags and message to the right of every rail. A branch leaves its parent's rail at the
 * commit it was made from (`○──╮`), and a merge comes back across into the commit it makes
 * (`●──╯`). Each branch has a colour of its own, and its glyphs and rails say the same without it.
 *
 * `BT:` draws the same graph bottom up, the names under their rails and the first commit lowest.
 * `LR:` lays the rails across, one row each with its name at the left and each commit's words
 * under it; a commit's column is its place in time, so a fork leaves along its parent's rail and
 * turns down into its branch just before its first commit (`○──┬` over `╰─○`). A graph too long
 * to run across the columns is drawn down instead, which only needs rows.
 *
 * A cherry-pick is drawn with a dotted line from the commit it copies, the way a merge comes back:
 * the copy is not history the branch shares, and the line says where it came from.
 *
 * Commits whose id is made up (no `id:` written) show none: Mermaid's are random, and a made-up
 * one here would be a word the chart never said.
 */
import { Canvas } from './canvas'
import type { DiagramKind } from './kind'
import { bounded, longestWord, para, within } from './kit'
import { MOST_ROWS } from './outline'
import { labelLines } from './text'
import { BOLD, DIM, PLAIN, lineText, type Colour, type Line, type Style } from '../style'
import { width } from '../width'
import { span, wrap } from '../wrap'

/** Past these a graph is not read on, and past the second it is written as a list. */
const MOST_COMMITS = 5000
const MOST_BRANCHES = 200
const MOST_DRAWN = 1000
/** Columns between two rails when the names are written down a stair over them. */
const NARROW = 3
/** The columns a commit's words need at the least beside the rails. */
const LEAST_LABEL = 8
/**
 * Across, the widths a commit's words are wrapped to, widest first; and the columns between two
 * commits, the middle one free for a line that turns to another rail.
 */
const ACROSS_WRAPS = [32, 20, 12, 8]
const ACROSS_GAP = 3

const COLOURS: Colour[] = ['cyan', 'magenta', 'green', 'yellow', 'red']
const GLYPHS = { normal: '○', merge: '●', highlight: '■', reverse: '⊗' } as const
const TAG: Style = { color: 'yellow' }

interface Commit {
  branch: number
  id: string
  /** Whether its id was written, and so is shown. */
  named: boolean
  tags: string[]
  message: string[]
  type: 'normal' | 'highlight' | 'reverse'
  /** The commit before it on its branch, or the one its branch was made from; -1 for none. */
  parent: number
  /** The head of the branch merged in, for a merge. */
  merged: number
  /** The id a cherry-pick copies, and the commit it names. */
  picked: string | null
  copies: number
}

interface Branch {
  name: string
  label: string[]
  order: number
  /** The commit it was made from, and its last one; -1 for none. */
  fork: number
  head: number
}

type Event = { kind: 'commit'; at: number } | { kind: 'branch'; at: number }

interface Git {
  /** Which way time runs: down (`TB`, the default), up, or across. */
  direction: 'TB' | 'BT' | 'LR'
  branches: Branch[]
  commits: Commit[]
  events: Event[]
}

export const gitGraphDiagram: DiagramKind = {
  matches: (header) => /^gitGraph\b/.test(header),
  draw(lines, columns) {
    const chart = parseGit(lines)
    if (!chart || !(columns >= 2)) return null
    const room = Math.floor(columns)
    if (chart.commits.length <= MOST_DRAWN) {
      if (chart.direction === 'LR')
        for (const wrapAt of ACROSS_WRAPS) {
          const drawn = across(chart, room, wrapAt)
          const fits = drawn && within(drawn, room)
          if (fits) return fits
        }
      for (const stair of [false, true]) {
        const drawn = picture(chart, room, stair, chart.direction === 'BT')
        const fits = drawn && within(drawn, room)
        if (fits) return fits
      }
    }
    return listOf(chart, room)
  },
}

// --- Reading ---

const HEADER = /^gitGraph(?:\s+(LR|TB|BT))?\s*:?/
const NAME = String.raw`("[^"]*"|'[^']*'|[^\s"']+)`
const COMMIT = /^commit\b(.*)$/i
const BRANCH = new RegExp(`^branch\\s+${NAME}(.*)$`, 'i')
const CHECKOUT = new RegExp(`^(?:checkout|switch)\\s+${NAME}\\s*$`, 'i')
const MERGE = new RegExp(`^merge\\s+${NAME}(.*)$`, 'i')
const PICK = /^cherry-pick\b(.*)$/i

/** The `key: value` options of a command, keys in lower case. */
function options(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const match of text.matchAll(/(\w+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g))
    out.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  return out
}

const unquoted = (name: string): string => name.replace(/^(["'])(.*)\1$/, '$2').trim()

function parseGit(lines: readonly string[]): Git | null {
  const header = lines[0]?.trim() ?? ''
  if (!/^gitGraph\b/.test(header)) return null
  const written = HEADER.exec(header)?.[1]
  const chart: Git = {
    direction: written === 'LR' || written === 'BT' ? written : 'TB',
    branches: [{ name: 'main', label: ['main'], order: 0, fork: -1, head: -1 }],
    commits: [],
    events: [],
  }
  const branches = new Map([['main', 0]])
  const ids = new Map<string, number>()
  let current = 0
  const add = (commit: Omit<Commit, 'branch' | 'parent'>) => {
    const branch = chart.branches[current]!
    const at = chart.commits.length
    chart.commits.push({
      ...commit,
      branch: current,
      parent: branch.head >= 0 ? branch.head : branch.fork,
    })
    branch.head = at
    if (!ids.has(commit.id)) ids.set(commit.id, at)
    chart.events.push({ kind: 'commit', at })
  }
  const typeOf = (word: string | undefined): Commit['type'] =>
    word?.toUpperCase() === 'HIGHLIGHT'
      ? 'highlight'
      : word?.toUpperCase() === 'REVERSE'
        ? 'reverse'
        : 'normal'
  const common = (own: Map<string, string>, fallback: string) => ({
    id: own.has('id') ? own.get('id')! : fallback,
    named: own.has('id') && own.get('id') !== '',
    tags: own.has('tag') ? labelLines(own.get('tag')!) : [],
    message: labelLines(own.get('msg') ?? ''),
    type: typeOf(own.get('type')),
  })
  for (const raw of lines.slice(1)) {
    if (chart.commits.length >= MOST_COMMITS) break
    const line = raw.trim()
    let match: RegExpExecArray | null
    if ((match = COMMIT.exec(line))) {
      add({
        ...common(options(match[1]!), `#${chart.commits.length}`),
        merged: -1,
        picked: null,
        copies: -1,
      })
    } else if ((match = BRANCH.exec(line))) {
      const name = unquoted(match[1]!)
      if (branches.has(name) || chart.branches.length >= MOST_BRANCHES || name === '') continue
      const order = Number(options(match[2]!).get('order'))
      branches.set(name, chart.branches.length)
      chart.events.push({ kind: 'branch', at: chart.branches.length })
      const from = chart.branches[current]!
      chart.branches.push({
        name,
        label: labelLines(name),
        order: Number.isFinite(order) ? order : chart.branches.length,
        fork: from.head >= 0 ? from.head : from.fork,
        head: -1,
      })
      current = chart.branches.length - 1
    } else if ((match = CHECKOUT.exec(line))) {
      current = branches.get(unquoted(match[1]!)) ?? current
    } else if ((match = MERGE.exec(line))) {
      const from = branches.get(unquoted(match[1]!))
      if (from === undefined || from === current) continue
      const source = chart.branches[from]!
      const head = source.head >= 0 ? source.head : source.fork
      if (head < 0) continue
      add({
        ...common(options(match[2]!), `#${chart.commits.length}`),
        merged: head,
        picked: null,
        copies: -1,
      })
    } else if ((match = PICK.exec(line))) {
      const own = options(match[1]!)
      const id = own.get('id')
      if (id === undefined || !ids.has(id)) continue
      own.delete('id')
      add({
        ...common(own, `#${chart.commits.length}`),
        merged: -1,
        picked: id,
        copies: ids.get(id)!,
      })
    }
  }
  return chart.commits.length > 0 || chart.branches.length > 1 ? chart : null
}

// --- Drawing ---

const colourOf = (column: number): Style => ({ color: COLOURS[column % COLOURS.length]! })

/** What is written beside a commit: its id, its tags, its message, what it merges or copies. */
function labelOf(chart: Git, commit: Commit): Line {
  const out: Line = []
  const add = (text: string, style: Style) => {
    if (out.length > 0) out.push(span(' ', PLAIN))
    out.push(span(text, style))
  }
  if (commit.named) for (const line of labelLines(commit.id)) add(line, DIM)
  if (commit.message.length > 0) add(commit.message.join(' '), PLAIN)
  if (commit.merged >= 0) {
    const from = chart.commits[commit.merged]!
    add(`merge ${chart.branches[from.branch]!.label.join(' ')}`, DIM)
  }
  if (commit.picked !== null) add(`cherry-pick ${labelLines(commit.picked).join(' ')}`, DIM)
  for (const tag of commit.tags) add(`(${tag})`, TAG)
  return out
}

const glyphOf = (commit: Commit): string =>
  commit.merged >= 0 ? GLYPHS.merge : GLYPHS[commit.type]

/** The branches by `order`, then in the order they were made, and the place of each in that. */
function lanes(chart: Git): { sorted: number[]; lane: number[]; names: string[] } {
  const sorted = chart.branches
    .map((_, at) => at)
    .toSorted((a, b) => chart.branches[a]!.order - chart.branches[b]!.order || a - b)
  const lane = Array.from({ length: chart.branches.length }, () => 0)
  sorted.forEach((branch, at) => (lane[branch] = at))
  const names = sorted.map((at) => chart.branches[at]!.label.join(' ') || chart.branches[at]!.name)
  return { sorted, lane, names }
}

/** A commit's wrapped words written on the canvas from (x, y) down, a row each. */
function writeLabel(canvas: Canvas, x: number, y: number, lines: readonly Line[]): void {
  lines.forEach((line, below) => {
    let from = x
    for (const part of line) {
      canvas.text(from, y + below, part.text, part.style)
      from += width(part.text)
    }
  })
}

/** Each commit's glyph, bold for a highlighted one. */
function writeGlyph(canvas: Canvas, commit: Commit, x: number, y: number): void {
  const style = colourOf(commit.branch)
  canvas.text(x, y, glyphOf(commit), commit.type === 'highlight' ? { ...style, bold: true } : style)
}

/**
 * The graph on a canvas, down the screen or, `upward`, up it. The names stand on one row over
 * their rails (under them, upward) when that fits, else down a stair, one row each, with the
 * rails closer together; null when even that does not fit.
 */
function picture(chart: Git, columns: number, stair: boolean, upward: boolean): Line[] | null {
  const { sorted, lane, names } = lanes(chart)
  const x: number[] = []
  let at = 0
  for (const name of names) {
    x.push(at)
    at += stair ? NARROW : Math.max(1, width(name)) + 2
  }
  const rails = x.at(-1)! + 1
  const header = stair ? names.length : 1
  if (names.some((name, own) => x[own]! + width(name) > columns)) return null
  const labels = chart.commits.map((commit) => labelOf(chart, commit))
  const words = labels.map(lineText).filter(Boolean)
  const left = rails + 2
  const room = columns - left
  if (words.length > 0 && room < Math.max(LEAST_LABEL, longestWord(words))) return null
  const wrapped = labels.map((label) => (label.length > 0 ? wrap(label, room, [], []) : []))
  const heights = wrapped.map((lines) => Math.max(1, lines.length))
  const body = heights.reduce((sum, own) => sum + own, 0)
  const total = header + 1 + body
  if (total > MOST_ROWS) return null
  // Down, the first commit is under the names; up, the last is at the top and the names under all.
  const rows: number[] = []
  let row = upward ? body : header + 1
  heights.forEach((own) => {
    if (upward) row -= own
    rows.push(row)
    if (!upward) row += own
  })
  const canvas = new Canvas(columns, total)
  const top = upward ? body + 1 : 0
  names.forEach((name, own) => {
    canvas.text(x[own]!, top + (stair ? own : 0), name, { ...colourOf(sorted[own]!), bold: true })
  })
  const xOf = (commit: number) => x[lane[chart.commits[commit]!.branch]!]!
  chart.commits.forEach((commit, own) => {
    const here = xOf(own)
    if (commit.parent >= 0) {
      const from = xOf(commit.parent)
      // From the commit before on the same rail, or across from the one its branch left.
      canvas.stroke(
        [
          [from, rows[commit.parent]!],
          [here, rows[commit.parent]!],
          [here, rows[own]!],
        ],
        'solid',
        colourOf(commit.branch),
      )
    }
    // A merge comes back along its branch's rail and across; a cherry-pick does so dotted.
    const source = commit.merged >= 0 ? commit.merged : commit.copies
    if (source >= 0) {
      const from = xOf(source)
      canvas.stroke(
        [
          [from, rows[source]!],
          [from, rows[own]!],
          [here, rows[own]!],
        ],
        commit.merged >= 0 ? 'solid' : 'dotted',
        colourOf(chart.commits[source]!.branch),
      )
    }
  })
  chart.commits.forEach((commit, own) => {
    writeGlyph(canvas, commit, xOf(own), rows[own]!)
    writeLabel(canvas, left, rows[own]!, wrapped[own]!)
  })
  return canvas.rows()
}

/**
 * The graph across: each branch a row, its name at the left, each commit in a column of its own
 * in the order it was made, its words wrapped to `wrapAt` under it. A line to another rail turns
 * in the free column just before the commit it reaches, so it never runs through words. Null when
 * the commits are wider together than the columns.
 */
function across(chart: Git, columns: number, wrapAt: number): Line[] | null {
  const { sorted, lane, names } = lanes(chart)
  const left = names.reduce((most, name) => Math.max(most, width(name)), 0) + 1
  const wrapped = chart.commits.map((commit) => {
    const label = labelOf(chart, commit)
    if (label.length === 0) return []
    return wrap(label, Math.max(wrapAt, longestWord([lineText(label)])), [], [])
  })
  const x: number[] = []
  let at = left
  for (const lines of wrapped) {
    x.push(at)
    at += Math.max(1, ...lines.map((line) => width(lineText(line)))) + ACROSS_GAP
    // Stopped as soon as it is too wide: a long graph is not measured to its end.
    if (at - ACROSS_GAP > columns) return null
  }
  // Each rail is followed by its commits' words, then a row between it and the next.
  const depth = sorted.map(() => 0)
  chart.commits.forEach((commit, own) => {
    const which = lane[commit.branch]!
    depth[which] = Math.max(depth[which]!, wrapped[own]!.length)
  })
  const y: number[] = []
  let row = 0
  for (const own of depth) {
    y.push(row)
    row += own + 2
  }
  if (row - 1 > MOST_ROWS) return null
  const canvas = new Canvas(columns, row - 1)
  names.forEach((name, own) => {
    canvas.text(0, y[own]!, name, { ...colourOf(sorted[own]!), bold: true })
  })
  const yOf = (commit: number) => y[lane[chart.commits[commit]!.branch]!]!
  const join = (from: number, to: number, ink: 'solid' | 'dotted', style: Style) => {
    const turn = x[to]! - 2
    canvas.stroke(
      yOf(from) === yOf(to)
        ? [
            [x[from]!, yOf(from)],
            [x[to]!, yOf(to)],
          ]
        : [
            [x[from]!, yOf(from)],
            [turn, yOf(from)],
            [turn, yOf(to)],
            [x[to]!, yOf(to)],
          ],
      ink,
      style,
    )
  }
  chart.commits.forEach((commit, own) => {
    if (commit.parent >= 0) join(commit.parent, own, 'solid', colourOf(commit.branch))
    const source = commit.merged >= 0 ? commit.merged : commit.copies
    if (source >= 0)
      join(
        source,
        own,
        commit.merged >= 0 ? 'solid' : 'dotted',
        colourOf(chart.commits[source]!.branch),
      )
  })
  chart.commits.forEach((commit, own) => {
    writeGlyph(canvas, commit, x[own]!, yOf(own))
    writeLabel(canvas, x[own]!, yOf(own) + 1, wrapped[own]!)
  })
  return canvas.rows()
}

/**
 * The graph as a list: its branches on a row, then each branch where it was made and each commit
 * with its branch's name.
 */
function listOf(chart: Git, columns: number): Line[] | null {
  const nameOf = (branch: number) => chart.branches[branch]!.label.join(' ')
  const out: Line[] = para(
    chart.branches.flatMap((_, at) => [
      ...(at > 0 ? [span(', ', DIM)] : []),
      span(nameOf(at), { ...colourOf(at), bold: true }),
    ]),
    columns,
    0,
  )
  for (const event of chart.events) {
    if (out.length > MOST_ROWS) return null
    if (event.kind === 'branch') {
      const branch = chart.branches[event.at]!
      const parent = branch.fork >= 0 ? chart.commits[branch.fork]!.branch : -1
      out.push(
        ...para(
          [
            span('branch ', DIM),
            span(nameOf(event.at), { ...colourOf(event.at), bold: true }),
            // The space after the word is written as an escape: `layers.test.ts` reads the word
            // and a quote after it as an import.
            ...(parent >= 0 ? [span(' from\u0020', DIM), span(nameOf(parent), BOLD)] : []),
          ],
          columns,
          0,
        ),
      )
      continue
    }
    const commit = chart.commits[event.at]!
    const label = labelOf(chart, commit)
    out.push(
      ...para(
        [
          span(nameOf(commit.branch), colourOf(commit.branch)),
          span(' ', PLAIN),
          span(glyphOf(commit), colourOf(commit.branch)),
          ...(label.length > 0 ? [span(' ', PLAIN), ...label] : []),
        ],
        columns,
        0,
      ),
    )
  }
  return bounded(out)
}
