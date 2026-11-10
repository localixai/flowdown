'use client'
import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useRenderContext } from './context'
import { childrenToText, getLanguage } from './helpers'
import { CheckIcon, CopyIcon } from './icons'
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

const noSubscribe = () => () => {}
const hasClipboard = () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard)
const noClipboard = () => false

function CopyButton({ text }: { text: string }) {
  const labels = useLabels()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  // No clipboard (an insecure origin, a test DOM): no button that would do nothing. Read after
  // hydration, so a server render and the first client render agree.
  const canCopy = useSyncExternalStore(noSubscribe, hasClipboard, noClipboard)
  if (!canCopy) return null
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), COPIED_MS)
      },
      () => {
        /* Denied by the page or the person; the code is still selectable. */
      },
    )
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

/**
 * A fenced code block: its language and a copy button above the code. Replace it with your own
 * through `components.pre`; the `Code` inside still highlights.
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
 * The frame of a code block: the bar with its language and copy button, then the `<pre>`. A fence
 * that names its file (` ```ts title="src/app.ts" `) shows the file first, the language after it.
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
  return (
    <figure className="llx-code" data-language={language}>
      <figcaption className="llx-code-bar">
        {title ? <span className="llx-code-title">{title}</span> : null}
        <span className="llx-code-language">{language ?? ''}</span>
        <CopyButton text={text} />
      </figcaption>
      <pre {...preProps}>{children}</pre>
    </figure>
  )
}
