/**
 * A display formula on rows of a terminal. A terminal has one size of letter, but a display has
 * the rows a sentence does not: a fraction stands over its rule, a sum has its limits above and
 * below, a root's bar runs over what it takes, a matrix stands in brackets as tall as its rows,
 * a brace runs under what it counts with its label under it.
 *
 *          n                 ⎛a₁₁  a₁₂⎞
 *     1    ∑  rᵢ         A = ⎜        ⎟     1 + 1 + ⋯ + 1
 *     ── · i=1               ⎝a₂₁  a₂₂⎠     ╰─────┬─────╯
 *     k                                        n times
 *
 * What one row says as well stays on it (`x²`, `aᵢ`). Built of boxes, each with the row its
 * baseline is on; a formula wider than `columns` is written on one line instead.
 */
import { inVariant } from './letters'
import { parse } from './parse'
import { line, scripted, SUB, SUPER } from './text'
import type { MathNode, Variant } from './tree'

interface Box {
  rows: string[]
  /** The row the box's baseline is on. */
  base: number
  width: number
}

const MARKS = /\p{M}/u
/** Cells a text takes: a combining mark takes none. */
export const cells = (text: string): number => {
  let count = 0
  for (const char of text) if (!MARKS.test(char)) count++
  return count
}
const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - cells(text)))
const center = (text: string, width: number): string => {
  const room = Math.max(0, width - cells(text))
  return ' '.repeat(Math.floor(room / 2)) + text + ' '.repeat(room - Math.floor(room / 2))
}

const flat = (text: string): Box => ({ rows: [text], base: 0, width: cells(text) })

/** Boxes side by side, on one baseline. */
function beside(boxes: Box[]): Box {
  const live = boxes.filter((part) => part.width > 0 || part.rows.length > 1)
  if (live.length === 0) return flat('')
  const above = Math.max(...live.map((part) => part.base))
  const below = Math.max(...live.map((part) => part.rows.length - 1 - part.base))
  const rows = Array.from({ length: above + below + 1 }, () => '')
  for (const part of live) {
    for (let at = 0; at < rows.length; at++) rows[at] += pad(part.rows[at - above + part.base] ?? '', part.width)
  }
  return { rows, base: above, width: live.reduce((sum, part) => sum + part.width, 0) }
}

/** Boxes one over another, centred (or as `align` says), the baseline on the row `base` names. */
function over(boxes: Box[], base: number, align: 'center' | 'left' | 'right' = 'center'): Box {
  const width = Math.max(0, ...boxes.map((part) => part.width))
  const rows: string[] = []
  let baseRow = 0
  boxes.forEach((part, at) => {
    if (at === base) baseRow = rows.length + part.base
    for (const text of part.rows) rows.push(align === 'center' ? center(text, width) : align === 'left' ? pad(text, width) : ' '.repeat(width - cells(text)) + text)
  })
  return { rows, base: baseRow, width }
}

/** A delimiter as tall as `height` rows, its middle on `base`. */
function delimiter(char: string, height: number, base: number): Box {
  if (!char) return flat('')
  if (height <= 1) return flat(char)
  const pieces: Record<string, [string, string, string, string?]> = {
    '(': ['⎛', '⎜', '⎝'], ')': ['⎞', '⎟', '⎠'], '[': ['⎡', '⎢', '⎣'], ']': ['⎤', '⎥', '⎦'],
    '{': ['⎧', '⎪', '⎩', '⎨'], '}': ['⎫', '⎪', '⎭', '⎬'], '⌊': ['│', '│', '└'], '⌋': ['│', '│', '┘'],
    '⌈': ['┌', '│', '│'], '⌉': ['┐', '│', '│'], '|': ['│', '│', '│'], '‖': ['‖', '‖', '‖'],
    '⟨': ['╱', '⟨', '╲'], '⟩': ['╲', '⟩', '╱'],
  }
  const piece = pieces[char]
  if (!piece) return { rows: Array.from({ length: height }, () => char), base, width: cells(char) }
  if ((char === '{' || char === '}') && height === 2) return { rows: char === '{' ? ['⎰', '⎱'] : ['⎱', '⎰'], base, width: 1 }
  const rows = Array.from({ length: height }, (_, at) => (at === 0 ? piece[0] : at === height - 1 ? piece[2] : piece[1]))
  if (piece[3]) rows[Math.floor((height - 1) / 2)] = piece[3]
  if (char === '⟨' || char === '⟩') rows.fill(char === '⟨' ? '⟨' : '⟩')
  return { rows, base, width: 1 }
}

const SPACED = new Set(['bin', 'rel'])

