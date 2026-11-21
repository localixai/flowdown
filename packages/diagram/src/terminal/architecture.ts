/**
 * Architecture diagrams (`architecture-beta`) as a picture: each service a box with its title, a
 * junction a dot `•`, a group a frame with its title, groups inside groups. Icons are names of
 * pictures a terminal does not have, and are left out.
 *
 * An edge names the side it leaves and the side it reaches (`db:R --> L:server`), and that is
 * where its ends are: the services are set on a grid by those sides, `a:R -- L:b` putting b in
 * the cell right of a's and `a:B -- T:b` in the one under it, and each edge is drawn from the
 * side it names to the side it names. When the sides cannot all be kept (a group whose cells
 * another service stands among, an edge that would run through a box), the chart is laid out in
 * layers as the other graphs are: across when most edges join sides left and right, down when
 * they join top and bottom.
 */
import { Canvas, type Point } from './canvas'
import { Graph, graphRows, MOST_EDGES, MOST_GROUPS, PASSED, unquoted } from './graph'
import { within } from './kit'
import type { DiagramKind } from './kind'
import { MOST_ROWS } from './outline'
import type { FlowEdge, Flowchart, Head } from './parse'
import { boxSize, drawBox } from './shapes'
import { labelLines, wrapLines } from './text'
import { BOLD, CODE, DIM, WAITING, type Line } from '../style'
import { width } from '../width'

const HEADER = /^architecture(?:-beta)?\b\s*;?$/i
const ID = String.raw`[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*`
const IN = String.raw`(?:\s+in\s+(${ID}))?`
const GROUP = new RegExp(
  String.raw`^group\s+(${ID})\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?${IN}\s*;?$`,
  'u',
)
const SERVICE = new RegExp(
  String.raw`^service\s+(${ID})\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?${IN}\s*;?$`,
  'u',
)
const JUNCTION = new RegExp(String.raw`^junction\s+(${ID})${IN}\s*;?$`, 'u')
const SIDE = '([LRTB])'
const EDGE = new RegExp(
  String.raw`^(${ID})(\{group\})?\s*:\s*${SIDE}\s*(<)?-(?:\[([^\]]*)\])?-(>)?\s*${SIDE}\s*:\s*(${ID})(\{group\})?\s*;?$`,
  'u',
)

export const architectureDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => {
    const read = parseArchitecture(lines)
    if (!read || !(columns >= 2)) return null
    return gridRows(read.chart, read.links, Math.floor(columns)) ?? graphRows(read.chart, columns)
  },
}

type Side = 'L' | 'R' | 'T' | 'B'

/** An edge between two nodes of the chart, with the sides it joins. */
interface Link {
  from: number
  to: number
  fromSide: Side
  toSide: Side
  tail: Head
  head: Head
  label: string[]
}

interface Edge {
  from: string
  to: string
  fromSide: string
  toSide: string
  fromGroup: boolean
  toGroup: boolean
  tail: Head
  head: Head
  label: string[]
}

/**
 * The groups, services, junctions and edges `lines` write, as a chart laid out in layers and as
 * the links the grid places by; null when none could be read.
 */
