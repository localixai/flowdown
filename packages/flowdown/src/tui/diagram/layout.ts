/**
 * Where a flowchart's nodes go: a layered layout.
 *
 * 1. Ranks. The edges that close a cycle are turned around, and each node takes the rank of the
 *    longest path that reaches it; a node nothing reaches is moved down beside what it reaches.
 * 2. Points. An edge that spans ranks passes each rank between as a point of its own. An edge's
 *    label is such a point, one rank long: it is given room as a node is, and never lands on a box.
 * 3. Order. Within a rank, items are sorted by where their neighbours are (barycentres, swept down
 *    and up), the order with the fewest crossings kept. A subgraph's items stay side by side.
 * 4. Place. Each rank is set as near its neighbours as its order allows: the closest positions in
 *    order, found exactly (pooled adjacent violators), swept down and up as the order was. Then
 *    each long edge's points are put in one column where there is room, and each subgraph's frame
 *    is made wide enough for its title.
 *
 * All of it is worked on two axes, along (rank after rank) and across (within a rank), so a chart
 * that runs left to right is laid out by the code that lays out one that runs down.
 */
import type { Flowchart } from './parse'

declare module './parse' {
  interface FlowNode {
    /**
     * Set beside another node: in its rank, just before it or just after it in the rank's order.
     * Kept only by a node with no edge of its own (a state's note), whose rank nothing else sets.
     */
    beside?: { node: number; after: boolean }
  }
}
import { boxSize } from './shapes'
import { widest, wrapLines } from './text'
import { width } from '../width'

export interface Item {
  /** The node it is, or -1 for a point an edge passes. */
  node: number
  /** For a point, its edge. */
  edge: number
  rank: number
  order: number
  /** What it takes on each axis, room for a node's loop to itself included. */
  across: number
  along: number
  /** Its box's (a label's, for a point) size on each axis: its port is at the middle of it. */
  box: { across: number; along: number }
  /** Where it starts across. */
  at: number
  /** Its label's rows: a node's, or the edge's for the point that carries it. */
  label: string[]
  /** A node's compartments, wrapped. */
  parts: string[][]
  /** With the edges apart, the columns between two of its ports: 0 when they share one. */
  step: number
  /** Whether it is a point of an edge turned around: such a point barely moves a node. */
  back: boolean
  /** For a node with a loop to itself, the loop's label (perhaps none); null without one. */
  loop: string[] | null
  /** The subgraphs it is inside, outermost first. */
  chain: number[]
  up: number[]
  down: number[]
}

/** An edge as the items it passes, from its upper end down: turned when it closed a cycle. */
export interface Route {
  edge: number
  items: number[]
  turned: boolean
}

/** A subgraph's ranks, and where its frame's borders go across. */
export interface Frame {
  group: number
  first: number
  last: number
  low: number
  high: number
}

export interface Layout {
  /** Whether along is down the screen (TD and BT). */
  vertical: boolean
  items: Item[]
  ranks: number[][]
  routes: Route[]
  frames: Frame[]
}

/** Past this many items (nodes and points) a chart is not laid out. */
const MOST_ITEMS = 6000
const SWEEPS = 12
// Odd, so that the last sweep, which looks both ways, goes down: each rank settles after the one
// over it has.
const PLACINGS = 9

/** The middle of an item's box across: where its edges leave and arrive. */
export const port = (item: Item): number => item.at + Math.floor(item.box.across / 2)

