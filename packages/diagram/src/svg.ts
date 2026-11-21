/**
 * A diagram as SVG for a page, drawn from the very layout a terminal shows: the cells of the
 * terminal drawing (`terminal/`) turned into shapes. Boxes become rounded, lightly filled
 * rectangles, a decision a diamond, a subgraph a soft panel with its title; the lines between them
 * become thin paths with small heads, blocks become bars, letters a sans-serif text set where the
 * terminal set them (labels centred in their boxes). The look is the page's own: every colour is
 * `currentColor` at an opacity, or a class a page can set, so a diagram fits a light or a dark page.
 *
 * The SVG carries no script, no `<style>` and no link: it sits safely in any page.
 */
import {
  DOWN,
  findShapes,
  LEFT,
  RIGHT,
  STROKES,
  UP,
  type Cell,
  type Shape,
  type Stroke,
} from './shapes'
import type { Colour, Line, Style } from './style'
import { charWidth } from './width'

/** A cell's width and height in px: the terminal's grid, at the 13px a label is set in. */
const X = 7.8
const Y = 18
const FONT = 13
const SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
/** Colours a page may override by class (`fd-diagram-<name>`): calm, and readable on light or dark. */
export const COLOURS: Record<Colour, string> = {
  red: '#e5484d',
  green: '#30a46c',
  yellow: '#e2a336',
  cyan: '#0090ff',
  magenta: '#8e4ec6',
}
const ACCENT = '#3e63dd'

interface Head {
  side: number
  open: boolean
}
/** Arrowheads: the side of the cell the point touches, and whether the head is drawn open. */
const HEADS = new Map<string, Head>([
  ...[...'▶►▸'].map((char): [string, Head] => [char, { side: RIGHT, open: false }]),
  ...[...'◀◄◂'].map((char): [string, Head] => [char, { side: LEFT, open: false }]),
  ...[...'▲▴'].map((char): [string, Head] => [char, { side: UP, open: false }]),
  ...[...'▼▾'].map((char): [string, Head] => [char, { side: DOWN, open: false }]),
  ['▷', { side: RIGHT, open: true }],
  ['◁', { side: LEFT, open: true }],
  ['△', { side: UP, open: true }],
  ['▽', { side: DOWN, open: true }],
])
/** Blocks: the part of the cell they fill (x, y, width, height as fractions) and how solidly. */
type Block = [number, number, number, number, number]
const EIGHTHS = [1, 2, 3, 5, 6, 7]
const BLOCKS = new Map<string, Block>([
  ['█', [0, 0, 1, 1, 1]],
  ['▓', [0, 0, 1, 1, 0.7]],
  ['▒', [0, 0, 1, 1, 0.45]],
  ['░', [0, 0, 1, 1, 0.22]],
  ['▀', [0, 0, 1, 0.5, 1]],
  ['▄', [0, 0.5, 1, 0.5, 1]],
  ['▐', [0.5, 0, 0.5, 1, 1]],
  ...[...'▏▎▍▌▋▊▉'].map((char, at): [string, Block] => [char, [0, 0, (at + 1) / 8, 1, 1]]),
  ...[...'▁▂▃▅▆▇'].map((char, at): [string, Block] => [
    char,
    [0, 1 - EIGHTHS[at]! / 8, 1, EIGHTHS[at]! / 8, 1],
  ]),
])