export function parseArchitecture(lines: readonly string[]) {
  if (!HEADER.test(lines[0] ?? '')) return null
  const graph = new Graph()
  const groups = new Map<string, number>()
  // Each group's first service: an edge to a group (`{group}`) is drawn to it.
  const firsts = new Map<string, string>()
  const edges: Edge[] = []
  const place = (id: string, parent: string | undefined, label: string[]) => {
    const group = parent === undefined ? -1 : (groups.get(parent) ?? -1)
    const at = graph.node(id, group, label)
    if (at >= 0) graph.chart.nodes[at]!.group = group
    if (parent !== undefined && !firsts.has(parent)) firsts.set(parent, id)
    return at
  }
  for (const line of lines.slice(1)) {
    if (PASSED.test(line)) continue
    const group = GROUP.exec(line)
    if (group) {
      if (groups.has(group[1]!) || graph.chart.groups.length >= MOST_GROUPS) continue
      const parent = group[4] === undefined ? -1 : (groups.get(group[4]) ?? -1)
      const title = labelLines(unquoted(group[3] ?? group[1]!))
      groups.set(group[1]!, graph.group(title, parent))
      continue
    }
    const service = SERVICE.exec(line)
    if (service) {
      place(service[1]!, service[4], labelLines(unquoted(service[3] ?? service[1]!)))
      continue
    }
    const junction = JUNCTION.exec(line)
    if (junction) {
      const at = place(junction[1]!, junction[2], [])
      if (at >= 0) graph.chart.nodes[at]!.shape = 'dot'
      continue
    }
    const edge = EDGE.exec(line)
    if (edge && edges.length < MOST_EDGES)
      edges.push({
        from: edge[1]!,
        fromGroup: Boolean(edge[2]),
        fromSide: edge[3]!,
        tail: edge[4] ? 'arrow' : 'none',
        label: labelLines(unquoted(edge[5] ?? '')),
        head: edge[6] ? 'arrow' : 'none',
        toSide: edge[7]!,
        to: edge[8]!,
        toGroup: Boolean(edge[9]),
      })
  }
  // An empty group's box is named as the group, so that an edge to it (`{group}`) reaches it.
  const ids: string[] = []
  for (const [id, at] of groups) if (at >= 0) ids[at] = id
  graph.holdEmpty(ids)
  const across = edges.filter((edge) => 'LR'.includes(edge.fromSide)).length
  graph.chart.direction = across * 2 > edges.length ? 'LR' : 'TD'
  const links: Link[] = []
  for (const edge of edges) {
    const from = end(graph, firsts, edge.from, edge.fromGroup)
    const to = end(graph, firsts, edge.to, edge.toGroup)
    if (from >= 0 && to >= 0)
      links.push({
        from,
        to,
        fromSide: edge.fromSide as Side,
        toSide: edge.toSide as Side,
        tail: edge.tail,
        head: edge.head,
        label: edge.label,
      })
    // The end whose side faces the way the chart runs comes first: `a:R -- L:b` puts a left of
    // b, `a:L -- R:b` puts it right.
    const forward = graph.chart.direction === 'LR' ? edge.fromSide !== 'L' : edge.fromSide !== 'T'
    const fields: Partial<FlowEdge> = {
      label: edge.label,
      head: forward ? edge.head : edge.tail,
      tail: forward ? edge.tail : edge.head,
    }
    if (forward) graph.edge(from, to, fields)
    else graph.edge(to, from, fields)
  }
  return graph.chart.nodes.length > 0 ? { chart: graph.chart, links } : null
}

/** The node an end of an edge names: a service, a junction, or a group's first service. */
function end(graph: Graph, firsts: Map<string, string>, id: string, group: boolean): number {
  const own = group ? (firsts.get(id) ?? id) : id
  const at = graph.index(own)
  return at >= 0 ? at : graph.node(own)
}

// --- The grid ---

/** Past this many nodes the grid is not tried: the layers lay out a big chart better. */
const MOST_PLACED = 200
/** The widths a service's title is wrapped at, tried in turn. */
const GRID_WIDTHS = [20, 12]
/** The columns a frame takes on each side, its border and a space; down, a row for its border. */
const FRAME_COLUMNS = 2

const STEPS: Record<Side, Point> = { L: [-1, 0], R: [1, 0], T: [0, -1], B: [0, 1] }
const across = (side: Side): boolean => side === 'L' || side === 'R'
const TIPS: Record<Side, string> = { L: '◀', R: '▶', T: '▲', B: '▼' }

/**
 * Where an edge puts its far end from its near one, a cell each way at most: away through the
 * side it leaves, and toward the side it reaches. Two sides that face one way (`a:R -- R:b`) say
 * nothing of where b is but that it is not in a's line: it is put beside, the edge going round.
 */
