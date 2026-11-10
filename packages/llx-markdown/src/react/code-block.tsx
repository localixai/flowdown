'use client'
import {
  isValidElement,
  memo,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useRenderContext } from './context'
import { childrenToText, getLanguage } from './helpers'
import { codeFileName, copyText, downloadFile } from './file-actions'
import { CheckIcon, CopyIcon, DownloadIcon } from './icons'
import { useLabels } from './labels'

type CodeProps = ComponentPropsWithoutRef<'code'> & { node?: unknown }
type PreProps = ComponentPropsWithoutRef<'pre'> & { node?: unknown }

/** How long "Copied" stays before the button reads "Copy" again. */
const COPIED_MS = 1_600

/**
 * Code, inline or in a fence. A fenced block is highlighted when the page gave `<Markdown>` a
 * highlighter and the fence names a language it knows; otherwise its text is printed as is.
 */
export function Code({ node: _node, className, children, ...props }: CodeProps) {
  const { highlight } = useRenderContext()
  const language = getLanguage(className)
  const html =
    language && highlight ? highlight(childrenToText(children).replace(/\n$/, ''), language) : null
  if (html === null) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
  return (
    <code
      className={[className, 'llx-highlighted'].filter(Boolean).join(' ')}
      {...props}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** The code of a block as last drawn: read when a button is pressed, not when it is drawn. */
type CodeText = { readonly current: string }

function CopyButton({ code }: { code: CodeText }) {
  const labels = useLabels()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = () => {
    // The Clipboard API, or the old copy command where the page has none (an insecure origin).
    // When both refuse there is nothing to say: the code is still selectable.
    void copyText(code.current).then((done) => {
      if (!done) return
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    })
  }
  const Glyph = copied ? CheckIcon : CopyIcon
  return (
    <button
      type="button"
      className="llx-code-copy"
      onClick={copy}
      aria-label={copied ? labels.copied : labels.copy}
      title={copied ? labels.copied : labels.copy}
      data-copied={copied || undefined}
    >
      <Glyph />
    </button>
  )
}

/** Saves the code as a file: named as its fence's title, or `code.<ext>` from its language. */
function DownloadButton({ code, name }: { code: CodeText; name: string }) {
  const labels = useLabels()
  return (
    <button
      type="button"
      className="llx-code-download"
      onClick={() => downloadFile(code.current, name)}
      aria-label={labels.download}
      title={labels.download}
    >
      <DownloadIcon />
    </button>
  )
}

/**
 * A fenced code block: its language, a download and a copy button above the code. Replace it with
 * your own through `components.pre`; the `Code` inside still highlights.
 */
export function CodeBlock({ node: _node, children, ...props }: PreProps) {
  const code = isValidElement(children)
    ? (children as ReactElement<{
        className?: string
        children?: unknown
        'data-title'?: string
      }>)
    : null
  const language = getLanguage(code?.props.className)
  const text = childrenToText(code?.props.children as never).replace(/\n$/, '')
  return (
    <CodeFrame language={language} title={code?.props['data-title']} text={text} preProps={props}>
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
  code,
}: {
  language: string | undefined
  title: string | undefined
  code: CodeText
}) {
  return (
    <figcaption className="llx-code-bar">
      {title ? <span className="llx-code-title">{title}</span> : null}
      {language ? <span className="llx-code-language">{language}</span> : null}
      <DownloadButton code={code} name={codeFileName(title, language)} />
      <CopyButton code={code} />
    </figcaption>
  )
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
  const code = useRef(text)
  useEffect(() => {
    code.current = text
  }, [text])
  return (
    <figure className="llx-code" data-language={language}>
      <CodeBar language={language} title={title} code={code} />
      <pre {...preProps}>{children}</pre>
    </figure>
  )
}
