/**
 * A sequence diagram as a picture: a box for each participant along the top, a lifeline `│` down
 * from each, and each step on rows of its own under the one before. A message is its label over
 * an arrow from lifeline to lifeline (`├────▶│`), a note a dashed box over the lifelines it is
 * about, and a block (`loop`, `alt` …) a frame across the whole diagram, its other parts (`else`)
 * dashed rows through it. A participant is drawn active (`activate`, `->>+`) as its lifeline made
 * heavy over the rows it is active, from the arrow that starts it to the arrow that ends it
 * (`┃`, `┠───▶`), nested activations as one: a column has no room for Mermaid's offset bars.
 *
 * The columns are spaced so that every label fits where it is drawn: each need is a least
 * distance between two lifelines, met narrowest first. Labels are wrapped narrower until the
 * whole fits the terminal; when it cannot, the diagram is written as an outline.
 */
import { Canvas, type Ink } from './canvas'
import { MOST_ROWS, sequenceOutline } from './outline'
import type { Sequence, Step, Tip } from './sequence-parse'
import { widest, wrapLines } from './text'
import { BOLD, CODE, DIM, PLAIN, type Line } from '../style'
import { width } from '../width'

/** Past these a diagram is written as an outline. */
const MOST_PARTICIPANTS = 40
const MOST_STEPS = 1000
/** The widths participants' names and steps' labels are wrapped at, tried in turn. */
const WIDTHS: ReadonlyArray<readonly [names: number, labels: number]> = [
  [20, 32],
  [14, 20],
  [10, 12],
]

/** `chart` as rows no wider than `columns`: a picture when one fits, else an outline. */
export function drawSequence(chart: Sequence, columns: number): Line[] | null {
  if (chart.participants.length <= MOST_PARTICIPANTS && chart.steps.length <= MOST_STEPS)
    for (const [names, labels] of WIDTHS) {
      const drawn = picture(chart, names, labels, columns)
      if (drawn) return drawn
    }
  return sequenceOutline(chart, columns)
}

/** A step with its label wrapped. */
type Laid = Step & { lines: string[] }

function picture(chart: Sequence, names: number, labels: number, columns: number): Line[] | null {
  const heads = chart.participants.map((one) => wrapLines(one.label, names))
  const tall = heads.reduce((most, lines) => Math.max(most, lines.length), 1) + 2
  const steps: Laid[] = chart.steps.map((step) => ({
    ...step,
    lines: step.kind === 'message' || step.kind === 'note' ? wrapLines(step.label, labels) : [],
  }))
  // Each block's part is drawn at its depth: the first frame on the picture's edges, the next
  // one column in, and so on.
  let depth = 0
  const levels = steps.map((step) => {
    if (step.kind === 'open') depth++
    const own = depth
    if (step.kind === 'close') depth = Math.max(0, depth - 1)
    return own
  })
  const deepest = levels.reduce((most, own) => Math.max(most, own), 0)
  const inset = deepest > 0 ? deepest + 1 : 0
  const x = columnsOf(heads, steps, inset)
  const wide = x.pop()! + 1
  // A frame inside a frame inside … must still hold a word: past that, no picture.
  if (wide > columns || (deepest > 0 && wide - 2 * deepest < 12)) return null
  const titles = steps.map((step, at) =>
    step.kind === 'open' || step.kind === 'part'
      ? wrapLines([[step.keyword, ...step.title].join(' ')], wide - 2 * levels[at]! - 3)
      : [],
  )
  const high = tall + steps.reduce((sum, step, at) => sum + rowsOf(step, titles[at]!), 0) + 1
  if (high > MOST_ROWS) return null
  const canvas = new Canvas(wide, high)
  chart.participants.forEach((one, at) => {
    const w = widest(heads[at]!) + 4
    const left = x[at]! - Math.floor(w / 2)
    canvas.rect(left, 0, w, tall, 'solid', CODE, one.actor)
    heads[at]!.forEach((line, row) => {
      canvas.text(left + Math.floor((w - width(line)) / 2), 1 + row, line, PLAIN)
    })
    canvas.stroke(
      [
        [x[at]!, tall - 1],
        // To past the last row: the lifeline does not end in a stub.
        [x[at]!, high],
      ],
      'solid',
      DIM,
    )
  })
  let row = tall
  const opened: Array<{ top: number; title: string[]; keyword: string }> = []
  const active = new Activations(chart.participants.length, high)
  // Where the last message's arrow is: an activation starts and ends there, as Mermaid's bar does.
  let arrow = -1
  steps.forEach((step, at) => {
    const left = levels[at]! - 1
    if (step.kind === 'activate') active.mark(step.who, step.on, arrow < 0 ? row : arrow)
    else if (step.kind === 'message') {
      drawMessage(canvas, x, row, step)
      arrow = step.from === step.to ? row : row + step.lines.length
    } else if (step.kind === 'note') drawNote(canvas, x, row, step)
    else if (step.kind === 'open')
      opened.push({ top: row, title: titles[at]!, keyword: step.keyword })
    else if (step.kind === 'part') {
      canvas.stroke(
        [
          [left, row],
          [wide - 1 - left, row],
        ],
        'dotted',
        DIM,
      )
      title(canvas, left, row, titles[at]!, step.keyword)
    } else {
      const frame = opened.pop()
      if (frame) {
        canvas.rect(left, frame.top, wide - 2 * left, row - frame.top + 1, 'solid', DIM, false)
        // Written once the border is: the title is laid over it.
        title(canvas, left, frame.top, frame.title, frame.keyword)
      }
    }
    row += rowsOf(step, titles[at]!)
  })
  return active.drawn(canvas.rows(), x)
}