function offset(link: Link): Point {
  const [x0, y0] = STEPS[link.fromSide]
  const [x1, y1] = STEPS[link.toSide]
  const x = Math.sign(x0 - x1)
  const y = Math.sign(y0 - y1)
  if (x !== 0 || y !== 0) return [x, y]
  return across(link.fromSide) ? [0, 1] : [1, 0]
}

/**
 * Each node's cell, walked from each node not yet placed through the edges it has, in the order
 * they were written. A cell already taken is given up for the nearest free one beside it, across
 * the way the edge goes; a node with no edge to what is placed starts beside the members of its
 * group, else to the right of all. Every step is bounded by the nodes: there is always a free
 * cell within that many.
 */
function cells(chart: Flowchart, links: readonly Link[]): Point[] {
  const count = chart.nodes.length
  const near = chart.nodes.map((): Array<[node: number, step: Point]> => [])
  for (const link of links) {
    if (link.from === link.to) continue
    const [x, y] = offset(link)
    near[link.from]!.push([link.to, [x, y]])
    near[link.to]!.push([link.from, [-x, -y]])
  }
  const at: Array<Point | null> = chart.nodes.map(() => null)
  const taken = new Set<string>()
  const take = (node: number, cell: Point) => {
    at[node] = cell
    taken.add(`${cell[0]},${cell[1]}`)
  }
  const free = ([x, y]: Point, [dx, dy]: Point): Point => {
    const [px, py] = dx !== 0 && dy === 0 ? [0, 1] : [1, 0]
    for (let k = 0; k <= count; k++)
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const cell: Point = [x + sign * k * px, y + sign * k * py]
        if (!taken.has(`${cell[0]},${cell[1]}`)) return cell
      }
    return [x + count + 1, y]
  }
  let right = -1
  for (let root = 0; root < count; root++) {
    if (at[root]) continue
    const group = chart.nodes[root]!.group
    const kin = chart.nodes.flatMap((node, own) =>
      group >= 0 && node.group === group && at[own] ? [at[own]!] : [],
    )
    const start: Point =
      kin.length > 0
        ? kin.reduce((most, cell) => (cell[0] > most[0] ? cell : most))
        : [right + 1, 0]
    take(root, kin.length > 0 ? free([start[0] + 1, start[1]], [1, 0]) : start)
    const queue = [root]
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head]!
      for (const [to, step] of near[from]!) {
        if (at[to]) continue
        const [x, y] = at[from]!
        take(to, free([x + step[0], y + step[1]], step))
        queue.push(to)
      }
    }
    for (const cell of at) if (cell) right = Math.max(right, cell[0])
  }
  return at.map((cell) => cell!)
}

/** A group's cells, from its first column and row to its last, and how deep it is. */
interface Span {
  group: number
  depth: number
  c0: number
  c1: number
  r0: number
  r1: number
}

/**
 * Each group's span of cells, inner groups in theirs; null when a span holds a node not in the
 * group, or two spans overlap without one holding the other: no frame could be drawn round it.
 */