/** The layout of `chart` with labels wrapped at `labelWidth`, or null when it is too big. */
export function layered(chart: Flowchart, labelWidth: number): Layout | null {
  const vertical = chart.direction === 'TD' || chart.direction === 'BT'
  const turned = breakCycles(chart)
  const { rank, sorted } = rankNodes(chart, turned)
  const besides = besideHints(chart)
  for (const [node, hint] of besides) rank[node] = rank[hint.node]!
  const chains = groupChains(chart)
  // A chart that keeps its words whole wraps each label no narrower than its longest word.
  const fit = (lines: string[], room: number) =>
    wrapLines(lines, chart.whole ? Math.max(room, longestWord(lines)) : room)
  const loops = loopLabels(chart, labelWidth, fit)
  // Across the screen, a box an edge turned around reaches is a row taller: the edge comes in
  // beside the middle row (`route.ts`), and a box one row high has no row beside it.
  const turnedEnds = new Set<number>()
  chart.edges.forEach((edge, at) => {
    if (turned[at]) turnedEnds.add(edge.from).add(edge.to)
  })
  const needs = chart.apart ? portNeeds(chart, turned, vertical) : null
  const items = chart.nodes.map((node, at): Item => {
    const label = fit(node.label, labelWidth)
    // Members are read across: they are given more room than a label before they wrap.
    const parts = (node.parts ?? [])
      .map((part) => fit(part, 2 * labelWidth))
      .filter((part) => part.length > 0)
    const loop = loops[at] ?? null
    const rows = vertical ? (loop ? Math.max(2, loop.length) : 1) : turnedEnds.has(at) ? 2 : 1
    const box = boxSize(node.shape, label, rows, parts)
    // A bar lies across the way the chart runs.
    const turn = node.shape === 'bar' && !vertical
    const need = needs?.[at]
    const step = need ? need.step : 0
    // A box with its edges apart is made wide enough to hold their ports inside its corners.
    const least = need && need.count > 1 && box.width > 1 ? (need.count - 1) * step + 3 : 0
    const across = Math.max(vertical !== turn ? box.width : box.height, least)
    const along = vertical !== turn ? box.height : box.width
    // A loop goes out at the side across and back: `├─╮` over `│◀╯`, or under the box.
    const room = loop
      ? vertical
        ? loop.length
          ? 3 + widest(loop)
          : 2
        : 1 + Math.max(1, loop.length)
      : 0
    return {
      node: at,
      edge: -1,
      rank: rank[at]!,
      order: 0,
      across: across + room,
      along: loop && !vertical && loop.length ? Math.max(along, 5 + widest(loop)) : along,
      box: { across, along },
      at: 0,
      label,
      parts,
      step,
      back: false,
      loop,
      chain: node.group >= 0 ? chains[node.group]! : [],
      up: [],
      down: [],
    }
  })
  const spans = groupSpans(chart, items)
  const routes: Route[] = []
  for (const [at, edge] of chart.edges.entries()) {
    if (edge.from === edge.to) continue
    const [from, to] = turned[at] ? [edge.to, edge.from] : [edge.from, edge.to]
    const path = [from]
    for (let step = rank[from]! + 1; step < rank[to]!; step++) {
      const chain = pointChain(items[from]!.chain, items[to]!.chain, step, spans)
      const label = step === rank[from]! + 1 ? fit(edge.label, labelWidth) : []
      const across = label.length ? (vertical ? widest(label) : label.length) : 1
      const along = label.length ? (vertical ? label.length : widest(label) + 2) : 1
      path.push(items.length)
      items.push({
        node: -1,
        edge: at,
        rank: step,
        order: 0,
        across,
        along,
        box: { across, along },
        at: 0,
        label,
        parts: [],
        step: 0,
        back: turned[at]!,
        loop: null,
        chain: chain.slice(),
        up: [],
        down: [],
      })
      if (items.length > MOST_ITEMS) return null
    }
    path.push(to)
    routes.push({ edge: at, items: path, turned: turned[at]! })
    for (let step = 1; step < path.length; step++) {
      items[path[step - 1]!]!.down.push(path[step]!)
      items[path[step]!]!.up.push(path[step - 1]!)
    }
  }
  const ranks = initialRanks(items, routes, sorted, vertical)
  order(items, ranks)
  for (const [node, hint] of besides) setBeside(items, ranks, node, hint)
  place(items, ranks, vertical)
  straighten(items, ranks, routes, vertical)
  if (chart.groups.length > 0) separate(chart, items, ranks, vertical)
  const frames = frame(chart, items, ranks, vertical).toReversed()
  const low = Math.min(...frames.map((one) => one.low), ...items.map((item) => item.at))
  for (const item of items) item.at -= low
  for (const one of frames) {
    one.low -= low
    one.high -= low
  }
  return { vertical, items, ranks, routes, frames }
}

