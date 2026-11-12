'use client'
import { memo, useMemo, useState } from 'react'
import { createCutter } from '../document/fence'
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
  const className = [language ? `language-${language}` : null, known ? 'fd-highlighted' : null]
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