/**
 * Lifeline drawn light, as it meets what crosses it, made heavy: what is not a lifeline's cell
 * (a note's border or its words over it) is left as it is.
 */
const HEAVIER: Record<string, string> = {
  '│': '┃',
  '├': '┠',
  '┤': '┨',
  '┼': '╂',
  '┬': '┰',
  '┴': '┸',
}

/** Which rows each participant is active over, its activations nested and closed in turn. */
class Activations {
  private readonly open: number[][]
  /** For each participant, by row: how many activations start there, less those that end. */
  private readonly edges: Int32Array[]
  private readonly high: number

  constructor(count: number, high: number) {
    this.high = high
    this.open = Array.from({ length: count }, () => [])
    this.edges = Array.from({ length: count }, () => new Int32Array(high + 1))
  }

  /** An activation of `who` starting at `row`, or its latest one ending there. */
  mark(who: number, on: boolean, row: number): void {
    if (on) {
      this.open[who]!.push(row)
      return
    }
    // A `deactivate` of nothing active is passed over, as Mermaid's error would leave nothing.
    const start = this.open[who]!.pop()
    if (start === undefined) return
    this.edges[who]![start]! += 1
    this.edges[who]![Math.min(this.high, row + 1)]! -= 1
  }

  /** `rows` with each lifeline heavy where it is active; one still open runs to the end. */
  drawn(rows: Line[], x: readonly number[]): Line[] {
    this.open.forEach((starts, who) => {
      for (const start of starts) this.edges[who]![start]! += 1
    })
    this.edges.forEach((edges, who) => {
      let depth = 0
      for (let row = 0; row < this.high; row++) {
        depth += edges[row]!
        if (depth > 0) rows[row] = heavier(rows[row]!, x[who]!)
      }
    })
    return rows
  }
}

/** `line` with the lifeline's cell at `column` made heavy, when it is one. */
function heavier(line: Line, column: number): Line {
  let at = 0
  return line.map((part) => {
    const from = at
    at += width(part.text)
    if (column < from || column >= at) return part
    let own = from
    let text = ''
    for (const char of part.text) {
      text += own === column ? (HEAVIER[char] ?? char) : char
      own += width(char)
    }
    return { ...part, text }
  })
}

/** A block part's title: its first row in the border, its keyword bold, the rest inside. */
function title(canvas: Canvas, left: number, row: number, lines: string[], keyword: string): void {
  lines.forEach((line, at) => {
    if (at > 0) {
      canvas.text(left + 2, row + at, line, PLAIN)
      return
    }
    canvas.text(left + 1, row, ` ${line} `, PLAIN)
    if (line.startsWith(keyword)) canvas.text(left + 2, row, keyword, BOLD)
  })
}

/** The rows a step takes. */
function rowsOf(step: Laid, heading: string[]): number {
  if (step.kind === 'message')
    return step.from === step.to ? Math.max(2, step.lines.length) : step.lines.length + 1
  if (step.kind === 'note') return step.lines.length + 2
  if (step.kind === 'close') return 1
  if (step.kind === 'activate') return 0
  return Math.max(1, heading.length)
}

/**
 * Each lifeline's column, and the last column of all. Every need is a least distance between two
 * lifelines, or between one and an edge of the picture (the two ends of the list); they are met
 * narrowest span first, a shortfall shared over the gaps of the span.
 */
