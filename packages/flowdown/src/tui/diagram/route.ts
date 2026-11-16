/**
 * The gaps between ranks, and the edges drawn through them.
 *
 * An edge leaves the middle of its box's lower border and reaches the middle of the next one's
 * upper border. Between two ranks it runs straight when the two are in line, and otherwise turns
 * into a lane of its own, a row of the gap, runs across, and turns down again. A lane is shared
 * only by edges out of one box, which then read as one line that branches, or by edges into one,
 * which read as one that gathers.
 *
 * Two edges never run along one stretch of a column: where one edge leaves from a column another
 * arrives at, the one leaving takes the higher lane, so its line ends before the other's starts.
 * Edges that only cross, cross (`┼`). Every gap keeps its last row for arrowheads, so an arrow
 * always touches the box it points at.
 *
 * A chart may ask for its edges apart (`Flowchart.apart`): each then meets its box at a column of
 * its own, in the order of where it goes, and what is written at its ends (a multiplicity, a
 * crow's foot) is given a row of the gap, by the box, where every line runs straight.
 */
import type { Canvas, Point } from './canvas'
import { port, type Item, type Layout } from './layout'
import type { Flowchart, Head, Mark } from './parse'
import { DIM, WAITING } from '../style'
import { width } from '../width'

/** A route's step from one rank to the next. */
export interface Hop {
  route: number
  from: number
  to: number
  /** Its ports across, in the upper rank and the lower. */
  start: number
  end: number
  /** The lane it turns in, or -1 when it runs straight. */
  lane: number
}

export interface Gaps {
  /** For each route, its hops from the top down. */
  hops: Hop[][]
  /** For each gap below a rank, the lanes it needs. */
  lanes: number[]
}

/** Where each rank, each gap's lanes and each frame's borders are along. */
export interface Along {
  start: number[]
  size: number[]
  lane: number[]
  top: Map<number, number>
  bottom: Map<number, number>
  length: number
  /** For each rank, where the labels at the upper ends of its edges down start along, and at the lower ends of the edges into it: -1 when it has none. */
  tails: number[]
  heads: number[]
}

/** How the two axes are laid on the screen. */
export interface Axes {
  vertical: boolean
  /** Whether along runs up or to the left: BT and RL. */
  flip: boolean
  length: number
}

export const real = (axes: Axes, along: number, across: number): Point => {
  const own = axes.flip ? axes.length - 1 - along : along
  return axes.vertical ? [across, own] : [own, across]
}

/** The ends of `route`'s edge, from its upper end and at its lower one. */
export function ends(chart: Flowchart, layout: Layout, route: number): [Head, Head] {
  const own = layout.routes[route]!
  const edge = chart.edges[own.edge]!
  return own.turned ? [edge.head, edge.tail] : [edge.tail, edge.head]
}

/** The marks at `route`'s upper end and its lower one. */
function marks(
  chart: Flowchart,
  layout: Layout,
  route: number,
): [Mark | undefined, Mark | undefined] {
  const own = layout.routes[route]!
  const edge = chart.edges[own.edge]!
  return own.turned ? [edge.marks?.head, edge.marks?.tail] : [edge.marks?.tail, edge.marks?.head]
}

/** What is written at `route`'s upper end and its lower one: '' for nothing. */
function endLabels(chart: Flowchart, layout: Layout, route: number): [string, string] {
  const own = layout.routes[route]!
  const edge = chart.edges[own.edge]!
  const [upper, lower] = own.turned
    ? [edge.ends?.head, edge.ends?.tail]
    : [edge.ends?.tail, edge.ends?.head]
  return [upper ?? '', lower ?? '']
}

