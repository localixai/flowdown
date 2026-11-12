'use client'
import {
  memo,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { codeFileName, copyText, downloadFile } from '../browser/file-actions'
import type { Props } from '../render/factory'
import {
  code,
  codeBar,
  codeFrame,
  copyButton,
  downloadButton,
  readCodeBlock,
} from '../render/views'
import { useRenderContext } from './context'
import { useLabels } from './labels'
import { react } from './render'
import { useScrolls } from './scrolls'

type CodeProps = ComponentPropsWithoutRef<'code'> & { node?: unknown }
type PreProps = ComponentPropsWithoutRef<'pre'> & { node?: unknown }

/** How long "Copied" stays before the button reads "Copy" again. */
const COPIED_MS = 1_600

/**
 * Code, inline or in a fence. A fenced block is highlighted when the page gave `<Markdown>` a
 * highlighter and the fence names a language it knows; otherwise its text is printed as is.
 */
export function Code({ children, ...props }: CodeProps) {
  const { highlight } = useRenderContext()
  return code(react, props as Props, children === undefined ? [] : [children], highlight)
}

/** The code of a block as last drawn: read when a button is pressed, not when it is drawn. */
type CodeText = { readonly current: string }

function CopyButton({ code: text }: { code: CodeText }) {
  const labels = useLabels()
  // How many times the code was copied since the button last read "Copy": each copy starts the
  // wait over, and the effect's cleanup ends it when the block leaves the page.
  const [copies, setCopies] = useState(0)
  useEffect(() => {
    if (copies === 0) return
    const timer = setTimeout(() => setCopies(0), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copies])
  const copy = () => {
    // The Clipboard API, or the old copy command where the page has none (an insecure origin).
    // When both refuse there is nothing to say: the code is still selectable.
    void copyText(text.current).then((done) => {
      if (done) setCopies((count) => count + 1)
    })
  }
  return copyButton(react, labels, copies > 0, copy)
}

/** Saves the code as a file: named as its fence's title, or `code.<ext>` from its language. */
function DownloadButton({ code: text, name }: { code: CodeText; name: string }) {
  return downloadButton(react, useLabels(), () => downloadFile(text.current, name))
}

/**
 * A fenced code block: its language, a download and a copy button above the code. Replace it with
 * your own through `components.pre`; the `Code` inside still highlights.
 */
export function CodeBlock({ node: _node, children, ...props }: PreProps) {
  const { language, title, text } = readCodeBlock(react, children === undefined ? [] : [children])
  return (
    <CodeFrame language={language} title={title} text={text} preProps={props}>
      {children}
    </CodeFrame>
  )
}

/**
 * The bar of a code block. It reads the code only when a button is pressed, so while a fence is
 * being written the bar is drawn once, not on every token.
 */
const CodeBar = memo(function CodeBar({
  language,
  title,
  code: text,
}: {
  language: string | undefined
  title: string | undefined
  code: CodeText
}) {
  return codeBar(react, language, title, [
    <DownloadButton key="download" code={text} name={codeFileName(title, language)} />,
    <CopyButton key="copy" code={text} />,
  ])
})

/**
 * The frame of a code block: the bar with its language and its download and copy buttons, then the
 * `<pre>`. A fence that names its file (` ```ts title="src/app.ts" `) shows the file first, the
 * language after it; a fence with no language shows none.
 */
export function CodeFrame({
  language,
  title,
  text,
  preProps,
  children,
}: {
  language: string | undefined
  title?: string | undefined
  text: string
  preProps?: ComponentPropsWithoutRef<'pre'>
  children: ReactNode
}) {
  const labels = useLabels()
  // A line too long for the reply scrolls inside the `<pre>`: the keyboard must then reach it.
  const [attach, scrolls, again] = useScrolls<HTMLPreElement>()
  const current = useRef(text)
  useEffect(() => {
    // Not on the first drawing: the box was measured as it was attached.
    if (current.current === text) return
    current.current = text
    again()
  }, [text, again])
  return codeFrame(
    react,
    language,
    <CodeBar language={language} title={title} code={current} />,
    {
      ...(preProps as Props | undefined),
      ref: attach,
      ...(scrolls ? { role: 'group', 'aria-label': labels.scrollableCode, tabIndex: 0 } : null),
    },
    [children],
  )
}
