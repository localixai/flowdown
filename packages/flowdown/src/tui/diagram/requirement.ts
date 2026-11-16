/**
 * Requirement diagrams (`requirementDiagram`) as a picture: each requirement and each element a
 * box, its kind (`«Requirement»`, `«Element»`) over its name, its fields under a rule. A relation
 * is a dotted arrow with its kind for a label (`«satisfies»`); `contains` is a solid line with `⊕`
 * at what contains, as SysML draws it.
 */
import { direction, Graph, graphRows, MOST_MEMBERS, PASSED, unquoted } from './graph'
import type { DiagramKind } from './kind'
import { labelLines } from './text'

const HEADER = /^requirementDiagram\b\s*;?$/i
const NAME = String.raw`(?:"[^"]+"|[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*)`
const KINDS =
  'requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element'
const BLOCK = new RegExp(String.raw`^(${KINDS})\s+(${NAME})(?::::[\w-]+)?\s*\{\s*$`, 'iu')
const TYPES = 'contains|copies|derives|satisfies|verifies|refines|traces'
const FORWARD = new RegExp(String.raw`^(${NAME})\s*-\s*(${TYPES})\s*->\s*(${NAME})\s*;?$`, 'iu')
const BACKWARD = new RegExp(String.raw`^(${NAME})\s*<-\s*(${TYPES})\s*-\s*(${NAME})\s*;?$`, 'iu')
const FIELD = /^([\p{L}_]+)\s*:\s*(.*?)\s*;?$/u

export const requirementDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => graphRows(parseRequirement(lines), columns),
}

/** How a kind and a field are written over a box and in it, as Mermaid writes them. */
const TITLES: Record<string, string> = {
  requirement: 'Requirement',
  functionalrequirement: 'Functional Requirement',
  interfacerequirement: 'Interface Requirement',
  performancerequirement: 'Performance Requirement',
  physicalrequirement: 'Physical Requirement',
  designconstraint: 'Design Constraint',
  element: 'Element',
}
const FIELDS: Record<string, string> = {
  id: 'Id',
  text: 'Text',
  risk: 'Risk',
  verifymethod: 'Verification',
  type: 'Type',
  docref: 'Doc Ref',
}

/** The requirements, elements and relations `lines` write; null when none could be read. */
export function parseRequirement(lines: readonly string[]) {
  if (!HEADER.test(lines[0] ?? '')) return null
  const graph = new Graph()
  const node = (name: string) => graph.node(unquoted(name))
  let body = -1
  let inBody = false
  for (const line of lines.slice(1)) {
    if (inBody) {
      if (line === '}') inBody = false
      else field(graph, body, line)
      continue
    }
    if (PASSED.test(line) || /^class\s/i.test(line)) continue
    const turned = direction(line)
    if (turned) {
      graph.chart.direction = turned
      continue
    }
    const block = BLOCK.exec(line)
    if (block) {
      body = node(block[2]!)
      inBody = true
      if (body < 0) continue
      const own = graph.chart.nodes[body]!
      own.label = [`«${TITLES[block[1]!.toLowerCase()]!}»`, ...labelLines(unquoted(block[2]!))]
      own.parts ??= [[]]
      continue
    }
    const forward = FORWARD.exec(line)
    const backward = forward ? null : BACKWARD.exec(line)
    const hit = forward ?? backward
    if (!hit) continue
    // `a - satisfies -> b` and `b <- satisfies - a` say one thing: a satisfies b.
    const [from, to] = forward ? [hit[1]!, hit[3]!] : [hit[3]!, hit[1]!]
    const kind = hit[2]!.toLowerCase()
    const contains = kind === 'contains'
    graph.edge(node(from), node(to), {
      label: [`«${kind}»`],
      ink: contains ? 'solid' : 'dotted',
      head: contains ? 'none' : 'arrow',
      tail: contains ? 'arrow' : 'none',
      ...(contains ? { marks: { tail: 'plus' } } : {}),
    })
  }
  return graph.chart.nodes.length > 0 ? graph.chart : null
}

/** A field of a box's body, `id: 1`, written as Mermaid writes it: `Id: 1`. */
function field(graph: Graph, at: number, line: string): void {
  const hit = FIELD.exec(line)
  const node = graph.chart.nodes[at]
  if (!hit || !node) return
  const part = (node.parts ??= [[]])[0]!
  if (part.length >= MOST_MEMBERS) return
  const name = FIELDS[hit[1]!.toLowerCase()] ?? hit[1]!
  // The name is letters alone (`FIELD`): only the value has to be made printable.
  part.push(`${name}: ${labelLines(unquoted(hit[2]!)).join(' ')}`.trimEnd())
}