/** Every route's hops, and the lanes of every gap. */
export function laneHops(layout: Layout, apart = false): Gaps {
  const byGap = layout.ranks.map((): Hop[] => [])
  const hops = layout.routes.map((route, at) => {
    const own: Hop[] = []
    const last = route.items.length - 1
    for (let step = 1; step <= last; step++) {
      const from = layout.items[route.items[step - 1]!]!
      const to = layout.items[route.items[step]!]!
      const turned = route.turned && !apart
      const hop = {
        route: at,
        from: route.items[step - 1]!,
        to: route.items[step]!,
        start: port(from) + (turned && step === 1 ? aside(from, port(to)) : 0),
        end: port(to) + (turned && step === last ? aside(to, port(from)) : 0),
        lane: -1,
      }
      own.push(hop)
      byGap[from.rank]!.push(hop)
    }
    return own
  })
  if (apart) spread(layout, hops)
  return { hops, lanes: byGap.map(assign) }
}

/**
 * Each node's edges given ports of their own, `step` apart and centred on its middle, in the
 * order of the ports at their other ends: edges that leave side by side do not cross at the box.
 * The box was made wide enough for them (`layout.ts`).
 */
function spread(layout: Layout, hops: Hop[][]): void {
  const outs = new Map<number, Hop[]>()
  const ins = new Map<number, Hop[]>()
  for (const own of hops) {
    const first = own[0]!
    const last = own.at(-1)!
    if (layout.items[first.from]!.node >= 0) push(outs, first.from, first)
    if (layout.items[last.to]!.node >= 0) push(ins, last.to, last)
  }
  const place = (
    side: Map<number, Hop[]>,
    far: (hop: Hop) => number,
    set: (hop: Hop, column: number) => void,
  ) => {
    for (const [at, own] of side) {
      const item = layout.items[at]!
      if (own.length < 2 || item.box.across < 3) continue
      own.sort((a, b) => far(a) - far(b) || a.route - b.route)
      // Centred on the border between its corners: on a box four rows high, the two rows inside.
      const low = item.at + 1
      const high = item.at + item.box.across - 2
      const first = Math.round((low + high - (own.length - 1) * item.step) / 2)
      own.forEach((hop, index) => {
        set(hop, Math.min(high, Math.max(low, first + index * item.step)))
      })
    }
  }
  place(
    outs,
    (hop) => port(layout.items[hop.to]!),
    (hop, column) => {
      hop.start = column
    },
  )
  place(
    ins,
    (hop) => port(layout.items[hop.from]!),
    (hop, column) => {
      hop.end = column
    },
  )
  // A route's first hop and its last may be one: its start is set by its box above, its end by
  // the one below. Its points between keep their columns.
}

function push(map: Map<number, Hop[]>, key: number, hop: Hop): void {
  const own = map.get(key)
  if (own) own.push(hop)
  else map.set(key, [hop])
}

/**
 * Where an edge turned around to close a cycle meets a box: a column beside the middle, toward
 * the edge's other end, so that it is not read as part of the edges the box sends on. A point
 * has no column to spare, and gives it the middle.
 */
function aside(item: Item, toward: number): number {
  if (item.node < 0) return 0
  const own = port(item)
  const ahead = toward < own ? -1 : 1
  // Inside the border's corners, toward the other end when there is room on that side.
  return (
    [ahead, -ahead].find(
      (step) => own + step > item.at && own + step < item.at + item.box.across - 1,
    ) ?? 0
  )
}

/** A hop's stretch of a lane, with the port it leaves from and the one it goes to. */
interface Run {
  low: number
  high: number
  from: string
  to: string
}

/**
 * Whether `run` may go in `lane`: the runs it would touch, and those they touch in turn, must all
 * leave from one port or all go to one, so that a lane shared reads as one line that branches
 * (`╭──┴──╮`) or one that gathers (`╰──┬──╯`), never as edges joined that are not.
 */
function fits(lane: Run[], run: Run): boolean {
  const joined = [run]
  const seen = new Set<Run>()
  for (let at = 0; at < joined.length; at++) {
    const one = joined[at]!
    for (const other of lane)
      if (!seen.has(other) && one.low <= other.high + 1 && other.low <= one.high + 1) {
        seen.add(other)
        joined.push(other)
      }
  }
  return joined.every((one) => one.from === run.from) || joined.every((one) => one.to === run.to)
}

/**
 * Lanes for one gap's hops that turn. Each is taken in an order where one that leaves a column
 * comes before one that arrives at it (where two would each have to come first, the first met
 * does), and given the first lane above those that must come before it where it fits.
 */