/**
 * The nodes set beside another (`FlowNode.beside`) that can be: with no edge of their own, beside a
 * node that is not itself set so, in the same subgraph.
 */
function besideHints(
  chart: Flowchart,
): Array<[node: number, hint: { node: number; after: boolean }]> {
  const linked = new Set<number>()
  for (const edge of chart.edges) linked.add(edge.from).add(edge.to)
  return chart.nodes.flatMap((node, at) => {
    const hint = node.beside
    const target = hint ? chart.nodes[hint.node] : undefined
    if (!hint || !target || target.beside || hint.node === at || linked.has(at)) return []
    return target.group === node.group ? [[at, hint] as const] : []
  })
}

/** `node` moved in its rank to just before or just after the node it is set beside. */
function setBeside(
  items: Item[],
  ranks: number[][],
  node: number,
  hint: { node: number; after: boolean },
): void {
  const rank = ranks[items[node]!.rank]!
  rank.splice(rank.indexOf(node), 1)
  rank.splice(rank.indexOf(hint.node) + (hint.after ? 1 : 0), 0, node)
  rank.forEach((at, position) => {
    items[at]!.order = position
  })
}

/**
 * For each node, how many ports its edges take on its busier side and the columns between two:
 * room for the widest label written at their ends, centred on their lines, when the chart runs
 * down. Across, ends are written along their lines, and a row between ports is enough.
 */
function portNeeds(
  chart: Flowchart,
  turned: boolean[],
  vertical: boolean,
): Array<{ count: number; step: number }> {
  const upper = chart.nodes.map(() => 0)
  const lower = chart.nodes.map(() => 0)
  const needs = chart.nodes.map(() => ({ count: 0, step: vertical ? 2 : 1 }))
  chart.edges.forEach((edge, at) => {
    if (edge.from === edge.to) return
    const [from, to] = turned[at] ? [edge.to, edge.from] : [edge.from, edge.to]
    upper[from]!++
    lower[to]!++
    if (!vertical) return
    const [high, low] = turned[at]
      ? [edge.ends?.head, edge.ends?.tail]
      : [edge.ends?.tail, edge.ends?.head]
    needs[from]!.step = Math.max(needs[from]!.step, width(high ?? '') + 1)
    needs[to]!.step = Math.max(needs[to]!.step, width(low ?? '') + 1)
  })
  needs.forEach((need, at) => {
    need.count = Math.max(upper[at]!, lower[at]!)
  })
  return needs
}

/** Which edges close a cycle, by a walk from each node in turn: those are turned around. */
function breakCycles(chart: Flowchart): boolean[] {
  const turned = chart.edges.map(() => false)
  const out = chart.nodes.map((): number[] => [])
  chart.edges.forEach((edge, at) => {
    if (edge.from !== edge.to) out[edge.from]!.push(at)
  })
  // 0: not reached; 1: on the path walked; 2: done.
  const state = new Uint8Array(chart.nodes.length)
  for (let root = 0; root < chart.nodes.length; root++) {
    if (state[root]) continue
    state[root] = 1
    const stack: Array<[node: number, next: number]> = [[root, 0]]
    while (stack.length > 0) {
      const top = stack.at(-1)!
      const edges = out[top[0]]!
      if (top[1] >= edges.length) {
        state[top[0]] = 2
        stack.pop()
        continue
      }
      const edge = edges[top[1]++]!
      const to = chart.edges[edge]!.to
      if (state[to] === 1) turned[edge] = true
      else if (state[to] === 0) {
        state[to] = 1
        stack.push([to, 0])
      }
    }
  }
  return turned
}

/**
 * Each node's rank: the longest path to it, where an edge with a label counts two (its label
 * takes the rank between). Also the nodes in an order every edge goes forward in.
 */
