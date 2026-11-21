/**
 * A block that is one code fence still being written, read without parsing the block: what a
 * renderer needs to draw a long fence in pieces, a token costing only its last lines.
 */
import { fenceTitle } from '../dialect'
import { continues } from '../core/continues'
import { unescapeString } from '../engine/entities'

const OPENING = /^(`{3,}|~{3,})([^\n`]*)\n/

/** Whether the line of `text` from `from` to `to` closes a fence: `length` markers or more, alone. */
function closesFence(
  text: string,
  from: number,
  to: number,
  marker: string,
  length: number,
  indent: number,
): boolean {
  let at = from
  while (at < to && at - from < indent && text[at] === ' ') at += 1
  const run = at
  while (at < to && text[at] === marker) at += 1
  if (at - run < length) return false
  while (at < to && (text[at] === ' ' || text[at] === '\t')) at += 1
  return at === to
}

/**
 * The fence read last time: its body up to `clean` is complete lines, none of which closes it. A
 * fence that grows is read once per token, and the next read starts where this one stopped.
 */
export interface FenceMemory {
  read: { fence: string; body: string; clean: number } | null
}

/** A place for it. A block that draws a growing fence keeps its own; this one is the default. */
export const createFenceMemory = (): FenceMemory => ({ read: null })

const shared = createFenceMemory()

/** `rest` without its last line, when that line closes the fence: the healer's is not code. */
function unclosed(rest: string, marker: string, length: number): { body: string; lined: boolean } {
  const closing = rest.lastIndexOf('\n')
  // Closed by its last line: the code is the lines above it, of which there may be none.
  return closesFence(rest, closing + 1, rest.length, marker, length, 0)
    ? { body: rest.slice(0, Math.max(closing, 0)), lined: closing >= 0 }
    : { body: rest, lined: rest !== '' }
}

/** An open fence: its language, the file it names, and the code written so far. */
export interface GrowingFence {
  language: string | undefined
  title: string
  body: string
  /**
   * Whether the code has a line at all: a body of one empty line is `''` as a body of none is, and
   * a finished block draws the one as a newline and the other as nothing.
   */
  lined: boolean
}

/**
 * The language and code of a block that is one open fence, closed by the healer; else null.
 * `closer` is the healer's line when it is kept beside `source` (a newline, unless the source ends
 * in one, and the markers): the block is read as the two joined, without joining them.
 */
export function growingFence(
  source: string,
  closer = '',
  memory: FenceMemory = shared,
): GrowingFence | null {
  // The opening line is still being written: short, and read joined.
  if (closer && !source.includes('\n')) return growingFence(source + closer, '', memory)
  const opening = OPENING.exec(source)
  if (!opening) return null
  const fence = opening[1] ?? '```'
  const marker = fence[0] ?? '`'
  const rest = source.slice(opening[0].length)
  const markers = closer.trimStart()
  let read: { body: string; lined: boolean }
  if (!closer) read = unclosed(rest, marker, fence.length)
  else if (markers[0] !== marker || markers.length < fence.length)
    // Not a line that closes this fence: it is read with the text, as any other line.
    read = unclosed(rest + closer, marker, fence.length)
  // It closes the fence: the code is what is above it, without the newline that ends that.
  else read = { body: closer !== markers || !rest ? rest : rest.slice(0, -1), lined: rest !== '' }
  const { body, lined } = read
  // A fence closed earlier in the block means the block is not just this fence.
  const before = memory.read
  let at =
    before !== null && before.fence === fence && continues(body, before.body, before.clean)
      ? before.clean
      : 0
  memory.read = null
  for (let end = body.indexOf('\n', at); end !== -1; end = body.indexOf('\n', at)) {
    if (closesFence(body, at, end, marker, fence.length, 3)) return null
    at = end + 1
  }
  // The last line is still being written: read, but not remembered.
  if (closesFence(body, at, body.length, marker, fence.length, 3)) return null
  memory.read = { fence, body, clean: at }
  // The info string as the engine reads it: its escapes and character references resolved
  // (```` ```foo\+bar ```` is `foo+bar`), so the open fence names what the closed one will.
  const info = unescapeString(opening[2]?.trim() ?? '')
  const language = info.split(/\s+/)[0] || undefined
  return { language, title: fenceTitle(info.slice(language?.length ?? 0)), body, lined }
}