function spans(chart: Flowchart, column: number[], row: number[]): Span[] | null {
  const groups = chart.groups
  const depth = groups.map(() => 0)
  groups.forEach((group, at) => {
    depth[at] = group.parent >= 0 && group.parent < at ? depth[group.parent]! + 1 : 0
  })
  const inside = (node: number, group: number) => {
    for (let own = chart.nodes[node]!.group, step = 0; own >= 0 && step <= groups.length; step++) {
      if (own === group) return true
      own = groups[own]!.parent
    }
    return false
  }
  const out: Span[] = []
  groups.forEach((_, group) => {
    const held = chart.nodes.flatMap((__, node) => (inside(node, group) ? [node] : []))
    if (held.length === 0) return
    const columns = held.map((node) => column[node]!)
    const rows = held.map((node) => row[node]!)
    out.push({
      group,
      depth: depth[group]!,
      c0: Math.min(...columns),
      c1: Math.max(...columns),
      r0: Math.min(...rows),
      r1: Math.max(...rows),
    })
  })
  for (const own of out) {
    const foreign = chart.nodes.some(
      (_, node) =>
        !inside(node, own.group) &&
        column[node]! >= own.c0 &&
        column[node]! <= own.c1 &&
        row[node]! >= own.r0 &&
        row[node]! <= own.r1,
    )
    if (foreign) return null
    for (const other of out) {
      if (other === own) continue
      const apart = other.c0 > own.c1 || other.c1 < own.c0 || other.r0 > own.r1 || other.r1 < own.r0
      const holds =
        own.c0 <= other.c0 && other.c1 <= own.c1 && own.r0 <= other.r0 && other.r1 <= own.r1
      const held =
        other.c0 <= own.c0 && own.c1 <= other.c1 && other.r0 <= own.r0 && own.r1 <= other.r1
      if (!apart && !holds && !held) return null
    }
  }
  return out
}

/** The bands between cells along one axis: what each holds, and where everything starts. */
interface Axis {
  /** Where each cell starts, and its size. */
  start: number[]
  size: number[]
  /** For each band (before cell k; the last after all), where its lane's middle is. */
  lane: number[]
  /** For each frame, where its border is before its cells and after them. */
  low: Map<number, number>
  high: Map<number, number>
  length: number
}

/** For each band between cells on one axis (the first before all, the last after), its size. */
interface Bands {
  size: number[]
  /** How far into its lane an edge turns. */
  turn: number[]
}

/**
 * One axis laid out: in each band, the borders of the frames that end before it (inner first),
 * then a lane where edges turn, then the borders of the frames that start after it (outer first).
 * A border takes `border` cells, and `margin` more on the side of the frame's cells it is asked.
 */
function axisOf(
  sizes: number[],
  frames: Span[],
  first: (span: Span) => number,
  last: (span: Span) => number,
  border: number,
  bands: Bands,
  margin: (span: Span, side: 'low' | 'high') => number = () => 0,
): Axis {
  const count = sizes.length
  const axis: Axis = {
    start: [],
    size: sizes,
    lane: [],
    low: new Map(),
    high: new Map(),
    length: 0,
  }
  let at = 0
  for (let band = 0; band <= count; band++) {
    const closing = frames
      .filter((one) => last(one) === band - 1)
      .toSorted((a, b) => b.depth - a.depth)
    const opening = frames
      .filter((one) => first(one) === band)
      .toSorted((a, b) => a.depth - b.depth)
    for (const one of closing) {
      at += margin(one, 'high') + border
      axis.high.set(one.group, at - 1)
    }
    axis.lane.push(at + bands.turn[band]!)
    at += bands.size[band]!
    for (const one of opening) {
      axis.low.set(one.group, at)
      at += border + margin(one, 'low')
    }
    if (band < count) {
      axis.start.push(at)
      at += sizes[band]!
    }
  }
  axis.length = at
  return axis
}

/**
 * What each band on one axis needs from the edges that run along it (`flat`: across): a cell for
 * a line at the least, one for each tip beside the boxes it joins, one where it turns, and across,
 * room for its label on its line. A band no edge needs is a cell between two cells, and nothing
 * at either end of the axis. `cell` is each node's cell on this axis, `other` on the other: two in
 * one row (or column) are in line, every box's middle at its cell's, and run straight.
 */
