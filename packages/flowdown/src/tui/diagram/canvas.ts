/**
 * The grid of cells a diagram is drawn on. A line is kept not as a character but as the directions
 * it leaves each cell in, so that where lines meet the cell is drawn as the junction they make: an
 * edge that reaches a box joins its border (`┬`), two edges that cross are seen to cross (`┼`),
 * and no drawing order can leave a corner where a tee belongs.
 *
 * Text is laid over the lines, and a character two columns wide takes two cells: a row is never
 * wider than the grid, whatever is written over what.
 */
import { merged, PLAIN, type Line, type Span, type Style } from '../style'
import { charWidth } from '../width'

export const UP = 1
export const RIGHT = 2
export const DOWN = 4
export const LEFT = 8

/** How a line is drawn. A dotted or a thick line keeps its look only where it runs alone. */
export type Ink = 'solid' | 'dotted' | 'thick'

export type Point = readonly [x: number, y: number]

const INKS: Record<Ink, number> = { solid: 1, dotted: 2, thick: 3 }

// Indexed by the directions a cell is left in: up 1, right 2, down 4, left 8.
const LIGHT = ' ╵╶└╷│┌├╴┘─┴┐┤┬┼'
const HEAVY = ' ╹╺┗╻┃┏┣╸┛━┻┓┫┳╋'
const ROUND: Record<number, string> = { 3: '╰', 6: '╭', 9: '╯', 12: '╮' }
const DOTTED: Record<number, string> = { 5: '┆', 10: '┄' }

/** A character that stands for the second column of the one before it. */
const SECOND = ''

export class Canvas {
  readonly width: number
  readonly height: number
  private readonly chars: Array<string | undefined>
  private readonly styles: Array<Style | undefined>
  private readonly lineStyles: Array<Style | undefined>
  private readonly masks: Uint8Array
  private readonly inks: Uint8Array
  private readonly rounds: Uint8Array

  constructor(width: number, height: number) {
    this.width = Math.max(0, width)
    this.height = Math.max(0, height)
    const size = this.width * this.height
    this.chars = Array.from({ length: size }, () => undefined)
    this.styles = Array.from({ length: size }, () => undefined)
    this.lineStyles = Array.from({ length: size }, () => undefined)
    this.masks = new Uint8Array(size)
    this.inks = new Uint8Array(size)
    this.rounds = new Uint8Array(size)
  }

  /**
   * A line through `points`, cell by cell. Two points not in one row or column are joined across
   * first and then up or down. Its corners are rounded unless `round` is false; the style of a
   * cell is that of the first line through it, so a border keeps its colour where an edge joins.
   */
  stroke(points: readonly Point[], ink: Ink, style: Style, round = true): void {
    for (let at = 1; at < points.length; at++) {
      let x = points[at - 1]![0]
      let y = points[at - 1]![1]
      const [toX, toY] = points[at]!
      // Bounded by the grid, whatever the points: a far point is not walked to cell by cell.
      if (Math.abs(toX - x) + Math.abs(toY - y) > 4 * (this.width + this.height)) continue
      while (x !== toX || y !== toY) {
        const dx = x !== toX ? Math.sign(toX - x) : 0
        const dy = dx === 0 ? Math.sign(toY - y) : 0
        this.link(x, y, dx > 0 ? RIGHT : dx < 0 ? LEFT : dy > 0 ? DOWN : UP, ink, style, round)
        x += dx
        y += dy
        this.link(x, y, dx > 0 ? LEFT : dx < 0 ? RIGHT : dy > 0 ? UP : DOWN, ink, style, round)
      }
    }
  }

  /** The outline of a rectangle, from its corner (x, y). */
  rect(x: number, y: number, w: number, h: number, ink: Ink, style: Style, round: boolean): void {
    const right = x + w - 1
    const bottom = y + h - 1
    this.stroke(
      [
        [x, y],
        [right, y],
        [right, bottom],
        [x, bottom],
        [x, y],
      ],
      ink,
      style,
      round,
    )
  }

