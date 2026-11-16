/**
 * Entity relationship diagrams (`erDiagram`) as a picture: each entity a box, its name over its
 * attributes, one row each, their type, name, keys and comment in columns. A relationship is an
 * edge, solid when it identifies and dotted when it does not, its cardinality written plainly at
 * each end as Mermaid writes it, a crow's foot in two characters (`||`, `o{`, `}|`), and its label
 * at its middle. The words Mermaid also reads for them (`one or more`, `zero or many`) are drawn
 * as the same marks.
 */
import { direction, Graph, graphRows, MOST_MEMBERS, PASSED, unquoted } from './graph'
import type { DiagramKind } from './kind'
import { labelLines } from './text'
import { width } from '../width'

const HEADER = /^erDiagram\b\s*;?$/i
const NAME = String.raw`(?:"[^"]+"|[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*)`
// Each side's cardinality as a crow's foot, or in words.
const LEFT = String.raw`(\|o|o\||\|\||\}o|o\}|\}\||\|\})`
const RIGHT = String.raw`(o\||\|o|\|\||o\{|\{o|\|\{|\{\|)`
const RELATION = new RegExp(
  String.raw`^(${NAME})\s*${LEFT}(--|\.\.)${RIGHT}\s*(${NAME})\s*(?::(.*))?$`,
  'u',
)
const WORDS = String.raw`(one or zero|zero or one|one or more|one or many|many\(1\)|1\+|zero or more|zero or many|many\(0\)|0\+|only one|1)`
const SPOKEN = new RegExp(
  String.raw`^(${NAME})\s+${WORDS}\s+(to|optionally to)\s+${WORDS}\s+(${NAME})\s*(?::(.*))?$`,
  'iu',
)
const ENTITY = new RegExp(String.raw`^(${NAME})\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*(\{)?\s*;?$`, 'u')
const ATTRIBUTE =
  /^([\p{L}\p{N}_*\-[\]().,]+)\s+([\p{L}\p{N}_*\-[\]().]+)((?:\s+(?:PK|FK|UK)\s*(?:,\s*(?:PK|FK|UK)\s*)*)?)(?:\s+"([^"]*)")?\s*$/iu

export const erDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => graphRows(parseEr(lines), columns),
}

/** The marks the words stand for, at the left end and at the right. */
const SPOKEN_MARKS: Record<string, readonly [left: string, right: string]> = {
  'one or zero': ['|o', 'o|'],
  'zero or one': ['|o', 'o|'],
  'one or more': ['}|', '|{'],
  'one or many': ['}|', '|{'],
  'many(1)': ['}|', '|{'],
  '1+': ['}|', '|{'],
  'zero or more': ['}o', 'o{'],
  'zero or many': ['}o', 'o{'],
  'many(0)': ['}o', 'o{'],
  '0+': ['}o', 'o{'],
  'only one': ['||', '||'],
  '1': ['||', '||'],
}

interface Attribute {
  type: string
  name: string
  keys: string
  comment: string
}

/** The entities and relationships `lines` write (the first is the header); null when none. */
export function parseEr(lines: readonly string[]) {
  if (!HEADER.test(lines[0] ?? '')) return null
  const graph = new Graph()
  const attributes = new Map<number, Attribute[]>()
  const entity = (name: string) => graph.node(unquoted(name))
  let body = -1
  let inBody = false
  for (const line of lines.slice(1)) {
    if (inBody) {
      if (line === '}') inBody = false
      else attribute(attributes, body, line)
      continue
    }
    if (PASSED.test(line) || /^class\s/i.test(line)) continue
    const turned = direction(line)
    if (turned) {
      graph.chart.direction = turned
      continue
    }
    const relation = RELATION.exec(line)
    const spoken = relation ? null : SPOKEN.exec(line)
    if (relation || spoken) {
      const hit = (relation ?? spoken)!
      const from = entity(hit[1]!)
      const to = entity(hit[5]!)
      const solid = relation ? hit[3] === '--' : hit[3]!.toLowerCase() === 'to'
      const tail = relation ? hit[2]! : SPOKEN_MARKS[hit[2]!.toLowerCase()]![0]
      const head = relation ? hit[4]! : SPOKEN_MARKS[hit[4]!.toLowerCase()]![1]
      graph.edge(from, to, {
        label: labelLines(hit[6] ?? ''),
        ink: solid ? 'solid' : 'dotted',
        head: 'none',
        ends: { tail, head },
      })
      continue
    }
    const declared = ENTITY.exec(line)
    if (declared) {
      body = entity(declared[1]!)
      if (body >= 0 && declared[2] !== undefined)
        graph.chart.nodes[body]!.label = labelLines(declared[2])
      inBody = Boolean(declared[3])
    }
  }
  for (const [at, own] of attributes) graph.chart.nodes[at]!.parts = [table(own)]
  return graph.chart.nodes.length > 0 ? graph.chart : null
}

function attribute(attributes: Map<number, Attribute[]>, at: number, line: string): void {
  if (at < 0) return
  const hit = ATTRIBUTE.exec(line)
  if (!hit) return
  const own = attributes.get(at) ?? []
  attributes.set(at, own)
  if (own.length >= MOST_MEMBERS) return
  own.push({
    type: labelLines(hit[1]!).join(' '),
    name: labelLines(hit[2]!).join(' '),
    keys: hit[3]!
      .split(',')
      .map((key) => key.trim().toUpperCase())
      .filter(Boolean)
      .join(','),
    comment: labelLines(hit[4] ?? '').join(' '),
  })
}

/** An entity's attributes as rows, each column as wide as its widest: a table in the box. */
function table(attributes: Attribute[]): string[] {
  const fields = ['type', 'name', 'keys', 'comment'] as const
  const widths = fields.map((field) =>
    attributes.reduce((most, own) => Math.max(most, width(own[field])), 0),
  )
  return attributes.map((own) =>
    fields
      .map((field, at) =>
        widths[at] ? own[field] + ' '.repeat(widths[at]! - width(own[field])) : '',
      )
      .filter((cell, at) => widths[at])
      .join(' ')
      .trimEnd(),
  )
}