function bandsOf(
  links: readonly Link[],
  flat: boolean,
  cell: number[],
  other: number[],
  count: number,
): Bands {
  const size = Array.from({ length: count + 1 }, (_, band): number =>
    band === 0 || band === count ? 0 : 1,
  )
  const low = size.map(() => false)
  const high = size.map(() => false)
  const turning = size.map(() => false)
  for (const link of links) {
    if (across(link.fromSide) !== flat || across(link.toSide) !== flat) continue
    const own = cell[link.from]!
    const far = cell[link.to]!
    const step = flat ? STEPS[link.fromSide][0] : STEPS[link.fromSide][1]
    const facing = link.fromSide === opposite(link.toSide)
    const head = link.head === 'arrow'
    const tail = link.tail === 'arrow'
    if (facing && Math.sign(far - own) !== step) continue
    const inLine = other[link.from] === other[link.to]
    const label = flat ? width(link.label.join(' ')) : 0
    if (facing && inLine) {
      const near = own + (step > 0 ? 1 : 0)
      const last = far + (step > 0 ? 0 : 1)
      if (near === last) {
        const tips = Number(head) + Number(tail) + (head && tail ? 1 : 0)
        size[near] = Math.max(size[near]!, tips, label > 0 ? label + 4 : 1)
      } else {
        size[near] = Math.max(size[near]!, 1, Number(tail))
        size[last] = Math.max(size[last]!, 1, Number(head))
      }
      continue
    }
    // A turn, with each tip on the side of it the line reaches its box from.
    const band = facing
      ? own + (step > 0 ? 1 : 0)
      : step > 0
        ? Math.max(own, far) + 1
        : Math.min(own, far)
    turning[band] = true
    const before = facing ? (step > 0 ? tail : head) : step > 0 && (head || tail)
    const after = facing ? (step > 0 ? head : tail) : step < 0 && (head || tail)
    low[band] ||= before
    high[band] ||= after
  }
  const turn = size.map((_, band) => (low[band] ? 1 : 0))
  turning.forEach((own, band) => {
    if (own) size[band] = Math.max(size[band]!, 1 + Number(low[band]) + Number(high[band]))
  })
  return { size, turn }
}

/** The chart on the grid its edges' sides make, when one fits the columns; else null. */
function gridRows(chart: Flowchart, links: readonly Link[], columns: number): Line[] | null {
  if (chart.nodes.length > MOST_PLACED || links.some((link) => link.from === link.to)) return null
  const placed = cells(chart, links)
  // The cells made dense: a column or a row nothing is in takes no room.
  const dense = (values: number[]) => {
    const sorted = [...new Set(values)].toSorted((a, b) => a - b)
    const index = new Map(sorted.map((value, at) => [value, at]))
    return { of: values.map((value) => index.get(value)!), count: sorted.length }
  }
  const xs = dense(placed.map((cell) => cell[0]))
  const ys = dense(placed.map((cell) => cell[1]))
  const frames = spans(chart, xs.of, ys.of)
  if (!frames) return null
  for (const wrapAt of GRID_WIDTHS) {
    const drawn = gridPicture(chart, links, frames, xs, ys, wrapAt, columns)
    const fits = drawn && within(drawn, columns)
    if (fits) return fits
  }
  return null
}

type Dense = { of: number[]; count: number }