function rankNodes(chart: Flowchart, turned: boolean[]): { rank: number[]; sorted: number[] } {
  const count = chart.nodes.length
  const out = chart.nodes.map((): Array<[to: number, length: number]> => [])
  const into = new Int32Array(count)
  chart.edges.forEach((edge, at) => {
    if (edge.from === edge.to) return
    const [from, to] = turned[at] ? [edge.to, edge.from] : [edge.from, edge.to]
    out[from]!.push([to, edge.label.length > 0 ? 2 : 1])
    into[to]!++
  })
  const rank = Array.from({ length: count }, () => 0)
  const left = Int32Array.from(into)
  const sorted: number[] = []
  for (let node = 0; node < count; node++) if (into[node] === 0) sorted.push(node)
  for (let at = 0; at < sorted.length; at++) {
    const from = sorted[at]!
    for (const [to, length] of out[from]!) {
      rank[to] = Math.max(rank[to]!, rank[from]! + length)
      if (--left[to]! === 0) sorted.push(to)
    }
  }
  // A node nothing reaches would sit at the top, its edges long: it is moved down to what it
  // reaches.
  for (let at = sorted.length - 1; at >= 0; at--) {
    const node = sorted[at]!
    if (into[node]! > 0 || out[node]!.length === 0) continue
    rank[node] = out[node]!.reduce(
      (low, [to, length]) => Math.min(low, rank[to]! - length),
      Infinity,
    )
  }
  const low = rank.reduce((most, own) => Math.min(most, own), Infinity)
  return { rank: rank.map((own) => own - low), sorted }
}

/** For each subgraph, the subgraphs it is in and itself, outermost first. */
function groupChains(chart: Flowchart): number[][] {
  const chains: number[][] = []
  chart.groups.forEach((group, at) => {
    chains.push(group.parent >= 0 && group.parent < at ? [...chains[group.parent]!, at] : [at])
  })
  return chains
}

/** For each node with loops to itself, their labels as one, wrapped. */
function loopLabels(
  chart: Flowchart,
  labelWidth: number,
  fit: (lines: string[], room: number) => string[],
): Array<string[] | undefined> {
  const words: Array<string[] | undefined> = []
  for (const edge of chart.edges) {
    if (edge.from !== edge.to) continue
    const own = (words[edge.from] ??= [])
    // A loop has no ends apart to write a multiplicity at: it is written with its label.
    const said = [edge.ends?.tail, edge.label.join(' '), edge.ends?.head].filter(Boolean).join(' ')
    if (said) own.push(said)
  }
  return words.map((own) => (own ? fit(own.length ? [own.join(', ')] : [], labelWidth) : undefined))
}

/** For each subgraph, the first and the last rank its nodes are in. */
function groupSpans(chart: Flowchart, items: Item[]): Array<[first: number, last: number]> {
  const spans = chart.groups.map((): [number, number] => [Infinity, -Infinity])
  for (const item of items)
    for (const group of item.chain) {
      const own = spans[group]!
      own[0] = Math.min(own[0], item.rank)
      own[1] = Math.max(own[1], item.rank)
    }
  return spans
}

/**
 * The subgraphs a point of an edge at `rank` is in: those of an end whose frame reaches that far.
 * A point outside them would stand inside a frame it is not part of, and the frame be left out.
 */
function pointChain(
  upper: number[],
  lower: number[],
  rank: number,
  spans: Array<[number, number]>,
): number[] {
  let down = 0
  while (down < upper.length && spans[upper[down]!]![1] >= rank) down++
  let up = 0
  while (up < lower.length && spans[lower[up]!]![0] <= rank) up++
  return down >= up ? upper.slice(0, down) : lower.slice(0, up)
}

/**
 * Every frame kept clear of what it does not hold. Within a rank a subgraph's items are side by
 * side, but its frame is as wide as its widest rank: in another rank, a box beside it, or a frame
 * beside it, may stand where the border goes. What stands there is moved out, to the side it is
 * on, with what is beyond it in its rank; inner frames first, so that an outer one is cleared
 * around what it holds. Twice: a move for one frame may bring something to another's border.
 */
