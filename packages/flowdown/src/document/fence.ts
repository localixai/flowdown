/**
 * A block that is one code fence still being written, read without parsing the block: what a
 * renderer needs to draw a long fence in pieces, a token costing only its last lines.
 */
import { fenceTitle } from '../dialect'
import { continues } from '../core/continues'

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
function unclosed(rest: string, marker: string, length: number): string {
  const closing = rest.lastIndexOf('\n')
  return closesFence(rest, closing + 1, rest.length, marker, length, 0)
    ? rest.slice(0, Math.max(closing, 0))
    : rest
}

/** An open fence: its language, the file it names, and the code written so far. */
export interface GrowingFence {
  language: string | undefined
  title: string
  body: string
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
  let body: string
  if (!closer) body = unclosed(rest, marker, fence.length)
  else if (markers[0] !== marker || markers.length < fence.length)
    // Not a line that closes this fence: it is read with the text, as any other line.
    body = unclosed(rest + closer, marker, fence.length)
  // It closes the fence: the code is what is above it, without the newline that ends that.
  else body = closer !== markers || !rest ? rest : rest.slice(0, -1)
  // A fence closed earlier in the block means the block is not just this fence.
  const read = memory.read
  let at =
    read !== null && read.fence === fence && continues(body, read.body, read.clean) ? read.clean : 0
  memory.read = null
  for (let end = body.indexOf('\n', at); end !== -1; end = body.indexOf('\n', at)) {
    if (closesFence(body, at, end, marker, fence.length, 3)) return null
    at = end + 1
  }
  // The last line is still being written: read, but not remembered.
  if (closesFence(body, at, body.length, marker, fence.length, 3)) return null
  memory.read = { fence, body, clean: at }
  const info = opening[2]?.trim() ?? ''
  const language = info.split(/\s+/)[0] || undefined
  return { language, title: fenceTitle(info.slice(language?.length ?? 0)), body }
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
