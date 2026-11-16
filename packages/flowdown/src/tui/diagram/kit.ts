/**
 * What the diagrams drawn as rows of text share (gantt, timeline, journey, gitGraph, kanban,
 * mindmap): a paragraph wrapped under its indent, a node as Mermaid writes one (`id[text]`), and
 * the lines of a source with their indentation kept, for the kinds whose nesting is written as
 * indentation and nothing else.
 */
import { MOST_ROWS } from './outline'
import { labelLines } from './text'
import { PLAIN, lineText, type Line } from '../style'
import { width } from '../width'
import { span, wrap } from '../wrap'

/**
 * `line` wrapped to `columns`, starting `indent` columns in and going on two further in, after
 * `mark` (a bullet of two columns) on its first row. The rows after the first start with spaces
 * only, so a word cut at the end of a row reads whole once the spaces are gone; an indent leaves
 * two columns at least, for a character two columns wide.
 */
export function para(line: Line, columns: number, indent: number, mark: Line = []): Line[] {
  const first = Math.min(indent, Math.max(0, columns - 2 - (mark.length > 0 ? 2 : 0)))
  const rest = Math.min(indent + 2, Math.max(0, columns - 2))
  return wrap(
    line,
    columns,
    [...(first ? [span(' '.repeat(first), PLAIN)] : []), ...mark],
    rest ? [span(' '.repeat(rest), PLAIN)] : [],
  )
}

/** `text` and the spaces that make it `columns` wide. */
export const pad = (text: string, columns: number): string =>
  text + ' '.repeat(Math.max(0, columns - width(text)))

/** The columns the longest word of `lines` takes: a row narrower than this cuts a word. */
export const longestWord = (lines: readonly string[]): number =>
  lines.reduce(
    (most, line) => line.split(' ').reduce((own, word) => Math.max(own, width(word)), most),
    0,
  )

/**
 * `rows` when every one is within `columns` and there are not more than a reply holds, else null.
 * A picture is held to this before it is given: should its arithmetic miss a case, the outline is
 * drawn in its place, never a row the terminal would break.
 */
export const within = (rows: Line[], columns: number): Line[] | null =>
  rows.length <= MOST_ROWS && rows.every((row) => width(lineText(row)) <= columns) ? rows : null

/** `rows`, or null when they are more than a reply holds. */
export const bounded = (rows: Line[]): Line[] | null => (rows.length > MOST_ROWS ? null : rows)

/**
 * The lines of a source that say something, as `diagramLines` gives them but with the spaces they
 * start with kept: a mindmap's and a kanban board's nesting is that indentation and nothing else.
 */
export function indentedLines(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/).map((line) => line.trimEnd())
  let at = 0
  while (at < lines.length && (lines[at]!.trim() === '' || lines[at]!.trim().startsWith('%%'))) at++
  if (lines[at]?.trim() === '---') {
    const close = lines.findIndex((line, own) => own > at && line.trim() === '---')
    at = close < 0 ? lines.length : close + 1
  }
  return lines.slice(at).filter((line) => line.trim() !== '' && !line.trim().startsWith('%%'))
}

/** How far `line` is indented: a tab is four columns, as a code block draws it. */
export function indentOf(line: string): number {
  let columns = 0
  for (const char of line) {
    if (char === ' ') columns++
    else if (char === '\t') columns += 4
    else break
  }
  return columns
}

export type Shape = 'plain' | 'square' | 'round' | 'circle' | 'bang' | 'cloud' | 'hexagon'

// Longest delimiter first: `((` is a circle before `(` is a rounded box.
const SHAPES: ReadonlyArray<readonly [open: string, close: string, shape: Shape]> = [
  ['((', '))', 'circle'],
  ['))', '((', 'bang'],
  ['{{', '}}', 'hexagon'],
  [')', '(', 'cloud'],
  ['[', ']', 'square'],
  ['(', ')', 'round'],
]

/**
 * A node as a mindmap or a kanban board writes it: `id[text]`, `id((text))`, `[text]`, or its
 * text alone, which is then its id as well. Its label is what `labelLines` makes of the text.
 */
export function readNode(raw: string): { id: string; label: string[]; shape: Shape } {
  const text = raw.trim()
  for (const [open, close, shape] of SHAPES) {
    const start = text.indexOf(open)
    if (start < 0 || !text.endsWith(close) || text.length < start + open.length + close.length)
      continue
    const id = text.slice(0, start).trim()
    // An id is one word: `a b(c)` is a label with a bracket in it, not a node `a b`.
    if (/\s/.test(id)) continue
    const label = labelLines(text.slice(start + open.length, text.length - close.length))
    return { id: id || label.join(' '), label, shape }
  }
  return { id: text, label: labelLines(text), shape: 'plain' }
}
