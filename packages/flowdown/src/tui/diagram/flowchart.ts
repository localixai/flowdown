/**
 * A flowchart as a picture: its layout (`layout.ts`) and its edges (`route.ts`) put on a canvas
 * with its boxes, its labels and its subgraphs' frames.
 *
 * A picture is drawn whole or not at all. Labels are wrapped narrower until it fits the columns;
 * when even the narrowest does not, or it would be taller than a reply should be, the chart is
 * written as an outline instead (`outline.ts`). A frame that would cross a box it does not hold
 * is left out, and its subgraph named under the picture.
 */
import { Canvas } from './canvas'
import { layered, port, type Item, type Layout } from './layout'
import { flowOutline, MOST_ROWS } from './outline'
import type { Flowchart, Shape } from './parse'
import { drawRoutes, laneHops, measure, real, type Along, type Axes } from './route'
import { drawBox } from './shapes'
import { printable } from '../printable'
import { BOLD, CODE, DIM, PLAIN, WAITING, type Line } from '../style'
import { width } from '../width'
import { span, wrap } from '../wrap'

const MARKS: ReadonlySet<Shape> = new Set(['start', 'stop', 'choice', 'bar', 'dot'])

/** Past these a chart is written as an outline: a picture that big is not read as one. */
const MOST_NODES = 300
const MOST_EDGES = 1000
/** The widths labels are wrapped at, tried in turn until the picture fits. */
const LABEL_WIDTHS = [24, 16, 10]

/** `chart` as rows no wider than `columns`: a picture when one fits, else an outline. */
export function drawFlowchart(chart: Flowchart, columns: number): Line[] | null {
  return drawGraph(chart, columns) ?? flowOutline(chart, columns)
}

/**
 * `chart` as a picture no wider than `columns`, or null when none fits: the drawing the other
 * diagrams laid out in layers (states, classes, entities) share, each with an outline of its own.
 */
export function drawGraph(chart: Flowchart, columns: number): Line[] | null {
  if (chart.nodes.length > MOST_NODES || chart.edges.length > MOST_EDGES) return null
  for (const labelWidth of LABEL_WIDTHS) {
    const drawn = picture(chart, labelWidth, columns)
    if (drawn) return drawn
  }
  return null
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const holds = (outer: Rect, inner: Rect): boolean =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h

function picture(chart: Flowchart, labelWidth: number, columns: number): Line[] | null {
  const layout = layered(chart, labelWidth)
  if (!layout) return null
  const gaps = laneHops(layout, chart.apart)
  const along = measure(chart, layout, gaps)
  const across = layout.items.reduce(
    (most, item) => Math.max(most, item.at + item.across),
    layout.frames.reduce((most, frame) => Math.max(most, frame.high + 1), 0),
  )
  const axes: Axes = {
    vertical: layout.vertical,
    flip: chart.direction === 'BT' || chart.direction === 'RL',
    length: along.length,
  }
  // Settled before anything is drawn: a picture too big is not drawn to be thrown away.
  const frames = framed(chart, layout, along, axes)
  let wide = layout.vertical ? across : along.length
  for (const frame of frames) if (frame.rect) wide = Math.max(wide, frame.rect.x + frame.rect.w)
  const high = layout.vertical ? along.length : across
  if (wide > columns || high > MOST_ROWS) return null
  const canvas = new Canvas(wide, high)
  for (const frame of frames)
    if (frame.rect)
      canvas.rect(frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, 'solid', DIM, false)
  for (const item of layout.items) {
    if (item.node < 0) continue
    const box = boxRect(item, along, axes)
    const node = chart.nodes[item.node]!
    drawBox(
      canvas,
      box.x,
      box.y,
      { width: box.w, height: box.h },
      node.shape,
      item.label,
      CODE,
      item.parts,
      node.ink,
    )
  }
  drawRoutes(canvas, chart, layout, gaps, along, axes)
  for (const item of layout.items) {
    if (item.node >= 0 && item.loop) drawLoop(canvas, chart, item, boxRect(item, along, axes), axes)
    if (item.node < 0 && item.label.length > 0) drawEdgeLabel(canvas, item, along, axes)
  }
  const unframed: number[] = []
  for (const frame of frames) {
    if (!frame.rect || !titled(canvas, frame.rect, frame.title)) unframed.push(frame.group)
  }
  return [...canvas.rows(), ...legend(chart, unframed, columns)]
}

/** Where an item's box is on the screen. */
function boxRect(item: Item, along: Along, axes: Axes): Rect {
  const start = along.start[item.rank]!
  const [x0, y0] = real(axes, start, item.at)
  const [x1, y1] = real(axes, start + item.box.along - 1, item.at + item.box.across - 1)
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0) + 1,
    h: Math.abs(y1 - y0) + 1,
  }
}

/** Where everything an item takes is on the screen: its loop's room, a point's whole rank. */
function itemRect(item: Item, along: Along, axes: Axes): Rect {
  const start = along.start[item.rank]!
  const plain = item.node < 0 && item.label.length === 0
  const length = plain ? along.size[item.rank]! : item.along
  const from = plain ? port(item) : item.at
  const [x0, y0] = real(axes, start, from)
  const [x1, y1] = real(axes, start + length - 1, plain ? from : item.at + item.across - 1)
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0) + 1,
    h: Math.abs(y1 - y0) + 1,
  }
}

