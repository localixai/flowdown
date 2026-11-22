'use client'
import { memo, useMemo, useState } from 'react'
import type { Grown } from '../core/continues'
import { createCutter, createLineColourer } from '../document/fence'
import { CodeFrame } from './code-block'
import { useRenderContext, type Highlighter } from './context'

export { createFenceMemory, growingFence, type FenceMemory } from '../document/fence'

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

/** A piece coloured line by line: its HTML is drawn again only when it changed. */
const Coloured = memo(
  function Coloured({ html }: { html: string }) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  },
  (before, after) => before.html === after.html,
)

export function GrowingCode({
  language,
  title,
  body,
  lined = body !== '',
  grown = null,
}: {
  language: string | undefined
  title?: string
  body: string
  /** Whether the code has a line, an empty one included (`GrowingFence.lined`). */
  lined?: boolean
  /** What was checked of `body` against the last one (`FenceMemory.checked`). */
  grown?: Grown | null
}) {
  const { highlight } = useRenderContext()
  // The class a finished block gets when its language is one the highlighter knows.
  const known = useMemo(
    () => Boolean(language && highlight && highlight('', language) !== null),
    [language, highlight],
  )
  const className = [language ? `language-${language}` : null, known ? 'fd-highlighted' : null]
    .filter(Boolean)
    .join(' ')
  const [cut] = useState(createCutter)
  const [colour] = useState(createLineColourer)
  // A highlighter that reads a line at a time colours each line once, from the state above it.
  const reader = known && language && highlight?.lines ? highlight.lines(language) : null
  const coloured = useMemo(
    () => (reader && language ? colour(body, reader, language, grown) : null),
    [colour, reader, body, language, grown],
  )
  const { parts, run } = useMemo(() => coloured ?? cut(body, grown), [coloured, cut, body, grown])
  return (
    <CodeFrame language={language} title={title} text={body}>
      {/* The file a finished block names is on its `<code>` too, for a page's own styles. */}
      <code className={className || undefined} data-title={title || undefined}>
        {coloured
          ? [
              ...coloured.html
                .slice(0, -1)
                .map((html, index) => <Coloured key={index} html={html} />),
              // The last piece as its complete lines and the open one: a line's HTML is set once,
              // and a token sets only the open line's again.
              ...coloured.lines.map((html, index) => (
                <Coloured key={`line ${index}`} html={html} />
              )),
              <Coloured key="open" html={coloured.open} />,
            ]
          : parts.map((text, index) => (
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
        {!known && lined ? '\n' : null}
      </code>
    </CodeFrame>
  )
}
