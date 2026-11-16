/**
 * A diagram written out when its picture does not fit: what it holds, then one row for each edge
 * or message, `Start ──yes──▶ Done`, wrapped to the columns with its continuation indented. Every
 * word of the source that a picture would show is here, and nothing is cut.
 */
import type { Ink } from './canvas'
import type { Flowchart, Head } from './parse'
import type { Sequence, Tip } from './sequence-parse'
import { BOLD, DIM, PLAIN, WAITING, type Line, type Span } from '../style'
import { span, wrap } from '../wrap'

/** Past this many rows no diagram is drawn: not a picture, and not an outline either. */
export const MOST_ROWS = 2000

const LINES: Record<Ink, string> = { solid: '─', dotted: '┄', thick: '━' }
const HEADS: Record<Head, string> = { arrow: '▶', cross: '×', circle: '○', none: '' }
const TAILS: Record<Head, string> = { arrow: '◀', cross: '×', circle: '○', none: '' }
const TIPS: Record<Tip, string> = { arrow: '▶', async: '▷', cross: '×', none: '' }

/** An arrow with `label` in it: `──▶`, `◀──▶`, `──yes──▶`. */
function arrow(ink: Ink, tail: string, head: string, label: string): Span[] {
  const line = LINES[ink].repeat(2)
  const end = head || LINES[ink]
  if (!label) return [span(tail + line + end, DIM)]
  return [span(tail + line, DIM), span(label, WAITING), span(line + end, DIM)]
}

/**
 * `line` wrapped to `columns`, starting `indent` columns in and going on two further in. An indent
 * leaves two columns at least: a character two columns wide must fit after it.
 */
function rows(line: Line, columns: number, indent: number): Line[] {
  const first = Math.min(indent, Math.max(0, columns - 2))
  const rest = Math.min(indent + 2, Math.max(0, columns - 2))
  return wrap(
    line,
    columns,
    first ? [span(' '.repeat(first), PLAIN)] : [],
    rest ? [span(' '.repeat(rest), PLAIN)] : [],
  )
}

/** `chart`'s nodes, by subgraph, then its edges; null when that is more rows than a reply holds. */
export function flowOutline(chart: Flowchart, columns: number): Line[] | null {
  const name = (at: number) => {
    const node = chart.nodes[at]!
    return node.label.length > 0 ? node.label.join(' ') : node.id
  }
  const out: Line[] = []
  const children = chart.groups.map((): number[] => [])
  chart.groups.forEach((group, at) => {
    if (group.parent >= 0) children[group.parent]!.push(at)
  })
  const nodes = (group: number, indent: number) => {
    chart.nodes.forEach((node, at) => {
      if (node.group === group && out.length <= MOST_ROWS)
        out.push(...rows([span('• ', DIM), span(name(at), PLAIN)], columns, indent))
    })
  }
  // Subgraphs nest no deeper than they were read (at most two hundred): the recursion is bounded.
  const group = (at: number, indent: number) => {
    const title = chart.groups[at]!.title.join(' ')
    out.push(...rows([span(title || 'subgraph', BOLD)], columns, indent))
    nodes(at, indent + 2)
    for (const child of children[at]!) group(child, indent + 2)
  }
  nodes(-1, 0)
  chart.groups.forEach((own, at) => {
    if (own.parent < 0) group(at, 0)
  })
  for (const edge of chart.edges) {
    if (out.length > MOST_ROWS) return null
    const line: Line = [
      span(name(edge.from), PLAIN),
      span(' ', PLAIN),
      ...arrow(edge.ink, TAILS[edge.tail], HEADS[edge.head], edge.label.join(' ')),
      span(' ', PLAIN),
      span(name(edge.to), PLAIN),
    ]
    out.push(...rows(line, columns, 0))
  }
  return out.length > MOST_ROWS ? null : out
}

/**
 * `chart`'s participants on one row, then its steps: each message as `Alice ──▶ Bob: Hello`,
 * each note, and each block's parts indented under its keyword.
 */
export function sequenceOutline(chart: Sequence, columns: number): Line[] | null {
  const name = (at: number) => chart.participants[at]!.label.join(' ')
  const out: Line[] = rows(
    chart.participants.flatMap((_, at) => [
      ...(at > 0 ? [span(', ', DIM)] : []),
      span(name(at), BOLD),
    ]),
    columns,
    0,
  )
  let depth = 0
  for (const step of chart.steps) {
    if (out.length > MOST_ROWS) return null
    const indent = 2 * depth
    if (step.kind === 'message') {
      const text = step.label.join(' ')
      const line: Line = [
        span(name(step.from), PLAIN),
        span(' ', PLAIN),
        ...arrow(step.ink, step.both ? '◀' : '', TIPS[step.tip], ''),
        span(' ', PLAIN),
        span(name(step.to), PLAIN),
        ...(text ? [span(': ', DIM), span(text, PLAIN)] : []),
      ]
      out.push(...rows(line, columns, indent))
    } else if (step.kind === 'note') {
      const over = step.from === step.to ? name(step.from) : `${name(step.from)}, ${name(step.to)}`
      const where = step.side === 'over' ? 'over' : `${step.side} of`
      out.push(
        ...rows(
          [span(`note ${where} ${over}: `, DIM), span(step.label.join(' '), PLAIN)],
          columns,
          indent,
        ),
      )
    } else if (step.kind === 'activate') {
      // An activation is a span of the picture's lifeline: a row would say nothing more.
      continue
    } else if (step.kind === 'close') {
      depth = Math.max(0, depth - 1)
      out.push(...rows([span('end', BOLD)], columns, 2 * depth))
    } else {
      const own = step.kind === 'part' ? Math.max(0, indent - 2) : indent
      const title = step.title.join(' ')
      out.push(
        ...rows(
          [span(step.keyword, BOLD), ...(title ? [span(` ${title}`, PLAIN)] : [])],
          columns,
          own,
        ),
      )
      if (step.kind === 'open') depth++
    }
  }
  return out.length > MOST_ROWS ? null : out
}