function separate(chart: Flowchart, items: Item[], ranks: number[][], vertical: boolean): void {
  const pad = vertical ? 2 : 1
  const chains = groupChains(chart)
  for (let pass = 0; pass < 2; pass++)
    for (let group = chart.groups.length - 1; group >= 0; group--) {
      let low = Infinity
      let high = -Infinity
      let first = Infinity
      let last = -Infinity
      for (const item of items) {
        const level = item.chain.indexOf(group)
        if (level < 0) continue
        // Each frame inside this one, around the item, takes its border and margin on each side.
        const inner = (item.chain.length - level - 1) * pad
        low = Math.min(low, item.at - inner)
        high = Math.max(high, item.at + item.across - 1 + inner)
        first = Math.min(first, item.rank)
        last = Math.max(last, item.rank)
      }
      if (low === Infinity) continue
      const around = chains[group]!
      for (let rank = first; rank <= last; rank++) {
        const row = ranks[rank]!
        const inside = row.flatMap((at, seat) => (items[at]!.chain.includes(group) ? [seat] : []))
        const middle = (low + high) / 2
        row.forEach((at, seat) => {
          const item = items[at]!
          if (item.chain.includes(group)) return
          // A border for this frame, and one for each frame the item is in that this one is not.
          const frames = item.chain.filter((own) => !around.includes(own)).length
          const need = (frames + 1) * pad + 2
          const before = inside.length > 0 ? seat < inside[0]! : item.at + item.across / 2 < middle
          if (inside.length > 0 && seat > inside[0]! && seat < inside.at(-1)!) return
          const shift = before ? item.at + item.across - 1 - (low - need) : high + need - item.at
          if (shift <= 0) return
          const moved = before ? row.slice(0, seat + 1) : row.slice(seat)
          for (const other of moved) items[other]!.at += before ? -shift : shift
        })
      }
    }
}

/** The columns the longest word of `lines` takes. */
const longestWord = (lines: readonly string[]): number =>
  widest(lines.flatMap((line) => line.split(' ')))

/** The subgraphs two chains are both in. */
function shared(one: number[], other: number[]): number[] {
  let at = 0
  while (at < one.length && at < other.length && one[at] === other[at]) at++
  return one.slice(0, at)
}

/**
 * Items by rank in the order a walk down the chart meets them, the points of the edges turned
 * around apart from the rest: where nothing else decides, an edge back runs beside the chart, not
 * through it. It runs on the side where it meets its boxes: to the right of a chart that runs
 * down, and above one that runs across, whose boxes it meets above their middle (`route.ts`).
 */
function initialRanks(
  items: Item[],
  routes: Route[],
  sorted: number[],
  vertical: boolean,
): number[][] {
  const ranks: number[][] = []
  const from = new Map<number, Route[]>()
  for (const route of routes) {
    if (route.turned) continue
    const own = from.get(route.items[0]!)
    if (own) own.push(route)
    else from.set(route.items[0]!, [route])
  }
  const add = (at: number) => {
    const rank = items[at]!.rank
    while (ranks.length <= rank) ranks.push([])
    items[at]!.order = ranks[rank]!.length
    ranks[rank]!.push(at)
  }
  const back = () => {
    for (const route of routes) if (route.turned) for (const at of route.items.slice(1, -1)) add(at)
  }
  if (!vertical) back()
  for (const node of sorted) {
    add(node)
    for (const route of from.get(node) ?? []) for (const at of route.items.slice(1, -1)) add(at)
  }
  if (vertical) back()
  return ranks
}

/** Each rank sorted by barycentres, swept down and up; the order with fewest crossings is kept. */
function order(items: Item[], ranks: number[][]): void {
  for (const rank of ranks) arrange(items, rank, null)
  let best = ranks.map((rank) => rank.slice())
  let fewest = crossings(items, ranks)
  for (let sweep = 0; sweep < SWEEPS && fewest > 0; sweep++) {
    const down = sweep % 2 === 0
    for (let step = 1; step < ranks.length; step++) {
      const at = down ? step : ranks.length - 1 - step
      arrange(items, ranks[at]!, down ? 'up' : 'down')
    }
    const now = crossings(items, ranks)
    if (now < fewest) {
      fewest = now
      best = ranks.map((rank) => rank.slice())
    }
  }
  best.forEach((rank, at) => {
    ranks[at] = rank
    rank.forEach((item, position) => {
      items[item]!.order = position
    })
  })
}