/** Marks a terminal draws as letters (a commit, a score, a point): shapes on a page, in their cell. */
const MARKS: Record<string, (cx: number, cy: number, style: string) => string> = {
  '●': (cx, cy, style) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="3.6"${style}/>`,
  '•': (cx, cy, style) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="2"${style || ' opacity="0.5"'}/>`,
  '○': (cx, cy, style) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="3.4" fill="none" stroke="currentColor" stroke-width="1.2"${style}/>`,
  '◯': (cx, cy, style) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"${style}/>`,
  '◉': (cx, cy, style) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="4.4" fill="none" stroke="currentColor" stroke-width="1.2"${style}/><circle cx="${n(cx)}" cy="${n(cy)}" r="2.2"${style}/>`,
  '◆': (cx, cy, style) => `<path d="M${n(cx)} ${n(cy - 4.5)}l4.5 4.5-4.5 4.5-4.5-4.5Z"${style}/>`,
  '◇': (cx, cy, style) =>
    `<path d="M${n(cx)} ${n(cy - 4.5)}l4.5 4.5-4.5 4.5-4.5-4.5Z" fill="none" stroke="currentColor" stroke-width="1.2"${style}/>`,
  '■': (cx, cy, style) =>
    `<rect x="${n(cx - 4)}" y="${n(cy - 4)}" width="8" height="8" rx="2"${style}/>`,
  '□': (cx, cy, style) =>
    `<rect x="${n(cx - 4)}" y="${n(cy - 4)}" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"${style}/>`,
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escape = (text: string): string => text.replace(/[&<>"]/g, (char) => ESCAPES[char]!)
const n = (value: number): string => String(Math.round(value * 100) / 100)
const sameStyle = (a: Style, b: Style): boolean =>
  a.bold === b.bold && a.dim === b.dim && a.italic === b.italic && a.color === b.color

/** A text's colour. Yellow marks a label in a terminal; on a page a label is the text, quieter. */
function textPaint(style: Style): string {
  if (style.color && style.color !== 'yellow')
    return ` class="fd-diagram-${style.color}" fill="${COLOURS[style.color]}"`
  if (style.color === 'yellow' || style.dim) return ' fill-opacity="0.62"'
  return ''
}
/** A head's colour: its edge's, at the edge's quiet. */
function headPaint(style: Style): string {
  const own = textPaint(style)
  return own.includes('fill-opacity') ? own : `${own} fill-opacity="0.6"`
}
/** A line's colour: its own, or the text's, quieter than the text. */
function linePaint(style: Style, opacity: number): string {
  if (style.color && style.color !== 'yellow')
    return ` class="fd-diagram-${style.color}" stroke="${COLOURS[style.color]}"`
  return ` stroke="currentColor" stroke-opacity="${n(style.dim ? opacity * 0.7 : opacity)}"`
}

function grid(lines: readonly Line[]): Cell[][] {
  return lines.map((line) => {
    const cells: Cell[] = []
    for (const span of line) {
      for (const char of span.text) {
        const width = charWidth(char)
        if (width === 0) {
          const last = cells.at(-1)
          if (last) last.char += char
          continue
        }
        cells.push({ char, style: span.style })
        if (width === 2) cells.push({ char: '', style: span.style, rest: true })
      }
    }
    return cells
  })
}

/** A cell's stroke and what of it is still to draw, unless a shape took the cell whole. */
function strokeOf(cell: Cell | undefined): (Stroke & { live: number }) | undefined {
  if (!cell || cell.taken) return undefined
  const stroke = STROKES.get(cell.char)
  return stroke && { ...stroke, live: cell.mask ?? stroke.mask }
}

type Spans = Map<string, Array<[number, number]>>
const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

/** `lines` (a terminal drawing) as an SVG document, `title` its accessible name. */
export function cellsToSVG(lines: readonly Line[], title = ''): string {
  const cells = grid(lines)
  const columns = Math.max(0, ...cells.map((row) => row.length))
  const shapes = findShapes(cells)
  const back = shapes
    .toSorted((a, b) => Number(b.kind === 'group') - Number(a.kind === 'group'))
    .map((shape) => drawShape(shape, cells))
  const out = [
    ...strokes(cells, columns),
    ...bars(cells),
    ...heads(cells),
    ...marks(cells),
    ...texts(cells, shapes),
  ]
  const width = columns * X + 8
  const height = cells.length * Y + 8
  const label = title ? ` aria-label="${escape(title)}"` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" role="img"${label} class="fd-diagram" fill="currentColor" font-family="${SANS}" font-size="${FONT}">` +
    (title ? `<title>${escape(title)}</title>` : '') +
    back.join('') +
    out.join('') +
    '</svg>'
  )
}

/**
 * The lines no shape took: every cell reaches from its middle to the sides it still names; halves
 * that touch on a row or a column are one line, and a rounded corner turns through its middle.
 */
function strokes(cells: Cell[][], columns: number): string[] {
  const paths = new Map<string, string[]>()
  const keyOf = (weight: Stroke['weight'], style: Style) =>
    `${weight}|${style.color ?? ''}|${style.dim ? 1 : 0}`
  const across: Spans = new Map()
  const down: Spans = new Map()
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < columns; x++) {
      const cell = cells[y]![x]
      const stroke = strokeOf(cell)
      if (!cell) continue
      const cx = (x + 0.5) * X
      const cy = (y + 0.5) * Y
      if ((cell.char === '╱' || cell.char === '╲') && !cell.taken) {
        // A diagonal no shape took: a plot's line, a slanted edge.
        const up = cell.char === '╱'
        push(
          paths,
          keyOf('light', cell.style),
          `M${n(x * X)} ${n((up ? y + 1 : y) * Y)}L${n((x + 1) * X)} ${n((up ? y : y + 1) * Y)}`,
        )
        continue
      }
      if (!stroke || stroke.live === 0) continue
      const key = keyOf(stroke.weight, cell.style)
      if (stroke.round && stroke.live === stroke.mask) {
        const r = Math.min(X, Y) * 0.6
        const right = (stroke.mask & RIGHT) !== 0
        const lower = (stroke.mask & DOWN) !== 0
        push(
          paths,
          key,
          `M${n(right ? (x + 1) * X : x * X)} ${n(cy)}H${n(right ? cx + r : cx - r)}Q${n(cx)} ${n(cy)} ${n(cx)} ${n(lower ? cy + r : cy - r)}V${n(lower ? (y + 1) * Y : y * Y)}`,
        )
        continue
      }
      if (stroke.live & LEFT) push(across, `${key}|${n(cy)}`, [x * X, cx] as [number, number])
      if (stroke.live & RIGHT)
        push(across, `${key}|${n(cy)}`, [cx, (x + 1) * X] as [number, number])
      if (stroke.live & UP) push(down, `${key}|${n(cx)}`, [y * Y, cy] as [number, number])
      if (stroke.live & DOWN) push(down, `${key}|${n(cx)}`, [cy, (y + 1) * Y] as [number, number])
    }
  }
  for (const [spans, horizontal] of [
    [across, true],
    [down, false],
  ] as const) {
    for (const [lineKey, list] of spans) {
      const cut = lineKey.lastIndexOf('|')
      const key = lineKey.slice(0, cut)
      const fixed = lineKey.slice(cut + 1)
      list.sort((a, b) => a[0] - b[0])
      let [from, to] = list[0]!
      const flush = () =>
        push(
          paths,
          key,
          horizontal ? `M${n(from)} ${fixed}H${n(to)}` : `M${fixed} ${n(from)}V${n(to)}`,
        )
      for (const [start, end] of list.slice(1)) {
        if (start <= to + 0.01) to = Math.max(to, end)
        else {
          flush()
          from = start
          to = end
        }
      }
      flush()
    }
  }
  return [...paths].map(([key, list]) => {
    const [weight, color, dim] = key.split('|') as [Stroke['weight'], Colour | '', string]
    const style: Style = color ? { color } : dim === '1' ? { dim: true } : {}
    const width = weight === 'heavy' ? 2.2 : weight === 'double' ? 1.8 : 1.2
    const dash = weight === 'dotted' ? ' stroke-dasharray="4 3"' : ''
    return `<path d="${list.join('')}" fill="none" stroke-width="${width}"${dash} stroke-linecap="round" stroke-linejoin="round"${linePaint(style, 0.5)}/>`
  })
}