function box(node: MathNode, variant: Variant | null, tight = false): Box {
  switch (node.type) {
    case 'row':
      return rowBox(node.children, variant, tight)
    case 'operator':
      return flat(node.kind === 'bin' || node.kind === 'rel' ? (tight ? node.text : ` ${node.text} `) : node.text)
    case 'function':
      return flat(node.text)
    case 'fraction': {
      const top = box(node.numerator, variant, tight)
      const bottom = box(node.denominator, variant, tight)
      const width = Math.max(top.width, bottom.width)
      if (!node.rule) return over([top, bottom], 0)
      return over([top, flat('─'.repeat(width)), bottom], 1)
    }
    case 'root': {
      const body = box(node.body, variant)
      const index = node.index ? scripted(line(node.index, variant), SUPER, '') : ''
      if (body.rows.length === 1) {
        const lead = ' '.repeat(cells(index) + 1)
        return { rows: [lead + '_'.repeat(body.width), `${index}√${body.rows[0]!}`], base: 1, width: cells(index) + 1 + body.width }
      }
      const lead = ' '.repeat(cells(index))
      const rows = [`${lead} ┌${'─'.repeat(body.width + 1)}`, ...body.rows.map((text, at) => `${at === body.rows.length - 1 ? `${index}√` : `${lead} `}│ ${text}`)]
      return { rows, base: body.base + 1, width: cells(index) + 3 + body.width }
    }
    case 'scripts':
      return scriptsBox(node, variant)
    case 'accent': {
      const base = box(node.base, variant)
      if (node.char === '⏟' || node.char === '⏞') {
        const brace = node.char === '⏟' ? braceRow(base.width, false) : braceRow(base.width, true)
        return node.char === '⏟' ? over([base, flat(brace)], 0) : over([flat(brace), base], 1)
      }
      if (base.rows.length === 1 && base.width === 1 && /^[̀-ͯ⃐-⃿]$/.test(node.char)) return flat(`${base.rows[0]}${node.char}`)
      const wide: Record<string, string> = { '̂': '^', '̃': '~', '̌': 'ˇ' }
      const sign = wide[node.char]
      if (sign) return over([flat(center(sign, base.width)), base], 1)
      const mark = node.char === '→' || node.char === '⃗' ? `${'─'.repeat(Math.max(0, base.width - 1))}→` : node.char === '←' ? `←${'─'.repeat(Math.max(0, base.width - 1))}` : '‾'.repeat(base.width)
      return node.under ? over([base, flat(mark)], 0) : over([flat(mark), base], 1)
    }
    case 'stack': {
      const base = box(node.base, variant)
      const top = node.over ? box(node.over, variant, true) : null
      const bottom = node.under ? box(node.under, variant, true) : null
      const arrow = node.base.type === 'operator' && node.base.stretchy
      const width = Math.max(top?.width ?? 0, bottom?.width ?? 0)
      const middle = arrow ? flat(` ${'─'.repeat(width + 1)}${node.base.type === 'operator' ? node.base.text : ''} `) : base
      const parts = [top, middle, bottom].filter((part): part is Box => part !== null)
      return over(parts, top ? 1 : 0)
    }
    case 'fenced': {
      const body = box(node.body, variant)
      const height = body.rows.length
      return beside([delimiter(node.open, height, body.base), body, delimiter(node.close, height, body.base)])
    }
    case 'table':
      return tableBox(node, variant)
    case 'variant':
      return box(node.body, node.variant)
    case 'style':
    case 'color':
      return box(node.body, variant)
    case 'boxed': {
      const body = box(node.body, variant)
      return {
        rows: [`┌${'─'.repeat(body.width + 2)}┐`, ...body.rows.map((text) => `│ ${pad(text, body.width)} │`), `└${'─'.repeat(body.width + 2)}┘`],
        base: body.base + 1,
        width: body.width + 4,
      }
    }
    case 'phantom': {
      const body = box(node.body, variant)
      return { rows: body.rows.map(() => ' '.repeat(body.width)), base: body.base, width: body.width }
    }
    case 'identifier':
      return flat(variant && variant !== 'italic' && variant !== 'normal' ? inVariant(node.text, variant) : node.text)
    default:
      return flat(line(node, variant))
  }
}

const braceRow = (width: number, up: boolean): string => {
  if (width < 3) return '─'.repeat(width)
  const half = Math.floor((width - 3) / 2)
  return up ? `╭${'─'.repeat(half)}┴${'─'.repeat(width - 3 - half)}╮` : `╰${'─'.repeat(half)}┬${'─'.repeat(width - 3 - half)}╯`
}

const UNARY_AFTER = new Set(['bin', 'rel', 'open', 'punct', 'op'])