function gridPicture(
  chart: Flowchart,
  links: readonly Link[],
  frames: Span[],
  xs: Dense,
  ys: Dense,
  wrapAt: number,
  columns: number,
): Line[] | null {
  const labels = chart.nodes.map((node) => wrapLines(node.label, wrapAt))
  const boxes = chart.nodes.map((node, at) => boxSize(node.shape, labels[at]!))
  const widths = Array.from({ length: xs.count }, () => 1)
  const heights = Array.from({ length: ys.count }, () => 1)
  boxes.forEach((box, at) => {
    widths[xs.of[at]!] = Math.max(widths[xs.of[at]!]!, box.width)
    heights[ys.of[at]!] = Math.max(heights[ys.of[at]!]!, box.height)
  })
  const xBands = bandsOf(links, true, xs.of, ys.of, xs.count)
  const columnsOf = () =>
    axisOf(
      widths,
      frames,
      (one) => one.c0,
      (one) => one.c1,
      FRAME_COLUMNS,
      xBands,
    )
  // A frame is as wide as its title: its last column is made wider, inner frames first.
  const titles = chart.groups.map((group) => width(group.title.join(' ')))
  let x = columnsOf()
  for (const frame of frames.toSorted((a, b) => b.depth - a.depth)) {
    const have = x.high.get(frame.group)! - x.low.get(frame.group)! + 1
    const need = titles[frame.group]! + 4
    if (have >= need) continue
    widths[frame.c1]! += need - have
    x = columnsOf()
  }
  const yBands = bandsOf(links, false, ys.of, xs.of, ys.count)
  // Down, a border is one row and no margin, but a tip by a box at a frame's edge would be drawn
  // on its border: that frame is given a row of margin there.
  const roomy = new Set<string>()
  for (const link of links)
    for (const [node, side, tip] of [
      [link.from, link.fromSide, link.tail],
      [link.to, link.toSide, link.head],
    ] as const) {
      if (tip !== 'arrow' || across(side)) continue
      const row = ys.of[node]!
      const column = xs.of[node]!
      const inner = frames
        .filter(
          (one) =>
            one.c0 <= column &&
            column <= one.c1 &&
            one.r0 <= row &&
            row <= one.r1 &&
            (side === 'B' ? one.r1 === row : one.r0 === row),
        )
        .toSorted((a, b) => b.depth - a.depth)[0]
      if (inner) roomy.add(`${inner.group} ${side === 'B' ? 'high' : 'low'}`)
    }
  const y = axisOf(
    heights,
    frames,
    (one) => one.r0,
    (one) => one.r1,
    1,
    yBands,
    (one, side) => (roomy.has(`${one.group} ${side}`) ? 1 : 0),
  )
  if (x.length > columns || y.length > MOST_ROWS) return null
  const rects = boxes.map((box, at) => {
    const column = xs.of[at]!
    const row = ys.of[at]!
    // Each box's middle at its cell's: the boxes of a column, or of a row, are in line.
    return {
      x: x.start[column]! + Math.floor(widths[column]! / 2) - Math.floor(box.width / 2),
      y: y.start[row]! + Math.floor(heights[row]! / 2) - Math.floor(box.height / 2),
      w: box.width,
      h: box.height,
    }
  })
  const routes = links.map((link) => routeOf(link, rects, xs, ys, x, y))
  if (routes.some((route) => route === null)) return null
  // Room past the last column for a label beside a line down: rows end where they hold nothing.
  const labelled = links.reduce((most, link) => Math.max(most, width(link.label.join(' '))), 0)
  const wide = Math.min(columns, x.length + (labelled > 0 ? labelled + 3 : 0))
  const canvas = new Canvas(wide, y.length)
  const grid = new Cells(wide, y.length)
  rects.forEach((rect, at) => grid.box(rect, at))
  for (const frame of frames) {
    const left = x.low.get(frame.group)!
    const top = y.low.get(frame.group)!
    const w = x.high.get(frame.group)! - left + 1
    const h = y.high.get(frame.group)! - top + 1
    canvas.rect(left, top, w, h, 'solid', DIM, false)
  }
  chart.nodes.forEach((node, at) => {
    const rect = rects[at]!
    drawBox(
      canvas,
      rect.x,
      rect.y,
      { width: rect.w, height: rect.h },
      node.shape,
      labels[at]!,
      CODE,
      [],
      node.ink,
    )
  })
  const ports = links.map((link) => [`${link.from}${link.fromSide}`, `${link.to}${link.toSide}`])
  for (const [at, route] of routes.entries()) if (!grid.line(route!, at, ports)) return null
  for (const [at, link] of links.entries()) {
    const route = routes[at]!
    // A tip is in the cell beside the box it points at, and the line stops at it: the box's
    // border is not joined where an arrow touches it.
    const head = link.head === 'arrow' ? beside(route.at(-1)!, route.at(-2)!) : null
    const tail = link.tail === 'arrow' ? beside(route[0]!, route[1]!) : null
    canvas.stroke([tail ?? route[0]!, ...route.slice(1, -1), head ?? route.at(-1)!], 'solid', DIM)
    if (head) canvas.text(...head, TIPS[opposite(link.toSide)], DIM)
    if (tail) canvas.text(...tail, TIPS[opposite(link.fromSide)], DIM)
    if (link.label.length > 0 && !writeLabel(canvas, grid, route, at, link.label.join(' ')))
      return null
  }
  for (const frame of frames) {
    const title = chart.groups[frame.group]!.title.join(' ')
    if (!title) continue
    const left = x.low.get(frame.group)!
    const top = y.low.get(frame.group)!
    const right = x.high.get(frame.group)!
    const own = width(title) + 2
    let spot = -1
    for (let from = left + 1; from + own < right && spot < 0; from++)
      if (canvas.across(from, top, own)) spot = from
    if (spot < 0) return null
    canvas.text(spot, top, ` ${title} `, BOLD)
  }
  return canvas.rows()
}