/** A shape as one element, its borders through the middles of its border cells. */
function drawShape(shape: Shape, cells: Cell[][]): string {
  const x1 = (shape.left + 0.5) * X
  const x2 = (shape.right + 0.5) * X
  const y1 = (shape.top + 0.5) * Y
  const y2 = (shape.bottom + 0.5) * Y
  const colour = cells[shape.top]?.[shape.left]?.style.color
  const own = colour && colour !== 'yellow' && colour !== 'cyan' ? colour : null
  const tint = own
    ? ` class="fd-diagram-${own}" fill="${COLOURS[own]}" fill-opacity="0.1"`
    : ' fill="currentColor" fill-opacity="0.045"'
  const edge = own ? ` stroke="${COLOURS[own]}"` : ' stroke="currentColor" stroke-opacity="0.32"'
  const dash = shape.dotted ? ' stroke-dasharray="4 3"' : ''
  if (shape.kind === 'group') {
    return `<rect x="${n(x1)}" y="${n(y1)}" width="${n(x2 - x1)}" height="${n(y2 - y1)}" rx="10" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.12"${dash}/>`
  }
  if (shape.kind === 'diamond') {
    const middle = (shape.top + 1.5) * Y
    const points = [
      [shape.left * X + 1, middle],
      [(shape.left + 1.5) * X, y1],
      [(shape.right - 0.5) * X, y1],
      [(shape.right + 1) * X - 1, middle],
      [(shape.right - 0.5) * X, y2],
      [(shape.left + 1.5) * X, y2],
    ]
    return `<polygon points="${points.map(([px, py]) => `${n(px!)},${n(py!)}`).join(' ')}" stroke-width="1.2" stroke-linejoin="round"${tint}${edge}/>`
  }
  const radius = shape.kind === 'stadium' ? (y2 - y1) / 2 : 6
  return `<rect x="${n(x1)}" y="${n(y1)}" width="${n(x2 - x1)}" height="${n(y2 - y1)}" rx="${n(radius)}" stroke-width="1.2"${dash}${tint}${edge}/>`
}