/**
 * `rank` sorted by the mean position of each item's neighbours on `side` (its own position when
 * it has none), with the items of a subgraph kept together: a subgraph is placed by the mean of
 * its items, as though it were one.
 */
function arrange(items: Item[], rank: number[], side: 'up' | 'down' | null): void {
  const keys = rank.map((at) => {
    const item = items[at]!
    const near = side ? item[side] : []
    if (near.length === 0) return item.order
    return near.reduce((sum, other) => sum + items[other]!.order, 0) / near.length
  })
  const groups = new Map<number, { sum: number; count: number; first: number }>()
  rank.forEach((at, position) => {
    for (const group of items[at]!.chain) {
      const own = groups.get(group)
      if (own) {
        own.sum += keys[position]!
        own.count++
      } else groups.set(group, { sum: keys[position]!, count: 1, first: position })
    }
  })
  const key = (group: number) => {
    const own = groups.get(group)!
    return own.sum / own.count
  }
  const positions = rank.map((_, position) => position)
  positions.sort((a, b) => {
    const one = items[rank[a]!]!.chain
    const other = items[rank[b]!]!.chain
    for (let level = 0; ; level++) {
      const ga = level < one.length ? one[level]! : -1
      const gb = level < other.length ? other[level]! : -1
      if (ga === gb && ga >= 0) continue
      const ka = ga >= 0 ? key(ga) : keys[a]!
      const kb = gb >= 0 ? key(gb) : keys[b]!
      if (ka !== kb) return ka - kb
      return (ga >= 0 ? groups.get(ga)!.first : a) - (gb >= 0 ? groups.get(gb)!.first : b)
    }
  })
  const sorted = positions.map((position) => rank[position]!)
  sorted.forEach((at, position) => {
    rank[position] = at
    items[at]!.order = position
  })
}

/** How many pairs of edges cross between ranks, counted as inversions. */
function crossings(items: Item[], ranks: number[][]): number {
  let total = 0
  for (let at = 0; at + 1 < ranks.length; at++) {
    const pairs: Array<[number, number]> = []
    for (const upper of ranks[at]!)
      for (const lower of items[upper]!.down) pairs.push([items[upper]!.order, items[lower]!.order])
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const size = ranks[at + 1]!.length
    const tree = new Int32Array(size + 1)
    pairs.forEach(([, lower], seen) => {
      let below = 0
      for (let index = lower + 1; index > 0; index -= index & -index) below += tree[index]!
      total += seen - below
      for (let index = lower + 1; index <= size; index += index & -index) tree[index]!++
    })
  }
  return total
}

/**
 * The room between two neighbours in a rank: a column or a row, two columns between two boxes
 * side by side, and a frame's border and its margin for each subgraph one is in and not the other.
 */
function gap(one: Item, other: Item, vertical: boolean): number {
  const common = shared(one.chain, other.chain).length
  const frames = one.chain.length + other.chain.length - 2 * common
  const base = one.node < 0 || other.node < 0 || !vertical ? 1 : 2
  return base + frames * (vertical ? 2 : 1)
}

/** Each rank's positions across: packed, then drawn to the ports of the ranks beside it. */
function place(items: Item[], ranks: number[][], vertical: boolean): void {
  for (const rank of ranks) {
    let next = 0
    rank.forEach((at, position) => {
      const item = items[at]!
      if (position > 0) next += gap(items[rank[position - 1]!]!, item, vertical)
      item.at = next
      next += item.across
    })
  }
  for (let pass = 0; pass < PLACINGS; pass++) {
    const down = pass % 2 === 0
    const side = pass === PLACINGS - 1 ? 'both' : down ? 'up' : 'down'
    for (let step = 0; step < ranks.length; step++)
      align(items, ranks[down ? step : ranks.length - 1 - step]!, side, vertical)
  }
}

