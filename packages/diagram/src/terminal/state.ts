/**
 * State diagrams (`stateDiagram`, `stateDiagram-v2`) as a picture: each state a rounded box, its
 * descriptions under a rule, the start of a machine `●` and its end `◉`, a choice `◇`, a fork or a
 * join a bar, and a composite state a frame around the states it holds, its regions (`--`) frames
 * of their own inside it. A note is a dotted box on the side of its state it names: beside it in
 * its rank when the chart runs down, as Mermaid sets it with no line between; when the chart runs
 * across, in the rank before or after it, joined to it by a dotted line.
 *
 * A layered layout has no edge to a frame: a transition into a composite state is drawn into
 * where it starts (its `[*]`, else its first state), and one out of it from where it ends (its
 * `[*]`, else a state it holds that leads nowhere, else its last).
 */
import {
  direction,
  Graph,
  graphRows,
  MOST_EDGES,
  MOST_GROUPS,
  MOST_MEMBERS,
  MOST_NODES,
  PASSED,
} from './graph'
import type { DiagramKind } from './kind'
import type { Direction, Shape } from './parse'
import { labelLines } from './text'

const HEADER = /^stateDiagram(?:-v2)?\b\s*;?$/i
const ID = String.raw`[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*`
const END = String.raw`(${ID}|\[\*\])(?::::[\w-]+)?`
const TRANSITION = new RegExp(String.raw`^${END}\s*-->\s*${END}\s*(?::(.*))?$`, 'u')
const STATE = new RegExp(
  String.raw`^state\s+(?:"([^"]*)"\s+as\s+(${ID})|(${ID})(?:\s+as\s+"([^"]*)")?)(?::::[\w-]+)?\s*(?:<<(choice|fork|join)>>|\[\[(choice|fork|join)\]\])?\s*(?::(.*?))?\s*(\{)?$`,
  'iu',
)
const DESCRIBED = new RegExp(String.raw`^(${ID})(?::::[\w-]+)?\s*:(.*)$`, 'u')
const BARE = new RegExp(String.raw`^(${ID})(?::::[\w-]+)?\s*;?$`, 'u')
const NOTE = new RegExp(String.raw`^note\s+(left|right)\s+of\s+(${ID})\s*(?::(.*))?$`, 'iu')
const SKIPPED = /^(?:hide|scale|class)\s|^state$/i

export const stateDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => graphRows(parseState(lines), columns),
}

interface State {
  label: string[]
  descriptions: string[]
  shape: Shape
  /** Its group as read: an index into `Read.groups`. */
  group: number
}

interface ReadGroup {
  title: string[]
  parent: number
  /** The composite state it is, or null for a region. */
  composite: string | null
}

interface Read {
  direction: Direction
  /** By key: a state's name, or the start or end of a region (`[*]` read where it is). */
  states: Map<string, State>
  groups: ReadGroup[]
  /** Each composite's group, and its regions when it has them. */
  composites: Map<string, { group: number; regions: number[] }>
  transitions: Array<{ from: string; to: string; label: string[] }>
  notes: Note[]
}

interface Note {
  of: string
  side: 'left' | 'right'
  text: string[]
}

/** Where the reading is: the composite open, the region states go in. */
interface Scope {
  composite: string | null
  region: number
}

/** The machine `lines` write (the first is its header), or null when no state could be read. */
export function parseState(lines: readonly string[]) {
  if (!HEADER.test(lines[0] ?? '')) return null
  const read: Read = {
    direction: 'TD',
    states: new Map(),
    groups: [],
    composites: new Map(),
    transitions: [],
    notes: [],
  }
  const open: Scope[] = [{ composite: null, region: -1 }]
  let note: Note | null = null
  for (const line of lines.slice(1)) {
    if (note) {
      if (/^end\s*note$/i.test(line)) {
        if (read.notes.length < MOST_NODES) read.notes.push(note)
        note = null
      } else if (note.text.length < MOST_MEMBERS) note.text.push(...labelLines(line))
      continue
    }
    // Past the caps nothing more is read: the chart would be an outline, and the reading bounded.
    if (read.states.size >= MOST_NODES || read.transitions.length >= MOST_EDGES) break
    note = statement(line, read, open)
  }
  if (note && read.notes.length < MOST_NODES) read.notes.push(note)
  return build(read)
}

