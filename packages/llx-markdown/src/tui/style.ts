/**
 * What a terminal row is made of: runs of text, each with how it is drawn. Nothing here knows an
 * escape sequence but {@link toAnsi}: a host with its own screen (a TUI library, a test) reads
 * the spans and draws them its own way.
 */

/**
 * The colours the renderer uses: the ones every terminal theme has a readable shade of. Blue is
 * left out for that reason: on many dark themes it is too dark to read.
 */
export type Colour = 'red' | 'green' | 'yellow' | 'cyan' | 'magenta'

/** How a run of text is drawn. A field left out is off. */
export interface Style {
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: Colour
}

/** A run of text in one style. Its text holds no control character: see `printable.ts`. */
export interface Span {
  text: string
  style: Style
}

/** One row of the terminal. A blank row has no spans. */
export type Line = Span[]

export const PLAIN: Style = {}
export const BOLD: Style = { bold: true }
export const DIM: Style = { dim: true }
/** Code, and a note. */
export const CODE: Style = { color: 'cyan' }
/** A formula. */
export const MATH: Style = { italic: true }
/** What went well: a checked task, a tip, an argument for. */
export const DONE: Style = { color: 'green' }
/** What needs care: a warning. */
export const WAITING: Style = { color: 'yellow' }
/** What went wrong or argues against. */
export const FAILED: Style = { color: 'red' }

/** `style` with what `over` sets laid over it. */
export const patch = (style: Style, over: Style): Style => ({ ...style, ...over })

const SGR: Array<[keyof Style, string]> = [
  ['bold', '1'],
  ['dim', '2'],
  ['italic', '3'],
  ['underline', '4'],
  ['strike', '9'],
]

const FOREGROUND: Record<Colour, string> = {
  red: '31',
  green: '32',
  yellow: '33',
  cyan: '36',
  magenta: '35',
}

/** The parameters of the escape sequence that turns `style` on; '' for plain text. */
export function sgr(style: Style): string {
  const codes: string[] = []
  for (const [field, code] of SGR) if (style[field]) codes.push(code)
  if (style.color) codes.push(FOREGROUND[style.color])
  return codes.join(';')
}

/** A row as its text alone. */
export const lineText = (line: Line): string => line.map((span) => span.text).join('')

/**
 * Rows as text for a terminal, one per line. With `color`, each styled run is wrapped in the
 * sequence that draws it and the one that resets it; without, the text is all there is.
 */
export function toAnsi(lines: readonly Line[], color = true): string {
  let out = ''
  for (let at = 0; at < lines.length; at++) {
    if (at > 0) out += '\n'
    for (const span of lines[at]!) {
      const codes = color ? sgr(span.style) : ''
      out += codes ? `\u001b[${codes}m${span.text}\u001b[0m` : span.text
    }
  }
  return out
}

/** A row with neighbouring runs of one style made one run. */
export function merged(line: Line): Line {
  const out: Line = []
  let key = ''
  for (const span of line) {
    if (span.text === '') continue
    const own = sgr(span.style)
    const last = out.at(-1)
    if (last && own === key) last.text += span.text
    else out.push({ text: span.text, style: span.style })
    key = own
  }
  return out
}