function rowBox(children: MathNode[], variant: Variant | null, tight: boolean): Box {
  const boxes: Box[] = []
  children.forEach((child, at) => {
    const previous = children[at - 1]
    if (child.type === 'operator' && SPACED.has(child.kind)) {
      // A sign at the start, or after an operator or a bracket, is a sign: no room around it.
      const unary = child.kind === 'bin' && (at === 0 || (previous?.type === 'operator' && UNARY_AFTER.has(previous.kind)))
      boxes.push(flat(unary || tight ? child.text : ` ${child.text} `))
      return
    }
    // A name after a term stands apart from it: `n log n`.
    const named = child.type === 'function' || (child.type === 'scripts' && child.base.type === 'function')
    if (named && previous && (previous.type === 'identifier' || previous.type === 'number' || (previous.type === 'operator' && previous.kind === 'close'))) boxes.push(flat(' '))
    boxes.push(box(child, variant, tight))
    if (child.type === 'operator' && child.kind === 'punct' && !tight) boxes.push(flat(' '))
    if (child.type === 'fraction' && at < children.length - 1 && children[at + 1]?.type !== 'operator') boxes.push(flat(' '))
    // A big operator or a function stands a space apart from what it takes.
    const next = children[at + 1]
    const takes = child.type === 'function' || (child.type === 'scripts' && (child.base.type === 'function' || (child.base.type === 'operator' && child.base.kind === 'op')))
    if (takes && next && !(next.type === 'operator' && next.kind === 'open') && next.type !== 'fenced') boxes.push(flat(' '))
  })
  return beside(boxes)
}

function scriptsBox(node: Extract<MathNode, { type: 'scripts' }>, variant: Variant | null): Box {
  const base = node.base.type === 'function' ? flat(node.base.text) : box(node.base, variant)
  const sub = node.sub ? box(node.sub, variant, true) : null
  const sup = node.sup ? box(node.sup, variant, true) : null
  const limits = node.limits ?? ((node.base.type === 'operator' && node.base.kind === 'op') || (node.base.type === 'function' && node.base.limits))
  if (limits) {
    const parts = [sup, base, sub].filter((part): part is Box => part !== null)
    return over(parts, sup ? 1 : 0)
  }
  // Small letters where every one has a small form: `x²`, `aᵢⱼ`.
  if (base.rows.length === 1 && (!sub || sub.rows.length === 1) && (!sup || sup.rows.length === 1)) {
    const small = (part: Box | null, table: Map<string, string>) => (part ? scripted(part.rows[0]!, table, '\u0000') : '')
    const down = small(sub, SUB)
    const up = small(sup, SUPER)
    if (!down.includes('\u0000') && !up.includes('\u0000')) return flat(`${base.rows[0]}${down}${up}`)
  }
  // Otherwise on rows of their own: above and to the right, below and to the right.
  const right = Math.max(sub?.width ?? 0, sup?.width ?? 0)
  const rows: string[] = []
  for (const text of sup?.rows ?? []) rows.push(' '.repeat(base.width) + pad(text, right))
  const baseTop = rows.length
  for (const text of base.rows) rows.push(pad(text, base.width) + ' '.repeat(right))
  for (const text of sub?.rows ?? []) rows.push(' '.repeat(base.width) + pad(text, right))
  return { rows, base: baseTop + base.base, width: base.width + right }
}

function tableBox(node: Extract<MathNode, { type: 'table' }>, variant: Variant | null): Box {
  const grid = node.rows.map((entries) => entries.map((cell) => box(cell, variant)))
  const columns = Math.max(0, ...grid.map((entries) => entries.length))
  const widths = Array.from({ length: columns }, (_, column) => Math.max(0, ...grid.map((entries) => entries[column]?.width ?? 0)))
  const gap = (column: number) => (column === 0 ? '' : node.kind === 'aligned' ? (column % 2 === 1 ? '' : '    ') : node.kind === 'cases' ? '   ' : '  ')
  const rows: Box[] = grid.map((entries) => {
    const parts: Box[] = []
    for (let column = 0; column < columns; column++) {
      const cell = entries[column] ?? flat('')
      const align = node.align[node.kind === 'aligned' ? column % 2 : Math.min(column, node.align.length - 1)] ?? 'center'
      const width = widths[column]!
      const room = width - cell.width
      const left = align === 'left' ? 0 : align === 'right' ? room : Math.floor(room / 2)
      parts.push(flat(gap(column)), { rows: cell.rows.map((text) => ' '.repeat(left) + pad(text, width - left)), base: cell.base, width })
    }
    return beside(parts)
  })
  // Rows one under another; the table's baseline is its middle, as a matrix's is in TeX.
  const body = over(rows, 0, 'left')
  body.base = Math.floor((body.rows.length - 1) / 2)
  if (!node.open && !node.close) return body
  return beside([delimiter(node.open, body.rows.length, body.base), body, delimiter(node.close, body.rows.length, body.base)])
}

/**
 * `tex` as rows no wider than `columns`, trailing spaces cut; one row (`toText`) when it has
 * nothing to set on rows, or does not fit. Reads any text and never throws.
 */
export function toRows(tex: string, columns = 80): string[] {
  const tree = parse(tex)
  const built = box(tree, null)
  const rows = built.rows.map((text) => text.trimEnd())
  if (built.width > columns || rows.length === 1) {
    const single = line(tree, null).replace(/ {2,}/g, ' ').trim()
    return [single]
  }
  return rows
}

