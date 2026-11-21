/**
 * Class diagrams (`classDiagram`) as a picture: each class a box of compartments, its name over
 * its attributes over its methods, each under a rule, an annotation (`«interface»`) over the
 * name and generics written as they are read (`List<T>`). A relation is an edge with its ends
 * drawn as UML draws them, a hollow triangle (`△`) at what is inherited or realised, a diamond
 * at what composes (`◆`) or aggregates (`◇`), and its multiplicities written by the boxes. A
 * namespace is a frame; a note a dotted box, joined to its class by a dotted line.
 */
import { direction, Graph, graphRows, MOST_MEMBERS, PASSED, unquoted } from './graph'
import type { DiagramKind } from './kind'
import type { FlowEdge, Head, Mark } from './parse'
import { labelLines } from './text'

const HEADER = /^classDiagram(?:-v2)?\b\s*;?$/i
// A name in backquotes may hold anything but its quote; a generic is read with its name.
const NAME = String.raw`(?:${'`'}[^${'`'}]+${'`'}|[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*(?:~[^\s]*~)?)`
const CLASS = new RegExp(
  String.raw`^class\s+(${NAME})\s*(?:\[\s*"?([^"\]]*)"?\s*\])?(?::::[\w-]+)?\s*(\{)?\s*(?:(.*?)\})?\s*;?$`,
  'u',
)
const END = String.raw`(<\||\*|o|<|\(\))?`
const RELATION = new RegExp(
  String.raw`^(${NAME})\s*(?:"([^"]*)"\s*)?${END}(--|\.\.)(\|>|\*|o|>|\(\))?\s*(?:"([^"]*)"\s*)?(${NAME})\s*(?::(.*))?$`,
  'u',
)
const MEMBER = new RegExp(String.raw`^(${NAME})\s*:(.*)$`, 'u')
const ANNOTATED = new RegExp(String.raw`^<<\s*([^<>]+?)\s*>>\s*(${NAME})\s*;?$`, 'u')
const ANNOTATION = /^<<\s*([^<>]+?)\s*>>\s*;?$/
const NAMESPACE = /^namespace\s+([^\s{]+)\s*\{?\s*$/
const NOTE = new RegExp(String.raw`^note\s+(?:for\s+(${NAME})\s+)?(".*"|\S.*)$`, 'iu')
const BARE = new RegExp(String.raw`^(${NAME})\s*;?$`, 'u')

export const classDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => graphRows(parseClass(lines), columns),
}

interface Members {
  annotations: string[]
  attributes: string[]
  methods: string[]
}

/** What a relation's end is drawn with, by how it is written. */
const ENDS: Record<string, { head: Head; mark?: Mark }> = {
  '<|': { head: 'arrow', mark: 'triangle' },
  '|>': { head: 'arrow', mark: 'triangle' },
  '*': { head: 'arrow', mark: 'diamond' },
  o: { head: 'arrow', mark: 'hollow' },
  '<': { head: 'arrow' },
  '>': { head: 'arrow' },
  '()': { head: 'circle' },
}

/** The classes and relations `lines` write (the first is the header); null when none read. */
export function parseClass(lines: readonly string[]) {
  if (!HEADER.test(lines[0] ?? '')) return null
  const graph = new Graph()
  const members = new Map<number, Members>()
  // What each open brace opened: a namespace (its group) or a class's body (its node).
  const open: Array<{ group: number } | { node: number }> = []
  const group = () => {
    for (let at = open.length - 1; at >= 0; at--) {
      const own = open[at]!
      if ('group' in own) return own.group
    }
    return -1
  }
  const node = (name: string, declared = false) => {
    // `C~T~` is the class `C`, its parameter written where it is named with it.
    const written = unquoted(name)
    const id = written.replace(/~.*$/, '')
    const at = graph.node(id || written, group(), labelLines(written).map(generic))
    if (at >= 0 && id !== written) graph.chart.nodes[at]!.label = labelLines(written).map(generic)
    // A class is in the namespace it is declared in, wherever it was named first.
    if (at >= 0 && declared && group() >= 0) graph.chart.nodes[at]!.group = group()
    if (at >= 0 && !members.has(at))
      members.set(at, { annotations: [], attributes: [], methods: [] })
    return at
  }
  let notes = 0
  for (const line of lines.slice(1)) {
    const body = open.at(-1)
    if (body && 'node' in body) {
      if (line === '}') open.pop()
      else member(members.get(body.node), line)
      continue
    }
    if (PASSED.test(line)) continue
    const turned = direction(line)
    if (turned) {
      graph.chart.direction = turned
      continue
    }
    if (line === '}') {
      open.pop()
      continue
    }
    const namespace = NAMESPACE.exec(line)
    if (namespace) {
      open.push({ group: graph.group(labelLines(namespace[1]!), group()) })
      continue
    }
    const declared = CLASS.exec(line)
    if (declared) {
      const at = node(declared[1]!, true)
      if (at < 0) continue
      if (declared[2] !== undefined) graph.chart.nodes[at]!.label = labelLines(declared[2])
      if (declared[4] !== undefined)
        for (const piece of declared[4].split(';')) member(members.get(at), piece.trim())
      else if (declared[3]) open.push({ node: at })
      continue
    }
    const relation = RELATION.exec(line)
    if (relation) {
      const from = node(relation[1]!)
      const to = node(relation[7]!)
      graph.edge(from, to, relationEdge(relation))
      continue
    }
    const annotated = ANNOTATED.exec(line)
    if (annotated) {
      const own = members.get(node(annotated[2]!))
      if (own && own.annotations.length < MOST_MEMBERS) own.annotations.push(annotated[1]!)
      continue
    }
    const note = NOTE.exec(line)
    if (note) {
      const text = labelLines(unquoted(note[2]!).replace(/\\n/g, '<br>'))
      const of = note[1] === undefined ? -1 : node(note[1])
      const own = graph.node(
        `[note] ${notes++}`,
        of >= 0 ? graph.chart.nodes[of]!.group : group(),
        text,
      )
      if (own < 0 || text.length === 0) continue
      graph.chart.nodes[own]!.ink = 'dotted'
      if (of >= 0) graph.edge(of, own, { ink: 'dotted', head: 'none' })
      continue
    }
    const written = MEMBER.exec(line)
    if (written) {
      member(members.get(node(written[1]!)), written[2]!.trim())
      continue
    }
    const bare = BARE.exec(line)
    if (bare) node(bare[1]!)
  }
  for (const [at, own] of members) {
    const box = graph.chart.nodes[at]!
    box.label = [...own.annotations.map((text) => `«${text}»`), ...box.label]
    box.parts = [own.attributes, own.methods]
  }
  graph.holdEmpty()
  return graph.chart.nodes.length > 0 ? graph.chart : null
}

/** A member, an annotation, of a class's body: a method is what has its parentheses. */
function member(own: Members | undefined, line: string): void {
  if (!own || line === '') return
  const annotation = ANNOTATION.exec(line)
  if (annotation) {
    if (own.annotations.length < MOST_MEMBERS) own.annotations.push(annotation[1]!)
    return
  }
  const list = line.includes('(') ? own.methods : own.attributes
  // Read as a label first: a type made `<a>` would be taken for a tag and left out.
  if (list.length < MOST_MEMBERS) list.push(...labelLines(line).map(generic))
}

/**
 * Generics as they are read: a `~` before a name opens one, any other closes it, so that
 * `List~List~int~~` is `List<List<int>>`.
 */
const generic = (text: string): string =>
  text.replace(/~(?=[\p{L}\p{N}_])/gu, '<').replace(/~/g, '>')

function relationEdge(hit: RegExpExecArray): Partial<FlowEdge> {
  const tail = ENDS[hit[3] ?? '']
  const head = ENDS[hit[5] ?? '']
  return {
    label: labelLines(hit[8] ?? ''),
    ink: hit[4] === '..' ? 'dotted' : 'solid',
    head: head?.head ?? 'none',
    tail: tail?.head ?? 'none',
    marks: {
      ...(head?.mark ? { head: head.mark } : {}),
      ...(tail?.mark ? { tail: tail.mark } : {}),
    },
    ends: { head: labelLines(hit[6] ?? '').join(' '), tail: labelLines(hit[2] ?? '').join(' ') },
  }
}
