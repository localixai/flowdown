/**
 * Block diagrams (`block-beta`) as a picture: blocks in a grid of `columns N`, row after row, a
 * block as wide as the columns it spans (`a:2`), every column of a grid as wide as its widest
 * block needs and every block of a row as high as the row, as Mermaid sets them. `space` leaves a
 * cell empty; a nested `block … end` is a frame holding a grid of its own. A block keeps the
 * shapes a flowchart's nodes have, and a block arrow (`a<["go"]>(right)`) is its label with the
 * arrow it points.
 *
 * A grid has no room between its blocks for a line to turn in, so an arrow is drawn when it runs
 * straight: between blocks of one grid, side by side in a row or one over the other, with only
 * empty cells between them. Every other arrow is written under the picture, `a ──▶ d`, so that
 * none is left out.
 */
import { Canvas, type Ink } from './canvas'
import { indented, MOST_GROUPS, MOST_NODES, MOST_EDGES, PASSED } from './graph'
import type { DiagramKind } from './kind'
import { MOST_ROWS } from './outline'
import { link, node, Reader, type Head, type Shape } from './parse'
import { boxSize, drawBox } from './shapes'
import { labelLines, widest, wrapLines } from './text'
import { printable } from '../printable'
import { BOLD, CODE, DIM, PLAIN, WAITING, type Line, type Span } from '../style'
import { width } from '../width'
import { span } from '../wrap'

const HEADER = /^block(?:-beta)?\b\s*;?$/i
const COLUMNS = /^columns\s+(\d{1,4}|auto)\s*;?$/i
const OPEN = /^block(?::([\p{L}\p{N}_-]+))?(?::(\d{1,4}))?\s*;?$/u
const SPACE = /space(?::(\d{1,4}))?(?=\s|$)/y
const SPAN = /:(\d{1,4})/y
const ARROW = /<\[\s*"?([^"\]]*)"?\s*\]>\(\s*([a-z, ]*)\)/y
/** The widths labels are wrapped at, tried in turn until the picture fits. */
const LABEL_WIDTHS = [24, 16, 10]
/** The columns between two blocks side by side, and the rows between two rows. */
const GAP_ACROSS = 3
const GAP_DOWN = 2

export const blockDiagram: DiagramKind = {
  matches: (header) => HEADER.test(header),
  draw: (lines, columns) => {
    const chart = parseBlock(lines)
    const room = Math.floor(columns)
    if (!chart || !(room >= 2)) return null
    for (const labelWidth of LABEL_WIDTHS) {
      const drawn = picture(chart, labelWidth, room)
      if (drawn) return drawn
    }
    return blockOutline(chart, room)
  },
}

interface Block {
  id: string
  label: string[]
  shape: Shape
  span: number
  /** For a nested block, what it holds and how many columns it sets them in (0: one row). */
  children: Block[] | null
  columns: number
  /** Whether it is an empty cell. */
  space: boolean
}

interface Arrow {
  from: string
  to: string
  label: string[]
  ink: Ink
  head: Head
  tail: Head
}

interface Chart {
  root: Block
  arrows: Arrow[]
  blocks: Map<string, Block>
}

const GLYPHS: Record<string, string> = {
  right: '▶',
  left: '◀',
  up: '▲',
  down: '▼',
  x: '◀▶',
  y: '▲▼',
}

/** The blocks and arrows `lines` write (the first is the header); null when none could be read. */
export function parseBlock(lines: readonly string[]): Chart | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const root: Block = {
    id: '',
    label: [],
    shape: 'box',
    span: 1,
    children: [],
    columns: 0,
    space: false,
  }
  const chart: Chart = { root, arrows: [], blocks: new Map() }
  const open = [root]
  let count = 0
  let groups = 0
  const add = (block: Block) => {
    if (count >= MOST_NODES) return
    count++
    open.at(-1)!.children!.push(block)
    if (!block.space) chart.blocks.set(block.id, block)
  }
  for (const line of lines.slice(1)) {
    if (PASSED.test(line) || /^class\s/i.test(line)) continue
    const columns = COLUMNS.exec(line)
    if (columns) {
      open.at(-1)!.columns = columns[1] === 'auto' ? 0 : Number(columns[1])
      continue
    }
    if (/^end\s*;?$/i.test(line)) {
      if (open.length > 1) open.pop()
      continue
    }
    const opened = OPEN.exec(line)
    if (opened) {
      if (groups >= MOST_GROUPS) continue
      groups++
      const id = opened[1] ?? `[block] ${groups}`
      const block: Block = {
        id,
        label: opened[1] ? labelLines(opened[1]) : [],
        shape: 'box',
        span: Number(opened[2] ?? 1),
        children: [],
        columns: 0,
        space: false,
      }
      add(block)
      open.push(block)
      continue
    }
    statement(line, chart, add)
  }
  return count > 0 && chart.blocks.size > 0 ? chart : null
}