interface Framed {
  group: number
  title: string
  /** Where it is drawn, or null when it would cross what it does not hold. */
  rect: Rect | null
}

/**
 * Each subgraph's frame on the screen, made wide enough for its title, and kept only when it
 * holds no item of another subgraph's and crosses no other frame: one inside another, or apart.
 */
function framed(chart: Flowchart, layout: Layout, along: Along, axes: Axes): Framed[] {
  const out: Framed[] = []
  const kept: Rect[] = []
  for (const frame of layout.frames) {
    const title = chart.groups[frame.group]!.title.join(' ')
    const [x0, y0] = real(axes, along.top.get(frame.group)!, frame.low)
    const [x1, y1] = real(axes, along.bottom.get(frame.group)!, frame.high)
    const rect = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0) + 1,
      h: Math.abs(y1 - y0) + 1,
    }
    if (title) rect.w = Math.max(rect.w, width(title) + 4)
    const clean =
      layout.items.every(
        (item) => item.chain.includes(frame.group) || !overlaps(rect, itemRect(item, along, axes)),
      ) && kept.every((other) => holds(other, rect) || holds(rect, other) || !overlaps(rect, other))
    if (clean) kept.push(rect)
    out.push({ group: frame.group, title, rect: clean ? rect : null })
  }
  return out
}

/**
 * A frame's title written into its upper border, at the first place no edge crosses it; false
 * when there is none, and the subgraph is named under the picture.
 */
function titled(canvas: Canvas, rect: Rect, title: string): boolean {
  if (!title) return true
  const own = width(title) + 2
  for (let x = rect.x + 1; x + own < rect.x + rect.w; x++) {
    if (!canvas.across(x, rect.y, own)) continue
    canvas.text(x, rect.y, ` ${title} `, BOLD)
    return true
  }
  return false
}

/**
 * A node's loop to itself, out of its side across and back: `├─╮` over `│◀╯` beside a box that
 * runs down, and under one that runs across. Its label is written beside the loop.
 */
function drawLoop(canvas: Canvas, chart: Flowchart, item: Item, box: Rect, axes: Axes): void {
  const edge = chart.edges.find((one) => one.from === item.node && one.to === item.node)!
  const head = edge.head === 'cross' ? '×' : edge.head === 'circle' ? '○' : null
  const label = item.loop ?? []
  if (axes.vertical) {
    const side = box.x + box.w - 1
    const row = box.y + 1
    const back = edge.head === 'none' ? side : side + 1
    canvas.stroke(
      [
        [side, row],
        [side + 2, row],
        [side + 2, row + 1],
        [back, row + 1],
      ],
      edge.ink,
      DIM,
    )
    if (edge.head !== 'none') canvas.text(side + 1, row + 1, head ?? '◀', DIM)
    label.forEach((line, at) => canvas.text(side + 4, row + at, line, WAITING))
    return
  }
  // Under the box, from its end along, so that the label beside it stays within the item's room.
  const bottom = box.y + box.h - 1
  const mirror = axes.flip
  const out = mirror ? box.x + box.w - 2 : box.x + 1
  const into = mirror ? out - 2 : out + 2
  canvas.stroke(
    [
      [out, bottom],
      [out, bottom + 2],
      [into, bottom + 2],
      [into, edge.head === 'none' ? bottom : bottom + 1],
    ],
    edge.ink,
    DIM,
  )
  if (edge.head !== 'none') canvas.text(into, bottom + 1, head ?? '▲', DIM)
  label.forEach((line, at) => {
    const x = mirror ? into - 1 - width(line) : into + 2
    canvas.text(x, bottom + 2 + at, line, WAITING)
  })
}

/**
 * An edge's label, in the room its point was given. Under a line that runs down, each row is
 * centred on the line, so that the line's ends, which run into the label, are written over.
 */
function drawEdgeLabel(canvas: Canvas, item: Item, along: Along, axes: Axes): void {
  const start = along.start[item.rank]!
  item.label.forEach((line, at) => {
    const own = width(line)
    if (axes.vertical) {
      const row = start + (axes.flip ? item.label.length - 1 - at : at)
      const [x, y] = real(axes, row, port(item) - Math.floor(own / 2))
      canvas.text(x, y, line, WAITING)
      return
    }
    // From just after the line's start along, so that the line runs up to the label and on
    // after it.
    const [x0] = real(axes, start + 1, item.at + at)
    const [x1, y] = real(axes, start + own, item.at + at)
    canvas.text(Math.min(x0, x1), y, line, WAITING)
  })
}

/** The subgraphs no frame could be drawn for, each with what it holds, under the picture. */
function legend(chart: Flowchart, groups: number[], columns: number): Line[] {
  return groups.flatMap((group) => {
    const title = chart.groups[group]!.title.join(' ')
    // A mark (a state machine's start, a fork's bar) says nothing in a list of what a group holds.
    const members = chart.nodes
      .filter((node) => node.group === group && !MARKS.has(node.shape))
      .map((node) => (node.label.length ? node.label.join(' ') : printable(node.id)))
    if (members.length === 0) return []
    const line: Line = [
      span(title || 'subgraph', BOLD),
      span(': ', DIM),
      span(members.join(', '), PLAIN),
    ]
    return wrap(line, columns, [], columns > 3 ? [span('  ', PLAIN)] : [])
  })
}