  /** `text` from (x, y) on, over whatever is there; what would pass the right edge is left out. */
  text(x: number, y: number, text: string, style: Style): void {
    if (y < 0 || y >= this.height) return
    let column = x
    let last = -1
    for (const char of text) {
      const own = charWidth(char)
      if (own === 0) {
        // A mark sits on the character before it, in that character's cell.
        if (last >= 0) this.chars[last] += char
        continue
      }
      if (column + own > this.width) return
      if (column >= 0) {
        const at = y * this.width + column
        this.clear(column, y)
        if (own === 2) this.clear(column + 1, y)
        this.chars[at] = char
        this.styles[at] = style
        if (own === 2) this.chars[at + 1] = SECOND
        last = at
      }
      column += own
    }
  }

  /** Whether no line runs up or down through the cells from (x, y) for `w` columns. */
  across(x: number, y: number, w: number): boolean {
    for (let column = x; column < x + w; column++) {
      if (!this.inside(column, y)) return false
      if (this.masks[y * this.width + column]! & (UP | DOWN)) return false
    }
    return true
  }

  /** Every cell of the rectangle emptied: what was drawn under a note is not seen through it. */
  erase(x: number, y: number, w: number, h: number): void {
    for (let row = Math.max(0, y); row < Math.min(this.height, y + h); row++)
      for (let column = Math.max(0, x); column < Math.min(this.width, x + w); column++) {
        this.clear(column, row)
        const at = row * this.width + column
        this.chars[at] = undefined
        this.masks[at] = 0
        this.inks[at] = 0
      }
  }

  /** The grid as rows, each without the blank cells it ends in. */
  rows(): Line[] {
    const out: Line[] = []
    for (let y = 0; y < this.height; y++) {
      const base = y * this.width
      let end = 0
      for (let x = 0; x < this.width; x++) {
        const char = this.chars[base + x]
        if ((char !== undefined && char !== ' ') || this.masks[base + x]) end = x + 1
      }
      const line: Span[] = []
      for (let x = 0; x < end; x++) {
        const at = base + x
        const char = this.chars[at]
        if (char === SECOND) continue
        if (char !== undefined) line.push({ text: char, style: this.styles[at] ?? PLAIN })
        else if (this.masks[at])
          line.push({ text: this.junction(at), style: this.lineStyles[at] ?? PLAIN })
        else line.push({ text: ' ', style: PLAIN })
      }
      out.push(merged(line))
    }
    return out
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  /** The cell at (x, y) made free of any wide character it is half of. */
  private clear(x: number, y: number): void {
    if (!this.inside(x, y)) return
    const at = y * this.width + x
    if (this.chars[at] === SECOND) {
      this.chars[at - 1] = undefined
      this.chars[at] = undefined
    }
    if (x + 1 < this.width && this.chars[at + 1] === SECOND) this.chars[at + 1] = undefined
  }

  private link(
    x: number,
    y: number,
    direction: number,
    ink: Ink,
    style: Style,
    round: boolean,
  ): void {
    if (!this.inside(x, y)) return
    const at = y * this.width + x
    if (this.masks[at] === 0) this.rounds[at] = round ? 1 : 0
    this.masks[at]! |= direction
    const own = INKS[ink]
    this.inks[at] = this.inks[at] === 0 || this.inks[at] === own ? own : INKS.solid
    this.lineStyles[at] ??= style
  }

  private junction(at: number): string {
    const mask = this.masks[at]!
    const ink = this.inks[at]
    if (ink === INKS.thick) return HEAVY[mask]!
    if (ink === INKS.dotted && DOTTED[mask]) return DOTTED[mask]!
    if (this.rounds[at] && ROUND[mask]) return ROUND[mask]!
    return LIGHT[mask]!
  }
}
