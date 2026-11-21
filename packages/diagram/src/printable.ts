/**
 * Text made safe to print. A reply is a model's words, and a model can be made to write anything:
 * an escape sequence that clears the screen, retitles the window or rewrites a row already read,
 * a direction override that shows `exe.txt` for `txt.exe`. Every character that is an instruction
 * to the terminal and not a letter is written out as what it is (`\u{1b}`), so it is seen and
 * does nothing.
 *
 * Every piece of text a row is made of passes through here; the escape sequences in the output
 * are the renderer's own (`style.ts`) and no others.
 */

// C0 and C1 controls and DEL; the marks that reorder what is shown (bidi marks, embeddings,
// overrides and isolates); and the separators a terminal may take for the end of a row. Written
// as numbers: a character of this set typed into the source would be invisible, or end the line.
const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200e, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
]
const hex = (code: number): string => `\\u{${code.toString(16)}}`
const UNSAFE = new RegExp(
  `[${RANGES.map(([from, to]) => `${hex(from)}-${hex(to)}`).join('')}]`,
  'gu',
)

const NAMED: Record<string, string> = { '\t': '\\t', '\n': '\\n', '\r': '\\r' }

/** `text` with every character a terminal would act on written out as its escape. */
export const printable = (text: string): string =>
  text.replace(UNSAFE, (c) => NAMED[c] ?? `\\u{${c.codePointAt(0)!.toString(16)}}`)
