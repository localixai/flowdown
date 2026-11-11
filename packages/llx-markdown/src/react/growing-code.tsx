'use client'
import { memo, useMemo, useState } from 'react'
import { CodeFrame } from './code-block'
import { fenceTitle } from '../dialect'
import { useRenderContext, type Highlighter } from './context'

/**
 * A code fence still being written, as an agent writing a file streams it: hundreds of lines,
 * one token at a time. Drawn through react-markdown, every token would parse, draw and highlight
 * the whole fence again. Here the code is cut into pieces of {@link LINES} lines; a piece that is
 * complete is drawn and highlighted once, and a token redraws only the last piece.
 *
 * A piece is highlighted on its own, so a construct that spans two pieces (a block comment, a
 * template string) can be coloured wrongly for the moment the fence is open. When it closes the
 * block is drawn as any finished block is, highlighted whole.
 */
const LINES = 40

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

/**
 * The language and code of a block that is one open fence, closed by the healer; else null.
 * `closer` is the healer's line when it is kept beside `source` (a newline, unless the source ends
 * in one, and the markers): the block is read as the two joined, without joining them.
 */
export function growingFence(
  source: string,
  closer = '',
  memory: FenceMemory = shared,
): { language: string | undefined; title: string; body: string } | null {
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
    read !== null &&
    read.fence === fence &&
    body.length >= read.clean &&
    body.startsWith(read.body.slice(0, read.clean))
      ? read.clean
      : 0
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

/** The pieces of a body: their text, each ending in its newline but the last. */
interface Cut {
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
function createCutter(): (body: string) => Cut {
  let text = ''
  /** Where each complete piece ends in `text`. */
  let ends: number[] = []
  let run = 0
  return (body) => {
    const done = ends.at(-1) ?? 0
    if (done > 0 && !(body.length >= done && body.startsWith(text.slice(0, done)))) {
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

interface PieceProps {
  text: string
  /** A complete piece of run `run`: its text does not change while the run lasts. */
  done: boolean
  run: number
  language: string | undefined
  highlight: Highlighter | null
}

const Piece = memo(
  function Piece({ text, language, highlight }: PieceProps) {
    const html = language && highlight ? highlight(text, language) : null
    return html === null ? text : <span dangerouslySetInnerHTML={{ __html: html }} />
  },
  (before, after) =>
    before.language === after.language &&
    before.highlight === after.highlight &&
    ((before.done && after.done && before.run === after.run) || before.text === after.text),
)

export function GrowingCode({
  language,
  title,
  body,
}: {
  language: string | undefined
  title?: string
  body: string
}) {
  const { highlight } = useRenderContext()
  // The class a finished block gets when its language is one the highlighter knows.
  const known = useMemo(
    () => Boolean(language && highlight && highlight('', language) !== null),
    [language, highlight],
  )
  const className = [language ? `language-${language}` : null, known ? 'llx-highlighted' : null]
    .filter(Boolean)
    .join(' ')
  const [cut] = useState(createCutter)
  const { parts, run } = useMemo(() => cut(body), [cut, body])
  return (
    <CodeFrame language={language} title={title} text={body}>
      <code className={className || undefined}>
        {parts.map((text, index) => (
          <Piece
            key={index}
            text={text}
            done={index < parts.length - 1}
            run={run}
            language={known ? language : undefined}
            highlight={highlight}
          />
        ))}
        {/* A finished block's text ends in a newline unless it is highlighted; so does this. */}
        {!known && body ? '\n' : null}
      </code>
    </CodeFrame>
  )
}
