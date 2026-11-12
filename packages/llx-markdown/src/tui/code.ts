/**
 * A fence's code as rows, coloured by a highlighter when the terminal was given one.
 *
 * The highlighter is the one a page takes (`llx-markdown/highlight`, or any function of that
 * shape): it returns HTML, spans named by highlight.js's classes. A terminal has no HTML, so the
 * spans are read here for what they say, a token's kind, and each kind is drawn in one of the few
 * colours a terminal theme can be trusted with.
 *
 * What a highlighter returns is not trusted with the text. The tokens are drawn only when, put
 * together, they are the code that was given, character for character; otherwise the code is
 * drawn plain, as without a highlighter. So highlighting changes the colours of a row and never
 * its text, its width or where it breaks.
 *
 * A reply that streams draws its last block again on every token, and a highlighter is the dear
 * part of that. So a view keeps a {@link CodeDrawer}: a fence it has coloured is not coloured
 * again while its code is the same, and the fence still being written is coloured in pieces, of
 * which only the last is new.
 */
import { printable } from './printable'
import { CODE, DIM, DONE, FAILED, PLAIN, patch, type Line, type Style } from './style'
import { span, tabPads, untabbed } from './wrap'

/**
 * Highlighted HTML for `code`, or null for a language it does not know: the shape `<Markdown
 * highlight>` and the other targets take.
 */
export type Highlighter = (code: string, language: string) => string | null

/** How each kind of token is drawn; a kind not listed is drawn as what holds it. */
const KINDS: Record<string, Style> = {
  comment: DIM,
  quote: DIM,
  keyword: { color: 'magenta' },
  'selector-tag': { color: 'magenta' },
  doctag: { color: 'magenta' },
  name: { color: 'magenta' },
  string: { color: 'green' },
  regexp: { color: 'green' },
  number: { color: 'yellow' },
  literal: { color: 'yellow' },
  variable: { color: 'yellow' },
  'template-variable': { color: 'yellow' },
  attr: { color: 'yellow' },
  attribute: { color: 'yellow' },
  symbol: { color: 'yellow' },
  bullet: { color: 'yellow' },
  title: { bold: true },
  section: { bold: true },
  type: { color: 'cyan' },
  built_in: { color: 'cyan' },
  meta: { color: 'cyan' },
  'selector-id': { color: 'cyan' },
  'selector-class': { color: 'cyan' },
  addition: { color: 'green' },
  deletion: { color: 'red' },
  emphasis: { italic: true },
  strong: { bold: true },
}

/** A class's name: `class Queue`, where a function's is only bold. */
const CLASS_TITLE: Style = { color: 'cyan' }

/** The style of a span with these classes inside text drawn as `outer`; null when none names a kind. */
function styleOf(classes: string, outer: Style): Style | null {
  const names = classes.split(/\s+/)
  const kind = names.find((name) => name.startsWith('hljs-'))?.slice(5)
  if (kind === undefined) return null
  // Code inside a string (`${…}`) is code again, not string.
  if (kind === 'subst') return PLAIN
  if (kind === 'title' && names.includes('class_')) return patch(outer, CLASS_TITLE)
  const style = KINDS[kind]
  return style ? patch(outer, style) : null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** `&amp;` as `&`; an entity that names no character is the text it is. */
function entity(whole: string, body: string): string {
  if (body[0] !== '#') return ENTITIES[body] ?? whole
  const code = /^#x/i.test(body) ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1))
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : whole
}

type Token = [text: string, style: Style]

const MARKUP =
  /<(\/?)([A-Za-z][^\s/>]*)(?:\s+class\s*=\s*"([^"]*)"|\s[^>]*)?\s*\/?>|&(#[xX][0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g

/**
 * A highlighter's HTML as tokens: the text between the tags, each piece with the style of the
 * spans around it. `known` says whether any span named a kind this module draws.
 */
function tokens(html: string): { tokens: Token[]; known: boolean } {
  const out: Token[] = []
  const open: Style[] = [PLAIN]
  let known = false
  let text = ''
  const flush = (): void => {
    if (text) out.push([text, open.at(-1)!])
    text = ''
  }
  let at = 0
  for (const match of html.matchAll(MARKUP)) {
    text += html.slice(at, match.index)
    at = match.index + match[0].length
    const [whole, closes, tag, classes, body] = match
    if (tag === undefined) {
      text += entity(whole, body!)
      continue
    }
    flush()
    if (closes) {
      if (open.length > 1) open.pop()
      continue
    }
    const style = classes === undefined ? null : styleOf(classes, open.at(-1)!)
    if (style) known = true
    open.push(style ?? open.at(-1)!)
  }
  text += html.slice(at)
  flush()
  return { tokens: out, known }
}

/** The languages whose lines say what they are by their first character. */
const DIFFS = new Set(['diff', 'patch'])

/** What a line of a diff is drawn in: what it adds, what it takes away, where it is. */
function diffStyle(line: string): Style {
  if (line.startsWith('@@')) return DIM
  if (line.startsWith('+')) return DONE
  if (line.startsWith('-')) return FAILED
  return CODE
}

/**
 * `source` as it is drawn without a highlighter: in the one colour of code, and a diff by its
 * lines, which takes no grammar to read.
 */