/** One line read into `read`; a note that runs on to `end note` is given back to be filled. */
function statement(line: string, read: Read, open: Scope[]): Note | null {
  const scope = open.at(-1)!
  const region = scope.region
  if (PASSED.test(line) || SKIPPED.test(line)) return null
  const turned = direction(line)
  if (turned) {
    // A direction inside a composite would turn only that frame: a layout in layers has one.
    if (open.length === 1) read.direction = turned
    return null
  }
  if (line === '}') {
    if (open.length > 1) open.pop()
    return null
  }
  if (/^-{2,}$/.test(line)) {
    if (scope.composite !== null) split(read, scope)
    return null
  }
  const transition = TRANSITION.exec(line)
  if (transition) {
    const from = key(read, transition[1]!, region, 'start')
    const to = key(read, transition[2]!, region, 'stop')
    read.transitions.push({ from, to, label: labelLines(transition[3] ?? '') })
    return null
  }
  const state = STATE.exec(line)
  if (state) {
    const id = state[2] ?? state[3]!
    const own = declare(read, id, region)
    const label = state[1] ?? state[4]
    if (label !== undefined) own.label = labelLines(label)
    const kind = (state[5] ?? state[6])?.toLowerCase()
    if (kind) {
      own.shape = kind === 'choice' ? 'choice' : 'bar'
      own.label = []
    }
    if (state[7]) describe(own, state[7])
    if (state[8] && read.groups.length < MOST_GROUPS && !read.composites.has(id)) {
      read.composites.set(id, { group: read.groups.length, regions: [] })
      read.groups.push({ title: own.label, parent: region, composite: id })
      open.push({ composite: id, region: read.groups.length - 1 })
    } else if (state[8])
      open.push({ composite: id, region: read.composites.get(id)?.group ?? region })
    return null
  }
  const noted = NOTE.exec(line)
  if (noted) {
    const of = noted[2]!
    const side = noted[1]!.toLowerCase() === 'left' ? 'left' : 'right'
    declare(read, of, region)
    if (noted[3] === undefined) return { of, side, text: [] }
    if (read.notes.length < MOST_NODES) read.notes.push({ of, side, text: labelLines(noted[3]) })
    return null
  }
  const described = DESCRIBED.exec(line)
  if (described) {
    describe(declare(read, described[1]!, region), described[2]!)
    return null
  }
  const bare = BARE.exec(line)
  if (bare) declare(read, bare[1]!, region)
  return null
}

/** The state named `id`, made in `group` when it is new. */
function declare(read: Read, id: string, group: number): State {
  const known = read.states.get(id)
  if (known) return known
  const own: State = { label: labelLines(id), descriptions: [], shape: 'round', group }
  read.states.set(id, own)
  return own
}

function describe(state: State, text: string): void {
  if (state.descriptions.length < MOST_MEMBERS) state.descriptions.push(...labelLines(text))
}

/** The key of an end: a state's name, or the start or the end of the region it is read in. */
function key(read: Read, end: string, region: number, which: 'start' | 'stop'): string {
  if (end !== '[*]') {
    declare(read, end, region)
    return end
  }
  const own = `[*]${which} ${region}`
  if (!read.states.has(own))
    read.states.set(own, { label: [], descriptions: [], shape: which, group: region })
  return own
}

/**
 * A `--` in a composite: at the first, what it holds so far is made its first region; each
 * `--` then opens the next. A region is an untitled frame inside the composite's.
 */
function split(read: Read, scope: Scope): void {
  const composite = read.composites.get(scope.composite!)
  if (!composite || read.groups.length + 2 > MOST_GROUPS) return
  const add = () => {
    read.groups.push({ title: [], parent: composite.group, composite: null })
    composite.regions.push(read.groups.length - 1)
    return read.groups.length - 1
  }
  if (composite.regions.length === 0) {
    const first = add()
    for (const state of read.states.values())
      if (state.group === composite.group) state.group = first
    read.groups.forEach((group, at) => {
      if (at !== first && group.parent === composite.group) group.parent = first
    })
  }
  scope.region = add()
}

