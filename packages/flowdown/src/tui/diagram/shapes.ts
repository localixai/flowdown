/**
 * How each shape of node is drawn in cells. A terminal has no curve and no slant to spare, so a
 * shape is told by its corners and its sides, and every one keeps a box's outline, which edges
 * join: `[x]` square, `(x)` rounded, `([x])` and `((x))` with round sides, `{x}` with a diamond's
 * points, `[[x]]` with inner walls, `[(x)]` a drum with its lid, `>x]` a flag.
 *
 * The other diagrams add what a flowchart has no form for: a mark of one cell where a state
 * machine starts (`●`), ends (`◉`) or chooses (`◇`), a bar where it forks and joins, and a box of
 * compartments, each under a rule, for a class's members or an entity's columns.
 */
import type { Canvas, Ink } from './canvas'
import type { Shape } from './parse'
import { BOLD, PLAIN, type Style } from '../style'
import { width } from '../width'
import { widest } from './text'

export interface Box {
  width: number
  height: number
}

/** The shapes drawn as one character, and the character each is. */
const MARKS: Partial<Record<Shape, string>> = { start: '●', stop: '◉', choice: '◇', dot: '•' }
/** How long a fork's or a join's bar is: long enough to be seen as one, short enough to fit. */
const BAR = 7

/**
 * The box `lines` take in `shape`, with at least `rows` rows inside, and `parts` under them. A
 * bar is long across and one cell along: a caller laying out across the screen turns it.
 */
export function boxSize(
  shape: Shape,
  lines: readonly string[],
  rows = 1,
  parts: readonly string[][] = [],
): Box {
  if (MARKS[shape]) return { width: 1, height: 1 }
  if (shape === 'bar') return { width: BAR, height: 1 }
  const inner = shape === 'subroutine' || shape === 'circle' ? 2 : 0
  const lid = shape === 'cylinder' ? 1 : 0
  const ruled = parts.reduce((sum, part) => sum + 1 + part.length, 0)
  return {
    width: Math.max(1, widest(lines), ...parts.map(widest)) + 4 + inner,
    height: Math.max(rows, Math.max(lines.length, 1) + ruled) + 2 + lid,
  }
}

const ROUNDED: ReadonlySet<Shape> = new Set(['round', 'stadium', 'circle', 'cylinder'])

/** The sides drawn as characters, not lines: an edge that reaches them stops beside them. */
const SIDES: Partial<Record<Shape, readonly [string, string]>> = {
  stadium: ['(', ')'],
  circle: ['(', ')'],
  diamond: ['<', '>'],
  flag: ['>', '│'],
  slant: ['/', '/'],
}

/**
 * A node drawn in the box at (x, y): its outline in `border` and `ink`, its label centred, plain,
 * or bold over compartments, which are written from their left under their rules.
 */
export function drawBox(
  canvas: Canvas,
  x: number,
  y: number,
  box: Box,
  shape: Shape,
  lines: readonly string[],
  border: Style,
  parts: readonly string[][] = [],
  ink: Ink = 'solid',
): void {
  const mark = MARKS[shape]
  if (mark) {
    canvas.text(x, y, mark, border)
    return
  }
  if (shape === 'bar') {
    // Written, not stroked: an edge that meets a bar stops at it, and the bar stays one line.
    if (box.height === 1) canvas.text(x, y, '━'.repeat(box.width), border)
    else for (let row = y; row < y + box.height; row++) canvas.text(x, row, '┃', border)
    return
  }
  const right = x + box.width - 1
  const bottom = y + box.height - 1
  canvas.rect(x, y, box.width, box.height, ink, border, ROUNDED.has(shape))
  if (shape === 'subroutine')
    for (const wall of [x + 1, right - 1])
      canvas.stroke(
        [
          [wall, y],
          [wall, bottom],
        ],
        'solid',
        border,
      )
  if (shape === 'cylinder')
    canvas.stroke(
      [
        [x, y + 1],
        [right, y + 1],
      ],
      'solid',
      border,
    )
  const top = y + 1 + (shape === 'cylinder' ? 1 : 0)
  const rules = new Set<number>()
  let row = top + Math.max(lines.length, 1)
  for (const part of parts) {
    rules.add(row)
    row += 1 + part.length
  }
  const sides = SIDES[shape]
  if (sides)
    for (let side = y + 1; side < bottom; side++) {
      if (rules.has(side)) continue
      canvas.text(x, side, sides[0], border)
      canvas.text(right, side, sides[1], border)
    }
  if (shape === 'diamond') {
    canvas.text(x, y, '╱', border)
    canvas.text(right, y, '╲', border)
    canvas.text(x, bottom, '╲', border)
    canvas.text(right, bottom, '╱', border)
  }
  if (parts.length === 0) {
    const room = bottom - top
    const first = top + Math.floor((room - lines.length) / 2)
    lines.forEach((line, at) => {
      canvas.text(x + Math.floor((box.width - width(line)) / 2), first + at, line, PLAIN)
    })
    return
  }
  // The label heads the box and the compartments follow it down; rows to spare are left under
  // the last, as a class's empty room is.
  lines.forEach((line, at) => {
    canvas.text(x + Math.floor((box.width - width(line)) / 2), top + at, line, BOLD)
  })
  row = top + Math.max(lines.length, 1)
  for (const part of parts) {
    canvas.stroke(
      [
        [x, row],
        [right, row],
      ],
      'solid',
      border,
    )
    part.forEach((line, at) => canvas.text(x + 2, row + 1 + at, line, PLAIN))
    row += 1 + part.length
  }
}