function columnsOf(heads: string[][], steps: Laid[], inset: number): number[] {
  const count = heads.length
  // Positions 0 and count + 1 are the picture's edges; participant k is at k + 1.
  const needs: Array<[from: number, to: number, need: number]> = []
  const halves = heads.map((lines) => {
    const w = widest(lines) + 4
    return [Math.floor(w / 2), w - 1 - Math.floor(w / 2)] as const
  })
  const left = (at: number, need: number) => needs.push([at, at + 1, need + (at === 0 ? inset : 2)])
  const right = (at: number, need: number) =>
    needs.push([at + 1, at + 2, need + (at + 1 === count ? inset : 2)])
  halves.forEach(([low, high], at) => {
    left(at, low)
    if (at + 1 < count) needs.push([at + 1, at + 2, high + 2 + halves[at + 1]![0]])
    else right(at, high)
  })
  for (const step of steps) {
    const wide = widest(step.lines)
    if (step.kind === 'message') {
      if (step.from === step.to) right(step.from, 3 + wide)
      else
        needs.push([Math.min(step.from, step.to) + 1, Math.max(step.from, step.to) + 1, wide + 3])
    }
    if (step.kind !== 'note') continue
    const box = wide + 4
    if (step.side === 'left') left(step.from, box)
    else if (step.side === 'right') right(step.from, box)
    else if (step.from === step.to) {
      left(step.from, Math.floor(box / 2))
      right(step.from, box - 1 - Math.floor(box / 2))
    } else {
      needs.push([step.from + 1, step.to + 1, box - 5])
      left(step.from, 2)
      right(step.to, 2)
    }
  }
  needs.sort((a, b) => a[1] - a[0] - (b[1] - b[0]) || a[0] - b[0])
  const gaps = Array.from({ length: count + 1 }, () => 0)
  for (const [from, to, need] of needs) {
    let have = 0
    for (let at = from; at < to; at++) have += gaps[at]!
    const short = need - have
    if (short <= 0) continue
    const span = to - from
    for (let at = from; at < to; at++)
      gaps[at]! += Math.floor(short / span) + (to - at <= short % span ? 1 : 0)
  }
  const out: number[] = []
  let at = 0
  for (const gap of gaps) out.push((at += gap))
  return out
}

const TIPS: Record<Tip, readonly [right: string, left: string]> = {
  arrow: ['▶', '◀'],
  async: ['▷', '◁'],
  cross: ['×', '×'],
  none: ['', ''],
}

/** A message's label over its arrow, or a message to oneself as a loop with its label beside. */
function drawMessage(
  canvas: Canvas,
  x: number[],
  row: number,
  step: Laid & { kind: 'message' },
): void {
  const from = x[step.from]!
  const to = x[step.to]!
  const tips = TIPS[step.tip]
  const ink: Ink = step.ink
  if (step.from === step.to) {
    const rows = Math.max(2, step.lines.length)
    const back = row + rows - 1
    canvas.stroke(
      [
        [from, row],
        [from + 2, row],
        [from + 2, back],
        [step.tip === 'none' ? from : from + 1, back],
      ],
      ink,
      DIM,
    )
    if (tips[1]) canvas.text(from + 1, back, tips[1], DIM)
    step.lines.forEach((line, at) => canvas.text(from + 4, row + at, line, PLAIN))
    return
  }
  const ahead = to > from ? 1 : -1
  const arrow = row + step.lines.length
  canvas.stroke(
    [
      [from, arrow],
      [tips[0] ? to - ahead : to, arrow],
    ],
    ink,
    DIM,
  )
  if (tips[0]) canvas.text(to - ahead, arrow, ahead > 0 ? tips[0] : tips[1], DIM)
  if (step.both) canvas.text(from + ahead, arrow, ahead > 0 ? '◀' : '▶', DIM)
  const low = Math.min(from, to)
  const room = Math.abs(to - from) - 1
  step.lines.forEach((line, at) => {
    canvas.text(low + 1 + Math.floor((room - width(line)) / 2), row + at, line, PLAIN)
  })
}

/** A note in a dashed box, over what it covers of the lifelines. */
function drawNote(canvas: Canvas, x: number[], row: number, step: Laid & { kind: 'note' }): void {
  const box = widest(step.lines) + 4
  const from = x[step.from]!
  const to = x[step.to]!
  const left =
    step.side === 'left'
      ? from - box
      : step.side === 'right'
        ? from + 1
        : step.from === step.to
          ? from - Math.floor(box / 2)
          : Math.min(from - 2, Math.floor((from + to - box + 1) / 2))
  const w = step.side === 'over' && step.from !== step.to ? Math.max(box, to - from + 5) : box
  const h = step.lines.length + 2
  canvas.erase(left, row, w, h)
  canvas.rect(left, row, w, h, 'dotted', DIM, true)
  step.lines.forEach((line, at) => {
    canvas.text(left + Math.floor((w - width(line)) / 2), row + 1 + at, line, PLAIN)
  })
}