function assign(hops: Hop[]): number {
  const bent = hops.filter((hop) => hop.start !== hop.end)
  // Edges that go right turn the further right they start the higher; edges that go left, the
  // further left: two edges that do not cross are then not drawn crossing.
  const key = (hop: Hop) => (hop.end > hop.start ? -hop.start : hop.start + 1e6)
  bent.sort((a, b) => key(a) - key(b) || a.route - b.route)
  const byStart = new Map<number, number[]>()
  bent.forEach((hop, at) => {
    const own = byStart.get(hop.start)
    if (own) own.push(at)
    else byStart.set(hop.start, [at])
  })
  const waiting = bent.map((hop) => byStart.get(hop.end)?.length ?? 0)
  const done = bent.map(() => false)
  const lanes: Run[][] = []
  for (let count = 0; count < bent.length; count++) {
    let next = -1
    for (let at = 0; at < bent.length && next < 0; at++)
      if (!done[at] && waiting[at] === 0) next = at
    for (let at = 0; at < bent.length && next < 0; at++) if (!done[at]) next = at
    const hop = bent[next]!
    done[next] = true
    for (const [at, other] of bent.entries())
      if (!done[at] && other.end === hop.start) waiting[at]!--
    let lane = 0
    for (const before of byStart.get(hop.end) ?? [])
      if (done[before]) lane = Math.max(lane, bent[before]!.lane + 1)
    const run = {
      low: Math.min(hop.start, hop.end),
      high: Math.max(hop.start, hop.end),
      from: `${hop.from} ${hop.start}`,
      to: `${hop.to} ${hop.end}`,
    }
    while (lane < lanes.length && !fits(lanes[lane]!, run)) lane++
    while (lanes.length <= lane) lanes.push([])
    lanes[lane]!.push(run)
    hop.lane = lane
  }
  return lanes.length
}

/**
 * Where everything is along. Below each rank: a row for the arrowheads that point back up into
 * it, when one is needed; the lower borders of the frames that end there, innermost first; a row
 * of line, when one is needed; the lanes; the upper borders of the frames that begin at the next
 * rank, outermost first; and the row of arrowheads into the next rank.
 */
