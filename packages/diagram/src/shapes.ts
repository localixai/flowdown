/**
 * The shapes a terminal drawing is made of, found in its cells: a box is a closed run of borders
 * (`┌─┐ │ │ └─┘`), a stadium a box whose sides are `(` and `)`, a group a box whose top border a
 * title breaks, a diamond the `<` and `>` a decision is drawn between. The SVG draws each as one
 * shape, filled, and keeps of its borders only what leaves them: an edge, a compartment's rule.
 */
import type { Style } from './style'

export const UP = 1
export const RIGHT = 2
export const DOWN = 4
export const LEFT = 8

export type Weight = 'light' | 'heavy' | 'dotted' | 'double'
export interface Stroke {
  mask: number
  weight: Weight
  round?: boolean
}

/** Each box-drawing character: the sides of its cell it reaches, and its weight. */
export const STROKES = new Map<string, Stroke>()
const table = (chars: string, weight: Weight) =>
  [...chars].forEach((char, mask) => char !== ' ' && STROKES.set(char, { mask, weight }))
table(' ╵╶└╷│┌├╴┘─┴┐┤┬┼', 'light')
table(' ╹╺┗╻┃┏┣╸┛━┻┓┫┳╋', 'heavy')
for (const [char, mask] of [
  ['╰', 3],
  ['╭', 6],
  ['╯', 9],
  ['╮', 12],
] as const)
  STROKES.set(char, { mask, weight: 'light', round: true })
for (const [char, mask] of [
  ['┄', 10],
  ['┈', 10],
  ['╌', 10],
  ['┆', 5],
  ['┊', 5],
  ['╎', 5],
] as const)
  STROKES.set(char, { mask, weight: 'dotted' })
for (const [char, mask] of [
  ['═', 10],
  ['║', 5],
  ['╔', 6],
  ['╗', 12],
  ['╚', 3],
  ['╝', 9],
  ['╠', 7],
  ['╣', 13],
  ['╦', 14],
  ['╩', 11],
  ['╬', 15],
] as const)
  STROKES.set(char, { mask, weight: 'double' })

export interface Cell {
  char: string
  style: Style
  /** The second cell of a wide character. */
  rest?: boolean
  /** What of the cell's strokes is still to draw once a shape has taken its borders. */
  mask?: number
  /** Taken by a shape: drawn by it, not as a letter or a line. */
  taken?: boolean
}

export interface Shape {
  kind: 'box' | 'stadium' | 'group' | 'diamond'
  /** Its cells, corner to corner, inclusive. */
  left: number
  top: number
  right: number
  bottom: number
  dotted: boolean
  /** A group's title, at the cells of its top border it breaks. */
  title?: { from: number; to: number }
}

const maskOf = (cell: Cell | undefined): number =>
  cell ? (cell.mask ?? STROKES.get(cell.char)?.mask ?? 0) : 0
const weightOf = (cell: Cell | undefined): Weight | undefined =>
  cell ? STROKES.get(cell.char)?.weight : undefined

/** Every shape in `cells`, their borders taken off the cells' masks. */
export function findShapes(cells: Cell[][]): Shape[] {
  const shapes: Shape[] = []
  for (let y = 0; y < cells.length; y++) {
    const row = cells[y]!
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]!
      if (cell.taken) continue
      if (maskOf(cell) === (RIGHT | DOWN)) {
        const shape = boxAt(cells, x, y)
        if (shape) shapes.push(take(cells, shape))
      } else if (cell.char === '<') {
        const shape = diamondAt(cells, x, y)
        if (shape) shapes.push(take(cells, shape))
      }
    }
  }
  // A box that holds another is the frame of a group, drawn behind what it holds.
  for (const shape of shapes) {
    if (shape.kind !== 'box') continue
    const holds = shapes.some(
      (other) =>
        other !== shape &&
        other.left > shape.left &&
        other.right < shape.right &&
        other.top > shape.top &&
        other.bottom < shape.bottom,
    )
    if (holds) shape.kind = 'group'
  }
  return shapes
}

