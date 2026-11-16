/**
 * The words of a diagram, made into what cells can hold: its entities read, each `<br>` a new
 * row, its markup left out, and every character a terminal would act on written out
 * (`printable.ts`). Every label, title and name reaches the screen through here.
 */
import { printable } from '../printable'
import { lineText, PLAIN } from '../style'
import { width } from '../width'
import { span, wrap } from '../wrap'

const BREAK = /<br\s*\/?>/gi
// The inline tags a label is written with. What they mean (bold, a colour) a cell cannot show, and
// a tag left in would be read as part of the label.
const TAG = /<\/?(?:a|b|big|code|del|em|font|i|ins|mark|p|s|small|span|strong|sub|sup|u)\b[^<>]*>/gi
// An entity as HTML writes it (`&amp;`, `&#38;`) and as Mermaid does (`#amp;`, `#38;`).
const ENTITY = /&#x([0-9a-f]{1,6});|&#([0-9]{1,7});|&([a-z]{2,8});|#([0-9]{1,7});|#([a-z]{2,8});/gi
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decode(
  match: string,
  hex?: string,
  decimal?: string,
  name?: string,
  number?: string,
  word?: string,
): string {
  const digits = decimal ?? number
  const code = hex !== undefined ? parseInt(hex, 16) : digits !== undefined ? Number(digits) : -1
  // A number that names no character is left as it was written, as a browser would show it.
  if (code >= 0)
    return code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : match
  return NAMED[(name ?? word ?? '').toLowerCase()] ?? match
}

/** The rows a label is written in, before any wrapping: none when it says nothing. */
export function labelLines(raw: string): string[] {
  let text = raw.trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1)
  // A Markdown string (`"`a label`"`) is its text here: a cell has no bold to show it with.
  if (text.length >= 2 && text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1)
  return text
    .replace(BREAK, '\n')
    .replace(TAG, '')
    .replace(ENTITY, decode)
    .split('\n')
    .map((line) => printable(line.replace(/\s+/g, ' ').trim()))
    .filter((line) => line !== '')
}

/** `lines` broken at their spaces into rows of at most `columns`; a longer word is cut. */
export function wrapLines(lines: readonly string[], columns: number): string[] {
  const room = Math.max(1, columns)
  return lines.flatMap((line) =>
    width(line) <= room ? [line] : wrap([span(line, PLAIN)], room, [], []).map(lineText),
  )
}

/** The columns the widest of `lines` takes. */
export const widest = (lines: readonly string[]): number =>
  lines.reduce((most, line) => Math.max(most, width(line)), 0)

/**
 * The lines of a diagram's source that say something: no blank line, no `%%` comment, no front
 * matter (the `---` block of settings a diagram may open with), each trimmed. The first is the
 * line that names the kind of diagram.
 */
export function diagramLines(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/).map((line) => line.trim())
  let at = 0
  while (at < lines.length && (lines[at] === '' || lines[at]!.startsWith('%%'))) at++
  if (lines[at] === '---') {
    const close = lines.indexOf('---', at + 1)
    at = close < 0 ? lines.length : close + 1
  }
  return lines.slice(at).filter((line) => line !== '' && !line.startsWith('%%'))
}