/** How many lines a piece of a growing fence holds. */
const LINES = 40

/** The pieces of a body: their text, each ending in its newline but the last. */
export interface Cut {
  parts: string[]
  /**
   * Changes when the body is not the last one grown: pieces of the same run that are complete
   * are the same text, and are not compared.
   */
  run: number
}

/**
 * Cuts a body that grows at its end into its pieces. It remembers where the complete pieces end,
 * so a token costs the last piece and not a count of every line above it.
 */
export function createCutter(): (body: string) => Cut {
  let text = ''
  /** Where each complete piece ends in `text`. */
  let ends: number[] = []
  let run = 0
  return (body) => {
    const done = ends.at(-1) ?? 0
    if (done > 0 && !continues(body, text, done)) {
      ends = []
      run += 1
    }
    let start = ends.at(-1) ?? 0
    let line = 0
    for (let at = body.indexOf('\n', start); at !== -1; at = body.indexOf('\n', at + 1)) {
      line += 1
      if (line % LINES === 0) {
        start = at + 1
        ends.push(start)
      }
    }
    text = body
    // Cut from this body each time, so no piece keeps an earlier body alive.
    const parts = ends.map((end, index) => body.slice(ends[index - 1] ?? 0, end))
    parts.push(body.slice(start))
    return { parts, run }
  }
}

/**
 * A highlighter that reads a line at a time (`@localix-ai/flowdown/highlight` is one): a line is
 * read from the state the line above ended in, inside a comment, a string or a template, and gives
 * the state it ends in. So a fence that grows is coloured as the finished one is, a line once.
 */
export interface LineHighlighter {
  start: string
  line(text: string, state?: string): { html: string; end: string }
}

/** The pieces of a body the cutter's way, each with its HTML. */
export interface ColouredCut extends Cut {
  /** The HTML of each part: a complete one ends in its newline, as its text does. */
  html: string[]
  /**
   * The last part as its complete lines (each ending in its newline) and the line still being
   * written: a page that draws them apart sets the HTML of a line once, and only the open line's
   * again on a token.
   */
  lines: readonly string[]
  open: string
}

/**
 * Colours a body that grows at its end, in the cutter's pieces: each complete line is read once
 * and kept, the line still being written is read again on each call from the state above it, and a
 * complete piece keeps its HTML. A token costs its line, not its piece; and a comment opened in
 * the first piece is still one in the last.
 */
export function createLineColourer(): (
  body: string,
  reader: LineHighlighter,
  language: string,
) => ColouredCut {
  let text = ''
  let read = ''
  let run = 0
  /** Where the complete lines end, and the state the next line starts in. */
  let done = 0
  let state = ''
  /** The complete pieces: where each ends, and its HTML. */
  let ends: number[] = []
  let pieces: string[] = []
  /** The HTML of the complete lines of the last piece, each ending in its newline. */
  let lines: string[] = []
  return (body, reader, language) => {
    if (language !== read || (done > 0 && !continues(body, text, done))) {
      if (done > 0) run += 1
      read = language
      done = 0
      state = reader.start
      ends = []
      pieces = []
      lines = []
    }
    for (let end = body.indexOf('\n', done); end !== -1; end = body.indexOf('\n', done)) {
      const line = reader.line(body.slice(done, end), state)
      lines.push(`${line.html}\n`)
      state = line.end
      done = end + 1
      if (lines.length === LINES) {
        pieces.push(lines.join(''))
        ends.push(done)
        lines = []
      }
    }
    text = body
    const open = reader.line(body.slice(done), state).html
    const parts = ends.map((end, index) => body.slice(ends[index - 1] ?? 0, end))
    parts.push(body.slice(ends.at(-1) ?? 0))
    return { parts, run, html: [...pieces, lines.join('') + open], lines, open }
  }
}