export function measure(chart: Flowchart, layout: Layout, gaps: Gaps): Along {
  const count = layout.ranks.length
  const size = layout.ranks.map((rank) =>
    rank.reduce((most, at) => Math.max(most, layout.items[at]!.along), 1),
  )
  const head = layout.ranks.map(() => false)
  // A dotted or a thick edge is given a row of line between its box and its arrowhead, where its
  // look can be seen: a gap of an arrowhead alone would draw every edge alike.
  const stem = layout.ranks.map(() => false)
  for (const hops of gaps.hops)
    for (const hop of hops)
      if (chart.edges[layout.routes[hop.route]!.edge]!.ink !== 'solid')
        stem[layout.items[hop.from]!.rank] = true
  layout.routes.forEach((route, at) => {
    const first = layout.items[route.items[0]!]!
    if (ends(chart, layout, at)[0] !== 'none' && first.box.along === size[first.rank])
      head[first.rank] = true
  })
  const byGroup = new Map(layout.frames.map((frame) => [frame.group, frame]))
  const opening = new Map<number, number>()
  const closing = new Map<number, number>()
  for (const frame of layout.frames) {
    const parent = byGroup.get(chart.groups[frame.group]!.parent)
    opening.set(
      frame.group,
      parent && parent.first === frame.first ? opening.get(parent.group)! + 1 : 0,
    )
  }
  for (const frame of layout.frames.toReversed()) {
    const own = closing.get(frame.group) ?? 0
    closing.set(frame.group, own)
    const parent = byGroup.get(chart.groups[frame.group]!.parent)
    if (parent && parent.last === frame.last)
      closing.set(parent.group, Math.max(closing.get(parent.group) ?? 0, own + 1))
  }
  // Room for what is written at the ends of edges: a row when the chart runs down, and the label's
  // length and a cell of line after it when it runs across.
  const tailRoom = layout.ranks.map(() => 0)
  const headRoom = layout.ranks.map(() => 0)
  layout.routes.forEach((route, at) => {
    const [upper, lower] = endLabels(chart, layout, at)
    const room = (label: string) => (label ? (layout.vertical ? 1 : width(label) + 1) : 0)
    const first = layout.items[route.items[0]!]!.rank
    const last = layout.items[route.items.at(-1)!]!.rank
    tailRoom[first] = Math.max(tailRoom[first]!, room(upper))
    headRoom[last] = Math.max(headRoom[last]!, room(lower))
  })
  const opens = layout.ranks.map(() => 0)
  const closes = layout.ranks.map(() => 0)
  for (const frame of layout.frames) {
    opens[frame.first] = Math.max(opens[frame.first]!, opening.get(frame.group)! + 1)
    closes[frame.last] = Math.max(closes[frame.last]!, closing.get(frame.group)! + 1)
  }
  const lay = (): Along => {
    const start: number[] = []
    const lane: number[] = []
    const openAt: number[] = [0]
    const closeAt: number[] = []
    const tails: number[] = []
    const heads: number[] = [-1]
    let at = opens[0]!
    for (let rank = 0; rank < count; rank++) {
      start.push(at)
      at += size[rank]!
      if (head[rank]) at++
      tails.push(tailRoom[rank] ? at : -1)
      at += tailRoom[rank]!
      closeAt.push(at)
      at += closes[rank]!
      // Across the screen, an edge leaves its box by a cell before it turns: `├─╮`, not `├╮`.
      if (stem[rank] || (!layout.vertical && gaps.lanes[rank])) at++
      lane.push(at)
      if (rank + 1 < count) {
        at += gaps.lanes[rank]!
        openAt.push(at)
        at += opens[rank + 1]!
        heads.push(headRoom[rank + 1] ? at : -1)
        at += headRoom[rank + 1]! + 1
      }
    }
    const top = new Map<number, number>()
    const bottom = new Map<number, number>()
    for (const frame of layout.frames) {
      top.set(frame.group, openAt[frame.first]! + opening.get(frame.group)!)
      bottom.set(frame.group, closeAt[frame.last]! + closing.get(frame.group)!)
    }
    return { start, size, lane, top, bottom, length: at, tails, heads }
  }
  // Across the screen a frame's title runs along: the last rank it holds is made long enough for
  // it. Each pass only lengthens, and a frame is made long enough once, so this ends.
  let laid = lay()
  for (let pass = 0; !layout.vertical && pass <= layout.frames.length; pass++) {
    const short = layout.frames.find((frame) => {
      const title = width(chart.groups[frame.group]!.title.join(' '))
      return title > 0 && laid.bottom.get(frame.group)! - laid.top.get(frame.group)! + 1 < title + 4
    })
    if (!short) break
    const title = width(chart.groups[short.group]!.title.join(' '))
    size[short.last]! +=
      title + 4 - (laid.bottom.get(short.group)! - laid.top.get(short.group)! + 1)
    laid = lay()
  }
  return laid
}

const ARROWS = { up: '▲', down: '▼', left: '◀', right: '▶' }
const TRIANGLES = { up: '△', down: '▽', left: '◁', right: '▷' }
const MARKS: Record<Exclude<Mark, 'triangle'>, string> = { diamond: '◆', hollow: '◇', plus: '⊕' }

/** The glyph for an end drawn with `head`, or `mark` in its place, pointing along forward or back. */
function tip(axes: Axes, head: Head, forward: boolean, mark?: Mark): string {
  if (mark && mark !== 'triangle') return MARKS[mark]
  if (head === 'cross') return '×'
  if (head === 'circle') return '○'
  const ahead = forward !== axes.flip
  const set = mark ? TRIANGLES : ARROWS
  return axes.vertical ? (ahead ? set.down : set.up) : ahead ? set.right : set.left
}