function plain(source: string, language?: string | null): Line[] {
  const diff = language != null && DIFFS.has(language.toLowerCase())
  return source
    .split('\n')
    .map((line) => [span(printable(untabbed(line)), diff ? diffStyle(line) : CODE)])
}

/**
 * The rows of a fence's `source`, not yet cut to a width: one per line of code. With a
 * highlighter that knows `language`, each token in its colour; otherwise all of it as code.
 */
export function codeRows(
  source: string,
  language: string | null | undefined,
  highlight: Highlighter | null,
): Line[] {
  if (!highlight || !language) return plain(source, language)
  let read: ReturnType<typeof tokens>
  try {
    const html = highlight(source, language)
    if (html === null) return plain(source, language)
    read = tokens(html)
  } catch {
    // A grammar that fails on this code costs the colours, not the reply.
    return plain(source, language)
  }
  // Colours from classes this module does not know (a highlighter with a scheme of its own) are
  // no colours here; and tokens that are not the code are not drawn at all.
  if (!read.known || read.tokens.map(([text]) => text).join('') !== source)
    return plain(source, language)

  /** The pads of the tabs in the line of code that starts at `from`. */
  const padsFrom = (from: number): number[] => {
    const end = source.indexOf('\n', from)
    return tabPads(source.slice(from, end === -1 ? undefined : end))
  }
  const rows: Line[] = [[]]
  let pads = padsFrom(0)
  let line = 0
  let offset = 0
  for (const [text, style] of read.tokens) {
    let piece = ''
    const put = (): void => {
      if (piece) rows.at(-1)!.push(span(printable(piece), style))
      piece = ''
    }
    for (const char of text) {
      offset += char.length
      if (char === '\n') {
        put()
        rows.push([])
        pads = padsFrom(offset)
        line = 0
      } else if (char === '\t') {
        piece += ' '.repeat(pads[line++]!)
      } else {
        piece += char
      }
    }
    put()
  }
  return rows
}

/** The lines of a piece of a fence still being written: what is highlighted at once. */
export const PIECE_LINES = 40

/** A fence's rows for one view, which draws the same code many times while a reply streams. */
export interface CodeDrawer {
  /**
   * The rows of a fence's `source`, one per line of code. `growing` says the fence may still be
   * written to: it is highlighted in pieces of {@link PIECE_LINES} lines, each on its own, so a
   * token costs the last piece and not the whole fence. A construct that runs over two pieces (a
   * block comment, a template string) may be coloured wrongly until the fence is done; then it
   * is highlighted whole. The pieces are a matter of colour only: the text is the code.
   */
  rows(source: string, language: string | null | undefined, growing: boolean): Line[]
  /** Whether a fence was drawn in more than one piece since this was last asked. */
  pieced(): boolean
  /** A render is over: the fences it did not draw are forgotten. */
  turn(): void
}

interface Piece {
  language: string
  text: string
  rows: Line[]
}

/** The drawer of a view with this highlighter. Without one there is nothing to keep. */
export function createCodeDrawer(highlight: Highlighter | null): CodeDrawer {
  if (!highlight)
    return { rows: (source, language) => plain(source, language), pieced: () => false, turn() {} }
  // The pieces of the fence being written that have all their lines, in order; and its last one,
  // which a token that changed nothing in it, or that only began the next, finds as it was.
  const pieces: Piece[] = []
  let tail: Piece | null = null
  /** The last piece, when it is all of its fence. */
  let only: Piece | null = null
  let cut = false
  // Finished fences, by language and code: those of this render, and those of the last.
  let now = new Map<string, Line[]>()
  let before = new Map<string, Line[]>()
  const whole = (source: string, language: string): Line[] => {
    const key = `${language}\u0000${source}`
    let rows = now.get(key) ?? before.get(key)
    // A fence that was all one piece while it was written is already drawn whole.
    if (rows === undefined && only?.text === source && only.language === language) rows = only.rows
    if (rows === undefined) rows = codeRows(source, language, highlight)
    now.set(key, rows)
    return rows
  }
  const piece = (kept: Piece | null | undefined, text: string, language: string): Piece =>
    kept && kept.text === text && kept.language === language
      ? kept
      : { language, text, rows: codeRows(text, language, highlight) }
  const growing = (source: string, language: string): Line[] => {
    const lines = source.split('\n')
    const out: Line[] = []
    let index = 0
    for (let at = 0; at < lines.length; at += PIECE_LINES, index++) {
      const text = lines.slice(at, at + PIECE_LINES).join('\n')
      // The last piece may still gain a line, or the end of its last one.
      const last = at + PIECE_LINES >= lines.length
      const made = piece(last ? tail : (pieces[index] ?? tail), text, language)
      if (last) tail = made
      else pieces[index] = made
      for (const row of made.rows) out.push(row)
    }
    pieces.length = index - 1
    only = index === 1 ? tail : null
    if (index > 1) cut = true
    return out
  }
  return {
    rows(source, language, open) {
      if (!language) return plain(source)
      return open ? growing(source, language) : whole(source, language)
    },
    pieced() {
      const was = cut
      cut = false
      return was
    },
    turn() {
      before = now
      now = new Map()
    },
  }
}