/**
 * `rank` moved as near as its order allows to where its items' neighbours are. With each item's
 * least offset from the first taken out, the positions only have to be in order, and the closest
 * such positions are the means of pooled runs (isotonic regression): exact, in one pass.
 */
function align(
  items: Item[],
  rank: number[],
  side: 'up' | 'down' | 'both',
  vertical: boolean,
): void {
  const offsets: number[] = []
  const targets: number[] = []
  const weights: number[] = []
  let offset = 0
  rank.forEach((at, position) => {
    const item = items[at]!
    if (position > 0)
      offset +=
        items[rank[position - 1]!]!.across + gap(items[rank[position - 1]!]!, item, vertical)
    const near = side === 'up' ? item.up : side === 'down' ? item.down : [...item.up, ...item.down]
    const half = Math.floor(item.box.across / 2)
    // A node is drawn to its neighbours, hardly at all to an edge back up beside it.
    const pull = (other: number) => (item.node >= 0 && items[other]!.back ? 0.05 : 1)
    const total = near.reduce((sum, other) => sum + pull(other), 0)
    const want = near.length
      ? near.reduce((sum, other) => sum + pull(other) * port(items[other]!), 0) / total
      : item.at + half
    offsets.push(offset)
    targets.push(want - half - offset)
    // An item with no neighbour on this side gives way; a point is held straighter than a node,
    // so that a long edge runs as one line, but a point of an edge back up gives way to nodes.
    const own = item.node >= 0 ? 1 : item.back ? 0.25 : 2
    weights.push(near.length ? near.length * own : 0.25)
  })
  const means: number[] = []
  const totals: number[] = []
  const sizes: number[] = []
  targets.forEach((target, at) => {
    let mean = target
    let total = weights[at]!
    let size = 1
    while (means.length > 0 && means.at(-1)! > mean) {
      const weight = totals.pop()!
      mean = (means.pop()! * weight + mean * total) / (weight + total)
      total += weight
      size += sizes.pop()!
    }
    means.push(mean)
    totals.push(total)
    sizes.push(size)
  })
  let position = 0
  means.forEach((mean, run) => {
    for (let count = 0; count < sizes[run]!; count++, position++)
      items[rank[position]!]!.at = Math.round(mean) + offsets[position]!
  })
}

/**
 * Each long edge's points set in one column where its ranks have room for that: in line with the
 * box it leaves, else the one it reaches, else where most of its points are. A long edge then
 * runs as one line, and every bend it does not need is a lane, a row, saved.
 */
function straighten(items: Item[], ranks: number[][], routes: Route[], vertical: boolean): void {
  const fits = (at: number, column: number) => {
    const item = items[at]!
    const rank = ranks[item.rank]!
    const from = column - Math.floor(item.box.across / 2)
    const left = item.order > 0 ? items[rank[item.order - 1]!]! : null
    const right = item.order + 1 < rank.length ? items[rank[item.order + 1]!]! : null
    return (
      (!left || left.at + left.across + gap(left, item, vertical) <= from) &&
      (!right || from + item.across + gap(item, right, vertical) <= right.at)
    )
  }
  for (const route of routes) {
    const points = route.items.slice(1, -1)
    if (points.length === 0) continue
    const own = points.map((at) => port(items[at]!)).toSorted((a, b) => a - b)
    const columns = [
      port(items[route.items[0]!]!),
      port(items[route.items.at(-1)!]!),
      own[own.length >> 1]!,
    ]
    const column = columns.find((one) => points.every((at) => fits(at, one)))
    if (column === undefined) continue
    for (const at of points) items[at]!.at = column - Math.floor(items[at]!.box.across / 2)
  }
}

/**
 * Each subgraph's frame: the ranks its items are in, and across, its items with a margin and a
 * border on each side, around the frames inside it.
 *
 * A frame that runs down the screen has its title in its upper border, where the edges that come
 * into it cross. When no stretch of the border between them holds the title, the frame is made
 * wider to the right and what is beside it in its ranks is moved over: the title is never written
 * over a line, and never left out for want of a few columns.
 */
