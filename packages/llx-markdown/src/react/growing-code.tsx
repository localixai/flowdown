'use client'
import { memo, useMemo } from 'react'
import { CodeFrame } from './code-block'
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

/** The language and code of a block that is one open fence, closed by the healer; else null. */
export function growingFence(
  source: string,
): { language: string | undefined; body: string } | null {
  const opening = OPENING.exec(source)
  if (!opening) return null
  const fence = opening[1] ?? '```'
  const marker = fence[0] ?? '`'
  const rest = source.slice(opening[0].length)
  const closing = new RegExp(`(?:^|\\n)\\${marker}{${fence.length},}[ \\t]*$`)
  const body = rest.replace(closing, '')
  // A fence closed earlier in the block means the block is not just this fence.
  if (new RegExp(`(?:^|\\n) {0,3}\\${marker}{${fence.length},}[ \\t]*(?:\\n|$)`).test(body))
    return null
  const language = opening[2]?.trim().split(/\s+/)[0] || undefined
  return { language, body }
}

/** The pieces of `body`, each ending in its newline but the last. */
function pieces(body: string): string[] {
  const out: string[] = []
  let start = 0
  let line = 0
  for (let at = body.indexOf('\n'); at !== -1; at = body.indexOf('\n', at + 1)) {
    line += 1
    if (line % LINES === 0) {
      out.push(body.slice(start, at + 1))
      start = at + 1
    }
  }
  out.push(body.slice(start))
  return out
}

const Piece = memo(function Piece({
  text,
  language,
  highlight,
}: {
  text: string
  language: string | undefined
  highlight: Highlighter | null
}) {
  const html = language && highlight ? highlight(text, language) : null
  return html === null ? text : <span dangerouslySetInnerHTML={{ __html: html }} />
})

export function GrowingCode({ language, body }: { language: string | undefined; body: string }) {
  const { highlight } = useRenderContext()
  // The class a finished block gets when its language is one the highlighter knows.
  const known = useMemo(
    () => Boolean(language && highlight && highlight('', language) !== null),
    [language, highlight],
  )
  const className = [language ? `language-${language}` : null, known ? 'llx-highlighted' : null]
    .filter(Boolean)
    .join(' ')
  const parts = pieces(body)
  return (
    <CodeFrame language={language} text={body}>
      <code className={className || undefined}>
        {parts.map((text, index) => (
          <Piece
            key={index}
            text={text}
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