const opposite = (side: Side): Side =>
  side === 'L' ? 'R' : side === 'R' ? 'L' : side === 'T' ? 'B' : 'T'

/** The cell one step from `from` toward `toward`. */
const beside = (from: Point, toward: Point): [number, number] => [
  from[0] + Math.sign(toward[0] - from[0]),
  from[1] + Math.sign(toward[1] - from[1]),
]

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Where an edge leaves or reaches a box: the middle of the side it names. */
function portOf(rect: Rect, side: Side): Point {
  const middle: Point = [rect.x + Math.floor(rect.w / 2), rect.y + Math.floor(rect.h / 2)]
  if (side === 'L') return [rect.x, middle[1]]
  if (side === 'R') return [rect.x + rect.w - 1, middle[1]]
  if (side === 'T') return [middle[0], rect.y]
  return [middle[0], rect.y + rect.h - 1]
}

/**
 * The points of an edge from the side it leaves to the side it reaches: straight when the two are
 * in line, else turning once in the band between them, or once at the corner where its two
 * sides' lines meet. Null when its sides cannot be kept so: the cells were taken another way.
 */
function routeOf(
  link: Link,
  rects: Rect[],
  xs: Dense,
  ys: Dense,
  x: Axis,
  y: Axis,
): Point[] | null {
  const p = portOf(rects[link.from]!, link.fromSide)
  const q = portOf(rects[link.to]!, link.toSide)
  const [dx, dy] = STEPS[link.fromSide]
  const [ex, ey] = STEPS[link.toSide]
  const ahead = (from: number, to: number, step: number) => Math.sign(to - from) === step
  if (across(link.fromSide) === across(link.toSide)) {
    const flat = across(link.fromSide)
    const [own, far] = flat
      ? [xs.of[link.from]!, xs.of[link.to]!]
      : [ys.of[link.from]!, ys.of[link.to]!]
    const step = flat ? dx : dy
    const facing = link.fromSide === opposite(link.toSide)
    // Facing sides need the far end ahead; sides that face one way go round past both.
    if (facing && !ahead(own, far, step)) return null
    const band = facing
      ? own + (step > 0 ? 1 : 0)
      : step > 0
        ? Math.max(own, far) + 1
        : Math.min(own, far)
    if (flat) {
      if (facing && p[1] === q[1]) return [p, q]
      const turn = x.lane[band]!
      return [p, [turn, p[1]], [turn, q[1]], q]
    }
    if (facing && p[0] === q[0]) return [p, q]
    const turn = y.lane[band]!
    return [p, [p[0], turn], [q[0], turn], q]
  }
  // One side across and one up or down: the corner is where the two sides' lines meet.
  const corner: Point = across(link.fromSide) ? [q[0], p[1]] : [p[0], q[1]]
  const out = across(link.fromSide) ? ahead(p[0], q[0], dx) : ahead(p[1], q[1], dy)
  const into = across(link.toSide) ? ahead(q[0], p[0], ex) : ahead(q[1], p[1], ey)
  return out && into ? [p, corner, q] : null
}