/** The read machine as a chart: groups in an order where each comes after the one it is in. */
function build(read: Read) {
  const graph = new Graph()
  graph.chart.direction = read.direction
  const kids = read.groups.map((): number[] => [])
  const roots: number[] = []
  read.groups.forEach((group, at) =>
    group.parent >= 0 ? kids[group.parent]!.push(at) : roots.push(at),
  )
  // A composite that holds nothing is a state like another: a frame around nothing is not drawn.
  const filled = read.groups.map(() => false)
  for (const state of read.states.values())
    for (let at = state.group, depth = 0; at >= 0 && depth <= read.groups.length; depth++) {
      filled[at] = true
      at = read.groups[at]!.parent
    }
  const mapped = read.groups.map(() => -1)
  const visit = (at: number, parent: number) => {
    if (!filled[at]) return
    const composite = read.groups[at]!.composite
    const title = composite === null ? [] : (read.states.get(composite)?.label ?? [])
    mapped[at] = graph.group(title, parent)
    for (const kid of kids[at]!) visit(kid, mapped[at]!)
  }
  for (const root of roots) visit(root, -1)
  const group = (at: number): number => {
    for (let own = at, depth = 0; own >= 0 && depth <= read.groups.length; depth++) {
      if (mapped[own]! >= 0) return mapped[own]!
      own = read.groups[own]!.parent
    }
    return -1
  }
  const drawn = (id: string) => {
    const composite = read.composites.get(id)
    return !composite || !filled[composite.group]
  }
  for (const [id, state] of read.states) {
    if (!drawn(id)) continue
    const at = graph.node(id, group(state.group), state.label)
    if (at < 0) break
    const node = graph.chart.nodes[at]!
    node.shape = state.shape
    if (state.descriptions.length > 0) node.parts = [state.descriptions]
  }
  const ends = new Ends(read, graph, drawn)
  // A transition between composites of many regions is an edge for each pair: the reading stops
  // where the edges' cap does, not after every pair has been tried.
  for (const transition of read.transitions) {
    const froms = ends.at(transition.from, 'out')
    const tos = ends.at(transition.to, 'in')
    for (const from of froms)
      for (const to of tos) {
        if (graph.chart.edges.length >= MOST_EDGES) break
        graph.edge(from, to, { label: transition.label })
      }
    if (graph.chart.edges.length >= MOST_EDGES) break
  }
  read.notes.forEach((note, at) => {
    const of = ends.at(note.of, 'in')[0]
    if (note.text.length === 0 || of === undefined) return
    const own = graph.node(`[note] ${at}`, graph.chart.nodes[of]!.group, note.text)
    if (own < 0) return
    const node = graph.chart.nodes[own]!
    node.ink = 'dotted'
    const runs = graph.chart.direction
    if (runs === 'TD' || runs === 'BT') {
      node.beside = { node: of, after: note.side === 'right' }
      return
    }
    // Across, the side is a rank: the note's edge runs to it from what is before it.
    const after = (note.side === 'right') === (runs === 'LR')
    graph.edge(after ? of : own, after ? own : of, { ink: 'dotted', head: 'none' })
  })
  return graph.chart.nodes.length > 0 ? graph.chart : null
}

/**
 * The nodes an end of a transition is drawn at. A composite drawn as a frame is entered at the
 * start of each of its regions and left from the end of each, else at a state the region holds:
 * its first going in, and coming out its last that leads nowhere, else its last.
 */
class Ends {
  /** For each group as read, its start and its end, and the states it holds, in order. */
  private readonly marks = new Map<string, string>()
  private readonly inside = new Map<number, string[]>()
  private readonly sources = new Set<string>()

  constructor(
    private readonly read: Read,
    private readonly graph: Graph,
    private readonly drawn: (id: string) => boolean,
  ) {
    for (const [id, state] of read.states) {
      if (state.shape === 'start' || state.shape === 'stop')
        this.marks.set(`${state.shape} ${state.group}`, id)
      else {
        const own = this.inside.get(state.group)
        if (own) own.push(id)
        else this.inside.set(state.group, [id])
      }
    }
    for (const transition of read.transitions) this.sources.add(transition.from)
  }

  /** The walk into nested composites is bounded by how many groups there are. */
  at(id: string, side: 'in' | 'out', depth = 0): number[] {
    if (this.drawn(id)) {
      const own = this.graph.index(id)
      return own < 0 ? [] : [own]
    }
    if (depth > this.read.groups.length) return []
    const composite = this.read.composites.get(id)!
    const regions = composite.regions.length > 0 ? composite.regions : [composite.group]
    return regions.flatMap((region) => {
      const mark = this.marks.get(`${side === 'in' ? 'start' : 'stop'} ${region}`)
      if (mark) return this.at(mark, side, depth + 1)
      const inside = this.inside.get(region) ?? []
      const leaves = inside.filter((name) => !this.sources.has(name))
      const pick = side === 'in' ? inside[0] : (leaves.at(-1) ?? inside.at(-1))
      return pick === undefined ? [] : this.at(pick, side, depth + 1)
    })
  }
}