/** The box whose top-left corner is at x, y, walked round; null when it does not close. */
function boxAt(cells: Cell[][], x: number, y: number): Shape | null {
  const at = (cx: number, cy: number) => cells[cy]?.[cx]
  const row = cells[y]!
  // The top border, right to its corner. A title may break it: cells that are no line at all.
  let right = x + 1
  let titleFrom = -1
  let titleTo = -1
  while (right < row.length) {
    const mask = maskOf(at(right, y))
    if (mask === 0) {
      if (titleFrom < 0) titleFrom = right
      titleTo = right
      right++
      continue
    }
    if (!(mask & LEFT)) return null
    if (!(mask & RIGHT)) break
    right++
  }
  if (right >= row.length || !(maskOf(at(right, y)) & DOWN)) return null
  // The left side, down to its corner; a stadium's side is `(`.
  let bottom = y + 1
  let stadium = false
  while (bottom < cells.length) {
    const cell = at(x, bottom)
    if (cell?.char === '(') {
      stadium = true
      bottom++
      continue
    }
    const mask = maskOf(cell)
    if (!(mask & UP)) return null
    if (!(mask & DOWN)) break
    bottom++
  }
  if (bottom >= cells.length || !(maskOf(at(x, bottom)) & RIGHT) || bottom - y < 2 || right - x < 2)
    return null
  // The bottom border and the right side close it.
  for (let cx = x + 1; cx < right; cx++)
    if ((maskOf(at(cx, bottom)) & (LEFT | RIGHT)) !== (LEFT | RIGHT)) return null
  if ((maskOf(at(right, bottom)) & (UP | LEFT)) !== (UP | LEFT)) return null
  for (let cy = y + 1; cy < bottom; cy++) {
    const cell = at(right, cy)
    if (stadium ? cell?.char !== ')' : (maskOf(cell) & (UP | DOWN)) !== (UP | DOWN)) return null
  }
  const dotted = weightOf(at(x + 1, bottom)) === 'dotted'
  const shape: Shape = {
    kind: stadium ? 'stadium' : titleFrom >= 0 ? 'group' : 'box',
    left: x,
    top: y,
    right,
    bottom,
    dotted,
  }
  if (titleFrom >= 0) shape.title = { from: titleFrom, to: titleTo }
  return shape
}

/** A decision's diamond: `<` and `>` on its middle row, diagonals above and below them. */
function diamondAt(cells: Cell[][], x: number, y: number): Shape | null {
  const char = (cx: number, cy: number) => cells[cy]?.[cx]?.char ?? ''
  const opens = [x, x + 1].find((cx) => char(cx, y - 1) === '╱' && char(cx, y + 1) === '╲')
  if (opens === undefined) return null
  const row = cells[y]!
  for (let right = x + 2; right < row.length; right++) {
    if (row[right]!.char !== '>') continue
    const closes = [right, right - 1].find(
      (cx) => char(cx, y - 1) === '╲' && char(cx, y + 1) === '╱',
    )
    if (closes !== undefined)
      return { kind: 'diamond', left: x, top: y - 1, right, bottom: y + 1, dotted: false }
  }
  return null
}

/**
 * Takes the shape's borders off its cells: a corner and a side are drawn by the shape, and what a
 * border cell reaches beyond them (an edge leaving it, a compartment's rule) is left to draw.
 */
function take(cells: Cell[][], shape: Shape): Shape {
  const { left, top, right, bottom } = shape
  const keep = (x: number, y: number, border: number) => {
    const cell = cells[y]?.[x]
    if (!cell) return
    const mask = maskOf(cell) & ~border
    cell.mask = mask
    // A border's colour marks a box in a terminal; on a page the stub an edge leaves it by is
    // the edge's own, neutral line.
    if (cell.style.color === 'cyan') {
      const { color: _cyan, ...rest } = cell.style
      cell.style = rest
    }
    if (mask === 0 && (STROKES.has(cell.char) || /[<>()╱╲]/.test(cell.char))) cell.taken = true
  }
  if (shape.kind === 'diamond') {
    for (let x = left; x <= right; x++) {
      keep(x, top, LEFT | RIGHT)
      keep(x, bottom, LEFT | RIGHT)
    }
    keep(left, top + 1, 0)
    keep(right, top + 1, 0)
    for (const x of [left, left + 1, right - 1, right]) {
      for (const y of [top, bottom]) {
        const cell = cells[y]?.[x]
        if (cell && (cell.char === '╱' || cell.char === '╲')) cell.taken = true
      }
    }
    for (const x of [left, right]) {
      const cell = cells[top + 1]?.[x]
      if (cell) cell.taken = true
    }
    return shape
  }
  for (let x = left; x <= right; x++) {
    keep(
      x,
      top,
      (x > left ? LEFT : 0) | (x < right ? RIGHT : 0) | (x === left || x === right ? DOWN : 0),
    )
    keep(
      x,
      bottom,
      (x > left ? LEFT : 0) | (x < right ? RIGHT : 0) | (x === left || x === right ? UP : 0),
    )
  }
  // Rules inside a box (a class's compartments, a cylinder's lid) are the box's, neutral as it is.
  if (shape.kind !== 'group') {
    for (let y = top + 1; y < bottom; y++) {
      for (let x = left + 1; x < right; x++) {
        const cell = cells[y]?.[x]
        if (cell && cell.style.color === 'cyan' && STROKES.has(cell.char)) {
          const { color: _cyan, ...rest } = cell.style
          cell.style = rest
        }
      }
    }
  }
  for (let y = top + 1; y < bottom; y++) {
    for (const x of [left, right]) {
      const cell = cells[y]?.[x]
      if (cell && (cell.char === '(' || cell.char === ')')) cell.taken = true
      else keep(x, y, UP | DOWN)
    }
  }
  return shape
}
