/**
 * Styled lines wrapped to a width by display columns, at word boundaries, with a prefix for the
 * first row and another for the rest (a hanging indent): a paragraph never breaks mid-word and
 * its continuation sits under its own start. A word wider than the row is split; nothing is ever
 * wider than `width` while the prefix leaves a column to write in.
 */
import type { Line, Span, Style } from './style'
import { charWidth, width } from './width'

/**
 * A space a row is not broken at while a row holds what it joins: the spaces of code. Drawn as a
 * space, so what is copied from the screen is what was written.
 */
export const NO_BREAK = String.fromCharCode(0xa0)

/** What follows a word. */
const enum After {
  /** A space, where a row may end. */
  Space,
  /** A space that keeps its words on one row when a row holds them. */
  Joint,
  /** The next word, with nothing between: "`code`," or "a**b**". */
  Nothing,
}

interface Word {
  text: string
  style: Style
  after: After
}

export const lineWidth = (line: Line): number => {
  let columns = 0
  for (const span of line) columns += width(span.text)
  return columns
}

const SPACE = /\s/

/** The words of `line` with their style and what follows each. */
function words(line: Line): Word[] {
  const out: Word[] = []
  for (const span of line) {
    let word = ''
    for (const char of span.text) {
      if (SPACE.test(char)) {
        const after = char === NO_BREAK ? After.Joint : After.Space
        if (word) {
          out.push({ text: word, style: span.style, after })
          word = ''
        } else if (out.length > 0) out.at(-1)!.after = after
      } else word += char
    }
    if (word) out.push({ text: word, style: span.style, after: After.Nothing })
  }
  return out
}

/**
 * For each word, the columns kept on one row from it on: the words that run into it, and where a
 * code span starts, the span. A span no row holds is then broken at its spaces, as words are.
 */
function runs(list: Word[]): number[] {
  const out = list.map(() => 0)
  let glued = 0
  let whole = 0
  for (let at = list.length - 1; at >= 0; at--) {
    const { text, after } = list[at]!
    const own = width(text)
    if (after === After.Space) [glued, whole] = [own, own]
    else if (after === After.Joint) [glued, whole] = [own, own + 1 + whole]
    else [glued, whole] = [own + glued, own + whole]
    const before = at > 0 ? list[at - 1]!.after : After.Space
    out[at] = before === After.Space ? whole : before === After.Joint ? glued : 0
  }
  return out
}

/** Where `word` is cut to fit `columns`: its length when it fits. Always past its first character. */
function split(word: string, columns: number): number {
  let used = 0
  let at = 0
  for (const char of word) {
    const own = charWidth(char)
    if (used + own > columns && at > 0) return at
    used += own
    at += char.length
  }
  return word.length
}

/**
 * How the space between two words is drawn: with what both are. Inside a link it is underlined
 * with its words; after the link it is not, and the line under the link ends where the link does.
 */
function shared(before: Style, after: Style): Style {
  if (before === after) return before
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(before))
    if ((after as Record<string, unknown>)[field] === value) out[field] = value
  return out as Style
}

/** `line` wrapped to `columns`: the first row starts with `first`, the others with `rest`. */
export function wrap(line: Line, columns: number, first: Line, rest: Line): Line[] {
  const rows: Line[] = []
  let row: Line = [...first]
  let used = lineWidth(first)
  const indent = lineWidth(rest)
  const room = Math.max(columns, indent + 1)
  let pending: Style | null = null
  let fresh = true
  const list = words(line)
  const kept = runs(list)
  const next = () => {
    rows.push(row)
    row = [...rest]
    used = indent
    fresh = true
  }
  for (let at = 0; at < list.length; at++) {
    const { style, after } = list[at]!
    let word = list[at]!.text
    const run = kept[at]!
    // A word and what runs into it ("`code`," or "(**b**)"), and the words of a code span, go
    // to the next row together when a row holds them: no row starts with the comma.
    if (!fresh && used + (pending ? 1 : 0) + run > room && indent + run <= room) next()
    for (;;) {
      const gap = pending && !fresh ? 1 : 0
      const own = width(word)
      if (used + gap + own <= room) {
        if (gap) row.push({ text: ' ', style: shared(pending!, style) })
        row.push({ text: word, style })
        used += gap + own
        fresh = false
        break
      }
      if (!fresh) {
        next()
        continue
      }
      const cut = split(word, Math.max(1, room - used))
      row.push({ text: word.slice(0, cut), style })
      word = word.slice(cut)
      next()
      if (!word) break
    }
    pending = after === After.Nothing ? null : style
  }
  if (!fresh || rows.length === 0) rows.push(row)
  return rows
}

/**
 * A line of code with each tab run out to the next fourth column: a terminal's own stops are
 * eight wide, and an escaped tab is not what was written.
 */
export function untabbed(line: string): string {
  if (!line.includes('\t')) return line
  const pads = tabPads(line)
  return line
    .split('\t')
    .map((piece, at) => (at > 0 ? ' '.repeat(pads[at - 1]!) : '') + piece)
    .join('')
}

/** The spaces each tab of `line` stands for, in order: what {@link untabbed} writes in its place. */
export function tabPads(line: string): number[] {
  const pads: number[] = []
  let column = 0
  line.split('\t').forEach((piece, at) => {
    if (at > 0) {
      const pad = 4 - (column % 4)
      pads.push(pad)
      column += pad
    }
    column += width(piece)
  })
  return pads
}

/**
 * `line` in rows of at most `columns`, broken anywhere with its styles and its spaces kept: for
 * code, whose indentation and alignment mean something.
 */
export function fit(line: Line, columns: number): Line[] {
  const room = Math.max(1, columns)
  if (lineWidth(line) <= room) return [line]
  const rows: Line[] = [[]]
  let used = 0
  for (const span of line) {
    let text = ''
    for (const char of span.text) {
      const own = charWidth(char)
      if (used + own > room && used > 0) {
        rows.at(-1)!.push({ text, style: span.style })
        text = ''
        rows.push([])
        used = 0
      }
      text += char
      used += own
    }
    rows.at(-1)!.push({ text, style: span.style })
  }
  return rows
}

export const span = (text: string, style: Style): Span => ({ text, style })