/** A line of blocks (`a b:2 space c`), or of blocks with arrows between them (`a --> b`). */
function statement(line: string, chart: Chart, add: (block: Block) => void): void {
  const reader = new Reader(line)
  // An arrow read up to its far end: `a -->` waits for `b`.
  let pending: Arrow | null = null
  for (let guard = 0; !reader.done() && guard <= line.length; guard++) {
    const space = reader.take(SPACE)
    if (space) {
      add({
        id: '',
        label: [],
        shape: 'box',
        span: Number(space[1] ?? 1),
        children: null,
        columns: 0,
        space: true,
      })
      pending = null
      continue
    }
    const ref = node(reader)
    if (!ref) return
    // A span may be written before a block arrow's shape or after it.
    const before = reader.take(SPAN)
    const arrow = reader.take(ARROW)
    const spanned = before ?? reader.take(SPAN)
    const known = chart.blocks.get(ref.id)
    if (!known || ref.label !== null || arrow) {
      const label = labelLines(arrow ? arrow[1]! : (ref.label ?? ref.id))
      const glyph = arrow
        ? arrow[2]!
            .split(',')
            .map((one) => GLYPHS[one.trim()] ?? '')
            .join('')
        : ''
      const block: Block = {
        id: ref.id,
        label: glyph ? [...label.slice(0, -1), `${label.at(-1) ?? ''} ${glyph}`.trim()] : label,
        shape: arrow ? 'box' : (ref.shape ?? 'box'),
        span: Number(spanned?.[1] ?? 1),
        children: null,
        columns: 0,
        space: false,
      }
      if (known) Object.assign(known, { label: block.label, shape: block.shape })
      else add(block)
    }
    if (pending) {
      pending.to = ref.id
      chart.arrows.push(pending)
    }
    reader.space()
    const next = reader.done() ? null : link(reader)
    pending =
      next && !next.hidden && chart.arrows.length < MOST_EDGES
        ? {
            from: ref.id,
            to: '',
            label: labelLines(next.label),
            ink: next.ink,
            head: next.head,
            tail: next.tail,
          }
        : null
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Where a grid's blocks are: each block's row, its first column and how many it spans. */
interface Cell {
  block: Block
  row: number
  column: number
  span: number
}

interface Grid {
  columns: number
  cells: Cell[]
  rows: number
}

/** A grid's blocks set row after row; a block that does not fit what is left of a row starts the next. */
function grid(block: Block): Grid {
  const children = block.children ?? []
  const columns = Math.max(
    1,
    block.columns || children.reduce((sum, child) => sum + Math.max(1, child.span), 0),
  )
  const cells: Cell[] = []
  let row = 0
  let column = 0
  for (const child of children) {
    const wide = Math.min(columns, Math.max(1, child.span))
    if (column + wide > columns) {
      row++
      column = 0
    }
    cells.push({ block: child, row, column, span: wide })
    column += wide
  }
  // Columns no block reaches take no room: `columns 3` over two blocks is two columns wide.
  const used = cells.reduce((most, cell) => Math.max(most, cell.column + cell.span), 1)
  return { columns: used, cells, rows: row + 1 }
}

/** What a picture is laid out from: each grid, its blocks' sizes, and the arrows drawn in it. */
interface Laid {
  grids: Map<Block, Grid>
  /** For each block, its label's rows; for each nested one, the least size of its frame. */
  labels: Map<Block, string[]>
  sizes: Map<Block, { w: number; h: number }>
  /** For each grid, its columns' widths and its rows' heights, the least they can be. */
  widths: Map<Block, number[]>
  heights: Map<Block, number[]>
  gaps: Map<Block, { across: number; down: number }>
  straight: Map<Arrow, { grid: Block; across: boolean }>
}

function lay(chart: Chart, labelWidth: number): Laid {
  const laid: Laid = {
    grids: new Map(),
    labels: new Map(),
    sizes: new Map(),
    widths: new Map(),
    heights: new Map(),
    gaps: new Map(),
    straight: new Map(),
  }
  const parents = new Map<string, Block>()
  // Nested no deeper than the blocks that were read (at most two hundred): bounded.
  const index = (block: Block) => {
    const own = grid(block)
    laid.grids.set(block, own)
    for (const cell of own.cells) {
      if (!cell.block.space) parents.set(cell.block.id, block)
      if (cell.block.children) index(cell.block)
    }
  }
  index(chart.root)
  for (const arrow of chart.arrows) {
    const parent = parents.get(arrow.from)
    if (!parent || parent !== parents.get(arrow.to) || arrow.from === arrow.to) continue
    const own = laid.grids.get(parent)!
    const one = own.cells.find((cell) => cell.block.id === arrow.from)!
    const other = own.cells.find((cell) => cell.block.id === arrow.to)!
    const across = one.row === other.row
    if (!clear(own, one, other, across)) continue
    laid.straight.set(arrow, { grid: parent, across })
    const gap = laid.gaps.get(parent) ?? { across: GAP_ACROSS, down: GAP_DOWN }
    // A label is written on its line: across, in the gap with a cell of line each side and the
    // arrowhead; down, a row of its own between the line and the arrowhead.
    if (across) gap.across = Math.max(gap.across, widest(arrow.label) + 3)
    else if (arrow.label.length > 0) gap.down = Math.max(gap.down, 2 + arrow.label.length)
    laid.gaps.set(parent, gap)
  }
  const measure = (block: Block): { w: number; h: number } => {
    if (block.space) return { w: 1, h: 1 }
    if (!block.children) {
      const label = wrapLines(block.label, labelWidth)
      laid.labels.set(block, label)
      const box = boxSize(block.shape, label)
      return { w: box.width, h: box.height }
    }
    const own = laid.grids.get(block)!
    const gap = laid.gaps.get(block) ?? { across: GAP_ACROSS, down: GAP_DOWN }
    laid.gaps.set(block, gap)
    const widths = Array.from({ length: own.columns }, () => 1)
    const heights = Array.from({ length: own.rows }, () => 1)
    for (const cell of own.cells) {
      const size = measure(cell.block)
      laid.sizes.set(cell.block, size)
      heights[cell.row] = Math.max(heights[cell.row]!, size.h)
      if (cell.span === 1) widths[cell.column] = Math.max(widths[cell.column]!, size.w)
    }
    // A block over several columns widens them evenly by what it lacks, once the others are set.
    for (const cell of own.cells) {
      if (cell.span === 1) continue
      const lack = laid.sizes.get(cell.block)!.w - spanned(widths, cell, gap.across)
      if (lack > 0)
        for (let at = 0; at < cell.span; at++)
          widths[cell.column + at]! += Math.ceil(lack / cell.span)
    }
    laid.widths.set(block, widths)
    laid.heights.set(block, heights)
    const inner = {
      w: widths.reduce((sum, one) => sum + one, 0) + (own.columns - 1) * gap.across,
      h: heights.reduce((sum, one) => sum + one, 0) + (own.rows - 1) * gap.down,
    }
    // The root is the picture; a nested block is a frame, a column and its border each side.
    return block === chart.root ? inner : { w: inner.w + 4, h: inner.h + 2 }
  }
  laid.sizes.set(chart.root, measure(chart.root))
  return laid
}

/** The columns a cell spans, with the gaps between them. */
const spanned = (widths: readonly number[], cell: Cell, gap: number): number =>
  widths.slice(cell.column, cell.column + cell.span).reduce((sum, one) => sum + one, 0) +
  (cell.span - 1) * gap

/** Whether only empty cells lie between two blocks of a grid, in their row or in their columns. */
function clear(own: Grid, one: Cell, other: Cell, across: boolean): boolean {
  const [low, high] = one.column <= other.column ? [one, other] : [other, one]
  if (across)
    return own.cells.every(
      (cell) =>
        cell.block.space ||
        cell.row !== one.row ||
        cell.column + cell.span <= low.column + low.span ||
        cell.column >= high.column,
    )
  const left = Math.max(one.column, other.column)
  const right = Math.min(one.column + one.span, other.column + other.span)
  if (left >= right) return false
  const [top, bottom] = one.row < other.row ? [one, other] : [other, one]
  return own.cells.every(
    (cell) =>
      cell.block.space ||
      cell.row <= top.row ||
      cell.row >= bottom.row ||
      cell.column + cell.span <= left ||
      cell.column >= right,
  )
}

function picture(chart: Chart, labelWidth: number, columns: number): Line[] | null {
  const laid = lay(chart, labelWidth)
  const size = laid.sizes.get(chart.root)!
  if (size.w > columns || size.h > MOST_ROWS) return null
  const canvas = new Canvas(size.w, size.h)
  const rects = new Map<string, Rect>()
  const place = (block: Block, area: Rect) => {
    const own = laid.grids.get(block)!
    const gap = laid.gaps.get(block)!
    // A grid given more room than it needs, in a column made wide by another row, shares it out.
    const widths = laid.widths.get(block)!.slice()
    const spare =
      area.w - spanned(widths, { block, row: 0, column: 0, span: widths.length }, gap.across)
    widths.forEach((_, at) => {
      widths[at]! += Math.floor(spare / widths.length) + (at < spare % widths.length ? 1 : 0)
    })
    const lefts: number[] = []
    widths.reduce((at, one) => {
      lefts.push(at)
      return at + one + gap.across
    }, area.x)
    const heights = laid.heights.get(block)!
    const tops: number[] = []
    heights.reduce((at, height) => {
      tops.push(at)
      return at + height + gap.down
    }, area.y)
    for (const cell of own.cells) {
      if (cell.block.space) continue
      const rect = {
        x: lefts[cell.column]!,
        y: tops[cell.row]!,
        w: spanned(widths, cell, gap.across),
        h: heights[cell.row]!,
      }
      rects.set(cell.block.id, rect)
      if (cell.block.children) {
        canvas.rect(rect.x, rect.y, rect.w, rect.h, 'solid', DIM, false)
        place(cell.block, { x: rect.x + 2, y: rect.y + 1, w: rect.w - 4, h: rect.h - 2 })
      } else {
        const label = laid.labels.get(cell.block) ?? []
        drawBox(
          canvas,
          rect.x,
          rect.y,
          { width: rect.w, height: rect.h },
          cell.block.shape,
          label,
          CODE,
        )
      }
    }
  }
  place(chart.root, { x: 0, y: 0, w: size.w, h: size.h })
  const left: Arrow[] = []
  const used = new Set<number>()
  for (const arrow of chart.arrows) {
    const straight = laid.straight.get(arrow)
    const one = rects.get(arrow.from)
    const other = rects.get(arrow.to)
    if (!straight || !one || !other || !drawArrow(canvas, used, arrow, one, other, straight.across))
      left.push(arrow)
  }
  const legend = left.flatMap((arrow) => indented(arrowSpans(chart, arrow), columns, 0))
  return [...canvas.rows(), ...legend]
}

/**
 * An arrow straight between two blocks, its label on it; false when there is no room for it, or
 * when it would cross a cell another arrow drew (`used`): two arrows between one pair of blocks
 * would be drawn as one.
 */
function drawArrow(
  canvas: Canvas,
  used: Set<number>,
  arrow: Arrow,
  one: Rect,
  other: Rect,
  across: boolean,
): boolean {
  // Drawn from the block first on the screen to the other, its ends swapped to match.
  const forward = across ? one.x < other.x : one.y < other.y
  const [a, b] = forward ? [one, other] : [other, one]
  const [start, end] = forward ? [arrow.tail, arrow.head] : [arrow.head, arrow.tail]
  const cells: Array<[x: number, y: number]> = []
  const texts: Array<[x: number, y: number, text: string, label: boolean]> = []
  let line: Array<[number, number]>
  if (across) {
    const y = Math.floor((Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h) - 1) / 2)
    const from = a.x + a.w - 1
    const to = b.x
    if (to - from < 2) return false
    for (let x = from + 1; x < to; x++) cells.push([x, y])
    line = [
      [start === 'none' ? from : from + 1, y],
      [end === 'none' ? to : to - 1, y],
    ]
    if (start !== 'none') texts.push([from + 1, y, tip(start, '◀'), false])
    if (end !== 'none') texts.push([to - 1, y, tip(end, '▶'), false])
    const label = arrow.label.join(' ')
    if (label)
      texts.push([from + 2 + Math.floor((to - from - 3 - width(label)) / 2), y, label, true])
  } else {
    const low = Math.max(a.x, b.x) + 1
    const high = Math.min(a.x + a.w, b.x + b.w) - 2
    if (low > high) return false
    const x = Math.floor((low + high) / 2)
    const from = a.y + a.h - 1
    const to = b.y
    for (let y = from + 1; y < to; y++) cells.push([x, y])
    line = [
      [x, start === 'none' ? from : from + 1],
      [x, end === 'none' ? to : to - 1],
    ]
    if (start !== 'none') texts.push([x, from + 1, tip(start, '▲'), false])
    if (end !== 'none') texts.push([x, to - 1, tip(end, '▼'), false])
    arrow.label.forEach((own, at) => {
      const left = Math.max(0, Math.min(canvas.width - width(own), x - Math.floor(width(own) / 2)))
      texts.push([left, from + 2 + at, own, true])
      for (let column = left; column < left + width(own); column++)
        cells.push([column, from + 2 + at])
    })
  }
  const keys = cells.map(([x, y]) => y * canvas.width + x)
  if (keys.some((key) => used.has(key))) return false
  for (const key of keys) used.add(key)
  canvas.stroke(line, arrow.ink, DIM)
  for (const [x, y, text, label] of texts) canvas.text(x, y, text, label ? WAITING : DIM)
  return true
}

const tip = (head: Head, arrow: string): string =>
  head === 'cross' ? '×' : head === 'circle' ? '○' : arrow

/** A block as an arrow's row names it: by its label, else its name. */
const named = (chart: Chart, id: string): string => {
  const block = chart.blocks.get(id)
  return block && block.label.length > 0 ? block.label.join(' ') : printable(id)
}

const LINES: Record<Ink, string> = { solid: '─', dotted: '┄', thick: '━' }
const TIPS: Record<Head, readonly [head: string, tail: string]> = {
  arrow: ['▶', '◀'],
  cross: ['×', '×'],
  circle: ['○', '○'],
  none: ['', ''],
}

function arrowSpans(chart: Chart, arrow: Arrow): Span[] {
  const line = LINES[arrow.ink].repeat(2)
  const head = TIPS[arrow.head][0]
  const tail = TIPS[arrow.tail][1]
  const label = arrow.label.join(' ')
  return [
    span(named(chart, arrow.from), PLAIN),
    span(' ', PLAIN),
    ...(label
      ? [span(tail + line, DIM), span(label, WAITING), span(line + head, DIM)]
      : [span(tail + line + (head || LINES[arrow.ink]), DIM)]),
    span(' ', PLAIN),
    span(named(chart, arrow.to), PLAIN),
  ]
}

/** The blocks written out in their order, a nested block's indented under it, then the arrows. */
function blockOutline(chart: Chart, columns: number): Line[] | null {
  const out: Line[] = []
  // Nested no deeper than was read: bounded.
  const list = (block: Block, indent: number) => {
    for (const child of block.children ?? []) {
      if (child.space || out.length > MOST_ROWS) continue
      if (child.children) {
        out.push(...indented([span(child.label.join(' ') || 'block', BOLD)], columns, indent))
        list(child, indent + 2)
      } else
        out.push(
          ...indented([span('• ', DIM), span(named(chart, child.id), PLAIN)], columns, indent),
        )
    }
  }
  list(chart.root, 0)
  for (const arrow of chart.arrows) {
    if (out.length > MOST_ROWS) return null
    out.push(...indented(arrowSpans(chart, arrow), columns, 0))
  }
  return out.length > MOST_ROWS ? null : out
}
