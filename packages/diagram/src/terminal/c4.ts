/**
 * C4 diagrams (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) as a
 * picture: each person, system, container and component a box, its name over its kind and its
 * technology (`[Container: Java]`), its description under a rule; a person's box is rounded, a
 * database a drum, a queue has round sides, and what is outside (`_Ext`) is dotted. A boundary or
 * a deployment node is a frame, and a relation an arrow with its label and its technology; in a
 * dynamic diagram each relation is numbered in the order it was written, as Mermaid numbers it.
 *
 * A relation that names a way (`Rel_U`, `Rel_Down`, `Rel_L` …) is a hint where its target goes.
 * The layers run down, so an up or a down one puts its target in the rank over or under its
 * source, the edge turned for an up one and its arrow kept at the target. A left or a right one
 * cannot share a rank with its source, for no edge runs within one: when such hints outnumber
 * the ups and downs the chart runs across instead and they place their targets so, and the others
 * are read as plain relations.
 */
import { Graph, graphRows, MOST_GROUPS, PASSED } from './graph'
import type { DiagramKind } from './kind'
import type { Shape } from './parse'
import { labelLines } from './text'

const HEADER = /^C4(Context|Container|Component|Dynamic|Deployment)\b\s*;?$/
const CALL = /^([A-Za-z_]+)\s*\((.*)\)\s*(\{)?\s*;?$/
const ELEMENT = /^(Person|System|Container|Component)(Db|Queue)?(_Ext)?$/
const BOUNDARY =
  /^(?:Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|Deployment_Node|Node|Node_L|Node_R)$/
const RELATION =
  /^(?:Rel|BiRel|Rel_Back|Rel_U|Rel_Up|Rel_D|Rel_Down|Rel_L|Rel_Left|Rel_R|Rel_Right|RelIndex)$/
/** The way a relation's name says its target is from its source. */
const WAYS: Record<string, Way> = {
  Rel_U: 'up',
  Rel_Up: 'up',
  Rel_D: 'down',
  Rel_Down: 'down',
  Rel_L: 'left',
  Rel_Left: 'left',
  Rel_R: 'right',
  Rel_Right: 'right',
}

type Way = 'up' | 'down' | 'left' | 'right'

export const c4Diagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => {
    const read = parseC4(lines)
    return read && graphRows(read.chart, columns, read.title)
  },
}

/** Mermaid's words for each kind, over the box. */
const KINDS: Record<string, string> = {
  Person: 'Person',
  System: 'Software System',
  Container: 'Container',
  Component: 'Component',
}

const BOUNDARY_KINDS: Record<string, string> = {
  Enterprise_Boundary: 'Enterprise',
  System_Boundary: 'System',
  Container_Boundary: 'Container',
}

const SHAPES: Record<string, Shape> = { Db: 'cylinder', Queue: 'stadium' }

/** A C4 chart's elements, boundaries and relations, and its title; null when nothing reads. */
export function parseC4(lines: readonly string[]) {
  const header = HEADER.exec(lines[0] ?? '')
  if (!header) return null
  const dynamic = header[1] === 'Dynamic'
  const graph = new Graph()
  const open: number[] = []
  let title = ''
  let step = 0
  const relations: Array<{
    from: number
    to: number
    label: string[]
    both: boolean
    way: Way | undefined
  }> = []
  for (const line of lines.slice(1)) {
    if (PASSED.test(line)) continue
    if (line === '}') {
      open.pop()
      continue
    }
    const titled = /^title\s+(.*)$/i.exec(line)
    if (titled) {
      title = titled[1]!
      continue
    }
    const call = CALL.exec(line)
    if (!call) continue
    const name = call[1]!
    const args = splitArgs(call[2]!)
    const group = open.at(-1) ?? -1
    const element = ELEMENT.exec(name)
    if (element && args[0]) {
      const at = graph.node(args[0], group)
      if (at < 0) continue
      const node = graph.chart.nodes[at]!
      const label = labelLines(args[1] ?? args[0])
      // A person and a system have no technology: their third argument is the description.
      const technology = element[1] === 'Person' || element[1] === 'System' ? '' : (args[2] ?? '')
      const description = element[1] === 'Person' || element[1] === 'System' ? args[2] : args[3]
      const kind = `${element[3] ? 'External ' : ''}${KINDS[element[1]!]!}`
      node.label = [...label, ...labelLines(`[${kind}${technology ? `: ${technology}` : ''}]`)]
      node.parts = [labelLines(description ?? '')]
      node.shape = SHAPES[element[2] ?? ''] ?? (element[1] === 'Person' ? 'round' : 'box')
      node.group = group
      if (element[3]) node.ink = 'dotted'
      continue
    }
    if (call[3]) {
      // A brace opened by what is not a boundary is still closed by its `}`: it is the group it
      // is in, so that the closing brace closes it and nothing else.
      const own = BOUNDARY.test(name) && graph.chart.groups.length < MOST_GROUPS
      // A boundary's type, or a node's, is written after its name: `Bank [Enterprise]`.
      const kind = args[2] ?? BOUNDARY_KINDS[name] ?? ''
      const words = [
        ...labelLines(args[1] ?? args[0] ?? ''),
        ...(kind ? labelLines(`[${kind}]`) : []),
      ]
      open.push(own ? graph.group([words.join(' ')], group) : group)
      continue
    }
    if (RELATION.test(name)) {
      const own = name === 'RelIndex' ? args.slice(1) : args
      if (!own[0] || !own[1]) continue
      const back = name === 'Rel_Back'
      const from = graph.node(back ? own[1] : own[0], group)
      const to = graph.node(back ? own[0] : own[1], group)
      const index = name === 'RelIndex' ? args[0] : dynamic ? String(++step) : ''
      const label = [
        ...labelLines(index ? `${index}: ${own[2] ?? ''}` : (own[2] ?? '')),
        ...(own[3] ? labelLines(`[${own[3]}]`) : []),
      ]
      relations.push({ from, to, label, both: name === 'BiRel', way: WAYS[name] })
    }
  }
  const count = (ways: Way[]) => relations.filter((one) => one.way && ways.includes(one.way)).length
  const across = count(['left', 'right']) > count(['up', 'down'])
  graph.chart.direction = across ? 'LR' : 'TD'
  for (const own of relations) {
    const tail = own.both ? 'arrow' : 'none'
    // A target named before its source on the axis the chart runs is drawn from it, the arrow
    // still at the target: the layers put an edge's start first.
    if (own.way === (across ? 'left' : 'up'))
      graph.edge(own.to, own.from, { label: own.label, head: tail, tail: 'arrow' })
    else graph.edge(own.from, own.to, { label: own.label, tail })
  }
  graph.holdEmpty()
  if (graph.chart.nodes.length === 0) return null
  return { chart: graph.chart, title }
}

/**
 * A call's arguments: split at the commas outside quotes, each unquoted; a named one (`$tags=`)
 * is a style, and is passed over.
 */
function splitArgs(text: string): string[] {
  const out: string[] = []
  let quoted = false
  let from = 0
  for (let at = 0; at <= text.length; at++) {
    const char = text[at]
    if (char === '"') quoted = !quoted
    else if ((char === ',' && !quoted) || at === text.length) {
      out.push(text.slice(from, at).trim())
      from = at + 1
    }
  }
  return out
    .filter((arg) => !arg.startsWith('$'))
    .map((arg) =>
      arg.length >= 2 && arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg,
    )
}