interface Bar {
  x: number
  y: number
  w: number
  h: number
  solid: number
  style: Style
}

/** Blocks as bars: a run along a row is one, and the same run down a column one taller bar. */
function bars(cells: Cell[][]): string[] {
  const open = new Map<string, Bar>()
  const done: Bar[] = []
  cells.forEach((row, y) => {
    const seen = new Set<string>()
    let x = 0
    while (x < row.length) {
      const cell = row[x]!
      const block = BLOCKS.get(cell.char)
      if (!block) {
        x++
        continue
      }
      let end = x
      while (
        end + 1 < row.length &&
        row[end + 1]!.char === cell.char &&
        block[2] === 1 &&
        sameStyle(row[end + 1]!.style, cell.style)
      )
        end++
      // The eighth that ends a bar (`████▍`) is the bar's last part, not a bar of its own.
      const tail =
        block[2] === 1 && block[3] === 1 ? BLOCKS.get(row[end + 1]?.char ?? '') : undefined
      const extra =
        tail &&
        tail[0] === 0 &&
        tail[2] < 1 &&
        tail[3] === 1 &&
        sameStyle(row[end + 1]!.style, cell.style)
          ? tail[2]
          : 0
      const [bx, by, bw, bh, own] = block
      // An eighth that ends a bar of shade is that shade: it is the bar's last part.
      const before = BLOCKS.get(row[x - 1]?.char ?? '')
      const solid = own === 1 && bw < 1 && before && before[4] < 1 ? before[4] : own
      const bar: Bar = {
        x: (x + bx) * X,
        y: (y + by) * Y,
        w: (end - x + bw + extra) * X,
        h: bh * Y,
        solid,
        style: cell.style,
      }
      const key = `${n(bar.x)}|${n(bar.w)}|${solid}|${cell.style.color ?? ''}|${cell.style.dim ? 1 : 0}`
      const above = open.get(key)
      if (above && by === 0 && Math.abs(above.y + above.h - bar.y) < 0.01) above.h += bar.h
      else {
        if (above) done.push(above)
        open.set(key, bar)
      }
      seen.add(key)
      x = end + 1 + (extra > 0 ? 1 : 0)
    }
    for (const [key, bar] of open) {
      if (seen.has(key)) continue
      done.push(bar)
      open.delete(key)
    }
  })
  done.push(...open.values())
  return done.map((bar) => {
    const colour = bar.style.color
      ? ` class="fd-diagram-${bar.style.color}" fill="${COLOURS[bar.style.color]}"`
      : ` class="fd-diagram-bar" fill="${ACCENT}"`
    const solid = bar.solid * (bar.style.dim ? 0.55 : 0.9)
    // A bar a row tall keeps a little air above and below, so rows of bars read apart.
    const inset = bar.h > Y * 0.9 && bar.h < Y * 1.1 ? 2.5 : 0
    return `<rect x="${n(bar.x)}" y="${n(bar.y + inset)}" width="${n(bar.w)}" height="${n(Math.max(1, bar.h - inset * 2))}" rx="${n(Math.min(3, bar.w / 2))}" fill-opacity="${n(solid)}"${colour}/>`
  })
}

/** Arrowheads: small triangles whose point meets what they point at, with the stem that leads in. */
function heads(cells: Cell[][]): string[] {
  const out: string[] = []
  cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      const head = HEADS.get(cell.char)
      if (!head) return
      const behind =
        head.side === RIGHT
          ? row[x - 1]
          : head.side === LEFT
            ? row[x + 1]
            : head.side === DOWN
              ? cells[y - 1]?.[x]
              : cells[y + 1]?.[x]
      const stem = ((strokeOf(behind)?.live ?? 0) & head.side) !== 0
      const left = x * X
      const top = y * Y
      const cx = left + X / 2
      const cy = top + Y / 2
      const [half, long] = [3.6, 7]
      const [tx, ty] =
        head.side === RIGHT
          ? [left + X, cy]
          : head.side === LEFT
            ? [left, cy]
            : head.side === DOWN
              ? [cx, top + Y]
              : [cx, top]
      const back = head.side === RIGHT || head.side === DOWN ? -long : long
      const points =
        head.side === RIGHT || head.side === LEFT
          ? [
              [tx, ty],
              [tx + back, ty - half],
              [tx + back, ty + half],
            ]
          : [
              [tx, ty],
              [tx - half, ty + back],
              [tx + half, ty + back],
            ]
      const stemPath =
        head.side === RIGHT || head.side === LEFT
          ? `M${n(head.side === RIGHT ? left : left + X)} ${n(cy)}H${n(tx + back)}`
          : `M${n(cx)} ${n(head.side === DOWN ? top : top + Y)}V${n(ty + back)}`
      if (stem) out.push(`<path d="${stemPath}" stroke-width="1.2"${linePaint(cell.style, 0.5)}/>`)
      const list = points.map(([px, py]) => `${n(px!)},${n(py!)}`).join(' ')
      out.push(
        head.open
          ? `<polygon points="${list}" fill="none" stroke-width="1.2" stroke-linejoin="round"${linePaint(cell.style, 0.6)}/>`
          : `<polygon points="${list}" stroke-linejoin="round"${headPaint(cell.style)}/>`,
      )
    }),
  )
  return out
}