/**
 * The cells of the picture, kept to check what is drawn before it is: no line through a box, and
 * no two lines along one stretch unless they share an end, when they read as one that branches.
 */
class Cells {
  private readonly w: number
  private readonly boxes: Int32Array
  /** For each cell and each axis, the edge that runs along it there, plus one. */
  private readonly runs: [Int32Array, Int32Array]

  constructor(w: number, h: number) {
    this.w = w
    this.boxes = new Int32Array(w * h)
    this.runs = [new Int32Array(w * h), new Int32Array(w * h)]
  }

  box(rect: Rect, at: number): void {
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) this.boxes[y * this.w + x] = at + 1
  }

  /** `route` taken for edge `at`; false when it runs through a box or along another edge. */
  line(route: Point[], at: number, ports: string[][]): boolean {
    const last = route.length - 1
    for (let leg = 1; leg <= last; leg++) {
      const [x0, y0] = route[leg - 1]!
      const [x1, y1] = route[leg]!
      const axis = y0 === y1 ? 0 : 1
      const sx = Math.sign(x1 - x0)
      const sy = Math.sign(y1 - y0)
      const length = Math.abs(x1 - x0) + Math.abs(y1 - y0)
      for (let step = 0; step <= length; step++) {
        const x = x0 + sx * step
        const y = y0 + sy * step
        // An end is a box's border, where any number of edges may meet it.
        if ((leg === 1 && step === 0) || (leg === last && step === length)) continue
        const cell = y * this.w + x
        if (this.boxes[cell]) return false
        const other = this.runs[axis][cell]! - 1
        if (other >= 0 && other !== at && !ports[at]!.some((port) => ports[other]!.includes(port)))
          return false
        this.runs[axis][cell] = at + 1
      }
    }
    return true
  }

  /** Whether the cells from (x, y) for `w` columns hold nothing at all. */
  empty(x: number, y: number, w: number): boolean {
    for (let own = x; own < x + w; own++) {
      const cell = y * this.w + own
      if (own < 0 || own >= this.w || this.boxes[cell] || this.runs[0][cell] || this.runs[1][cell])
        return false
    }
    return true
  }

  /** Whether edge `at` alone runs across the cells from (x, y) for `w` columns. */
  alone(x: number, y: number, w: number, at: number): boolean {
    for (let own = x; own < x + w; own++) {
      const cell = y * this.w + own
      if (this.runs[0][cell] !== at + 1 || this.runs[1][cell]) return false
    }
    return true
  }
}

/**
 * An edge's label on the longest run of its line across that it has alone, with a cell of line
 * on each side; else beside its longest run down, where nothing is. False when it fits neither.
 */
function writeLabel(
  canvas: Canvas,
  grid: Cells,
  route: Point[],
  edge: number,
  label: string,
): boolean {
  const own = width(label)
  const legs = route.slice(1).map((to, at) => [route[at]!, to] as const)
  const flat = legs
    .filter(([a, b]) => a[1] === b[1])
    .toSorted((a, b) => Math.abs(b[1][0] - b[0][0]) - Math.abs(a[1][0] - a[0][0]))
  for (const [a, b] of flat) {
    const low = Math.min(a[0], b[0])
    const high = Math.max(a[0], b[0])
    // The cells of the run but its two ends and the cell by each, where a tip may be.
    const room = high - low - 3
    if (room < own) continue
    const from = low + 2 + Math.floor((room - own) / 2)
    if (!grid.alone(from, a[1], own, edge)) continue
    canvas.text(from, a[1], label, WAITING)
    return true
  }
  for (const [a, b] of legs.filter(([one, two]) => one[0] === two[0])) {
    const row = Math.floor((a[1] + b[1]) / 2)
    if (Math.abs(b[1] - a[1]) < 2 || !grid.empty(a[0] + 2, row, own + 1)) continue
    canvas.text(a[0] + 2, row, label, WAITING)
    return true
  }
  return false
}