/** Every edge between ranks drawn: its lines, then its heads over them. */
export function drawRoutes(
  canvas: Canvas,
  chart: Flowchart,
  layout: Layout,
  gaps: Gaps,
  along: Along,
  axes: Axes,
): void {
  const items = layout.items
  // A port an arrow points into: an edge without a head that reaches it stops at the arrow.
  const arrowed = new Set<string>()
  const key = (item: number, side: string, across: number) => `${item} ${side} ${across}`
  layout.routes.forEach((route, at) => {
    const [first, last] = ends(chart, layout, at)
    const hops = gaps.hops[at]!
    if (first !== 'none') arrowed.add(key(route.items[0]!, 'out', hops[0]!.start))
    if (last !== 'none') arrowed.add(key(route.items.at(-1)!, 'in', hops.at(-1)!.end))
  })
  const tips: Array<[along: number, across: number, glyph: string]> = []
  layout.routes.forEach((route, at) => {
    const edge = chart.edges[route.edge]!
    const [first, last] = ends(chart, layout, at)
    const [firstMark, lastMark] = marks(chart, layout, at)
    const source = items[route.items[0]!]!
    const border = along.start[source.rank]! + source.box.along - 1
    const out = gaps.hops[at]![0]!.start
    const strokes: Array<Array<[number, number]>> = []
    let path: Array<[number, number]> = []
    if (first !== 'none') tips.push([border + 1, out, tip(axes, first, false, firstMark)])
    path.push([arrowed.has(key(route.items[0]!, 'out', out)) ? border + 1 : border, out])
    for (const hop of gaps.hops[at]!) {
      const to = items[hop.to]!
      if (hop.lane >= 0) {
        const row = along.lane[items[hop.from]!.rank]! + hop.lane
        path.push([row, hop.start], [row, hop.end])
      }
      const top = along.start[to.rank]!
      if (to.node >= 0) {
        if (last !== 'none') tips.push([top - 1, hop.end, tip(axes, last, true, lastMark)])
        path.push([arrowed.has(key(hop.to, 'in', hop.end)) ? top - 1 : top, hop.end])
        break
      }
      if (to.label.length > 0) {
        // The line runs into the label and on out of it: the label is written over its ends.
        const middle = to.label[Math.floor(to.label.length / 2)]!
        const hole = axes.vertical
          ? [top, top + to.label.length]
          : [top + 1, top + 1 + width(middle)]
        path.push([hole[0]!, hop.end])
        strokes.push(path)
        path = [[hole[1]! - 1, hop.end]]
      }
      const bottom = top + along.size[to.rank]! - 1
      if (bottom >= path.at(-1)![0]) path.push([bottom, hop.end])
    }
    strokes.push(path)
    for (const points of strokes)
      canvas.stroke(
        points.map(([own, across]) => real(axes, own, across)),
        edge.ink,
        DIM,
      )
  })
  for (const [own, across, glyph] of tips) {
    const [x, y] = real(axes, own, across)
    canvas.text(x, y, glyph, DIM)
  }
  layout.routes.forEach((route, at) => {
    const [upper, lower] = endLabels(chart, layout, at)
    const hops = gaps.hops[at]!
    if (upper)
      endLabel(canvas, axes, along.tails[items[route.items[0]!]!.rank]!, hops[0]!.start, upper)
    if (lower) {
      // Across the screen the label ends a cell before the arrowhead: `─*─▶`.
      const own = along.heads[items[route.items.at(-1)!]!.rank]! + (axes.vertical ? 0 : 1)
      endLabel(canvas, axes, own, hops.at(-1)!.end, lower)
    }
  })
}

/**
 * What is written at an edge's end, from `own` along: centred on its line when the line runs
 * down, and over the line's cells when it runs across, read left to right either way.
 */
function endLabel(canvas: Canvas, axes: Axes, own: number, across: number, label: string): void {
  const size = width(label)
  if (axes.vertical) {
    const [x, y] = real(axes, own, across - Math.floor(size / 2))
    // A line by the picture's side has no room to centre its label on: it is moved in.
    canvas.text(Math.max(0, Math.min(canvas.width - size, x)), y, label, WAITING)
    return
  }
  const [x0, y] = real(axes, own, across)
  const [x1] = real(axes, own + size - 1, across)
  canvas.text(Math.min(x0, x1), y, label, WAITING)
}