const drawn = (cell: Cell): boolean =>
  cell.rest === true ||
  cell.taken === true ||
  STROKES.has(cell.char) ||
  BLOCKS.has(cell.char) ||
  HEADS.has(cell.char) ||
  cell.char in MARKS

/** Marks as shapes, coloured as their letters were (a stroke's colour for an open one). */
function marks(cells: Cell[][]): string[] {
  const out: string[] = []
  cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      const mark = MARKS[cell.char]
      if (!mark) return
      const own = cell.style.color && cell.style.color !== 'yellow' ? cell.style.color : null
      const style = own
        ? ` class="fd-diagram-${own}" color="${COLOURS[own]}"`
        : cell.style.dim
          ? ' opacity="0.55"'
          : ''
      out.push(mark((x + 0.5) * X, (y + 0.5) * Y, style))
    }),
  )
  return out
}
const cellWidth = (text: string) =>
  [...text].reduce((sum, char) => sum + Math.max(1, charWidth(char)), 0)

/**
 * Letters, in pieces between runs of two or more spaces (SVG would fold the spaces). A piece the
 * terminal centred in its box, or set on an edge, is centred where it was; any other starts where
 * it started, so a list or a column stays aligned.
 */
function texts(cells: Cell[][], shapes: Shape[]): string[] {
  const out: string[] = []
  cells.forEach((row, y) => {
    const baseline = (y + 0.5) * Y + FONT * 0.36
    let x = 0
    while (x < row.length) {
      if (drawn(row[x]!)) {
        x++
        continue
      }
      const start = x
      const style = row[x]!.style
      let text = ''
      while (x < row.length && !drawn(row[x]!) && sameStyle(row[x]!.style, style))
        text += row[x++]!.char
      let offset = 0
      for (const piece of text.split(/( {2,})/)) {
        const body = piece.trim()
        if (body) {
          const from = start + offset + cellWidth(piece) - cellWidth(piece.trimStart())
          const to = from + cellWidth(body)
          const weight = style.bold ? ' font-weight="600"' : ''
          const italic = style.italic ? ' font-style="italic"' : ''
          const anchor = centred(cells, shapes, from, to, y)
            ? ` x="${n(((from + to) / 2) * X)}" text-anchor="middle"`
            : ` x="${n(from * X)}"`
          out.push(
            `<text${anchor} y="${n(baseline)}"${weight}${italic}${textPaint(style)}>${escape(body)}</text>`,
          )
        }
        offset += cellWidth(piece)
      }
    }
  })
  return out
}

/** Whether text from `from` to `to` on row `y` is centred: in its box, or on an edge. */
function centred(cells: Cell[][], shapes: Shape[], from: number, to: number, y: number): boolean {
  const box = shapes.find(
    (shape) =>
      shape.kind !== 'group' &&
      y > shape.top &&
      y < shape.bottom &&
      from > shape.left &&
      to <= shape.right,
  )
  if (box) {
    // A rule across the box (`├───┤`) parts its compartments: the first holds its name, centred;
    // the others hold fields, which start at the left as the terminal set them.
    let rule = -1
    for (let row = box.top + 1; row < box.bottom; row++) {
      if ((strokeOf(cells[row]?.[box.left])?.live ?? 0) & RIGHT) {
        rule = row
        break
      }
    }
    if (rule >= 0) return y < rule
    return Math.abs(from - box.left - 1 - (box.right - to)) <= 1
  }
  // On an edge: a line runs into the text's middle from above or below, or into both its ends.
  const middle = Math.floor((from + to - 1) / 2)
  const vertical = (cy: number) => ((strokeOf(cells[cy]?.[middle])?.live ?? 0) & (UP | DOWN)) !== 0
  const beside =
    ((strokeOf(cells[y]?.[from - 1])?.live ?? 0) & RIGHT) !== 0 &&
    ((strokeOf(cells[y]?.[to])?.live ?? 0) & LEFT) !== 0
  return vertical(y - 1) || vertical(y + 1) || beside
}