function frame(chart: Flowchart, items: Item[], ranks: number[][], vertical: boolean): Frame[] {
  const flip = chart.direction === 'BT'
  const least = new Map<number, number>()
  const chains = groupChains(chart)
  const first = extents(chart, items, vertical, least)
  const spans = new Map(first.map((own) => [own.group, own]))
  if (vertical)
    for (const own of first) {
      const title = width(chart.groups[own.group]!.title.join(' '))
      if (title === 0) continue
      // The title is in the border at the top of the screen: the upper one, or in a chart that
      // runs up, the lower. The edges that cross it meet a box at its middle, or with the edges
      // apart, at any of the ports `route.ts` spreads them over.
      const crossed = new Set<number>()
      for (const at of ranks[flip ? own.last : own.first] ?? []) {
        const item = items[at]!
        const near = flip ? item.down : item.up
        if (!item.chain.includes(own.group)) continue
        if (!near.some((other) => !items[other]!.chain.includes(own.group))) continue
        const count = chart.apart && item.node >= 0 ? near.length : 1
        const low = item.at + 1
        const start =
          count > 1
            ? Math.round((2 * low + item.box.across - 3 - (count - 1) * item.step) / 2)
            : port(item)
        for (let index = 0; index < count; index++)
          for (const side of [-1, 0, 1]) crossed.add(start + index * item.step + side)
      }
      // A free stretch for ` title ` with a cell of border on each side of it.
      let run = 0
      let fits = false
      for (let x = own.low + 1; x < own.high && !fits; x++) {
        run = crossed.has(x) ? 0 : run + 1
        fits = run >= title + 2 && x + 1 < own.high
      }
      const from = crossed.size > 0 ? Math.max(...crossed) + 1 : own.low + 1
      const high = fits ? own.high : Math.max(own.high, from + title + 2)
      least.set(own.group, high - own.low)
      const shift = high - own.high
      // The frames around it grow with it: what is beside any of them is moved over.
      const around = chains[own.group]!.map((group) => spans.get(group) ?? own)
      const top = Math.min(...around.map((one) => one.first))
      const bottom = Math.max(...around.map((one) => one.last))
      if (shift > 0)
        for (let rank = top; rank <= bottom; rank++)
          for (const at of ranks[rank] ?? []) if (items[at]!.at > own.high) items[at]!.at += shift
    }
  return extents(chart, items, vertical, least)
}

/** The frames as their items and the frames inside them make them, each at least `least` wide. */
function extents(
  chart: Flowchart,
  items: Item[],
  vertical: boolean,
  least: Map<number, number>,
): Frame[] {
  const pad = vertical ? 2 : 1
  const count = chart.groups.length
  const low = Array.from({ length: count }, () => Infinity)
  const high = Array.from({ length: count }, () => -Infinity)
  const first = Array.from({ length: count }, () => Infinity)
  const last = Array.from({ length: count }, () => -Infinity)
  for (const item of items)
    for (const group of item.chain) {
      low[group] = Math.min(low[group]!, item.at)
      high[group] = Math.max(high[group]!, item.at + item.across - 1)
      first[group] = Math.min(first[group]!, item.rank)
      last[group] = Math.max(last[group]!, item.rank)
    }
  // Inner frames first: a frame is set around the ones inside it. A subgraph opens after its
  // parent, so its number is higher.
  const frames: Frame[] = []
  for (let group = count - 1; group >= 0; group--) {
    if (low[group] === Infinity) continue
    low[group]! -= pad
    high[group] = Math.max(high[group]! + pad, low[group]! + (least.get(group) ?? 0))
    const parent = chart.groups[group]!.parent
    if (parent >= 0) {
      low[parent] = Math.min(low[parent]!, low[group]!)
      high[parent] = Math.max(high[parent]!, high[group]!)
    }
    frames.push({
      group,
      first: first[group]!,
      last: last[group]!,
      low: low[group]!,
      high: high[group]!,
    })
  }
  return frames
}
