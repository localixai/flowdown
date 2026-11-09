'use client'
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GrowingFence, useRenderContext } from '../react/context'
import { useLabels } from '../react/labels'
import { resolveMermaidLook } from './look'

/**
 * A counter that moves whenever the page may have changed its colours: the system scheme, or a
 * theme class or attribute on the root element. A diagram is drawn in resolved colours (`look.ts`),
 * so it has to be drawn again when they change; the renderer's cache makes a redraw in a look it
 * has seen free.
 */
let schemeVersion = 0
function subscribeScheme(notify: () => void) {
  const bump = () => {
    schemeVersion += 1
    notify()
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', bump)
  const observer = new MutationObserver(bump)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  })
  return () => {
    media?.removeEventListener('change', bump)
    observer.disconnect()
  }
}
const useSchemeVersion = () =>
  useSyncExternalStore(
    subscribeScheme,
    () => schemeVersion,
    () => 0,
  )

type DrawState = { source: string; svg?: string; error?: string }

/**
 * A ```mermaid fence. Drawn when the page gave `<Markdown>` a Mermaid loader, in the colours of the
 * Markdown around it; until then, without one, while its fence is still being written, or when the
 * source does not parse, it is shown as the source it is, with a line saying why.
 */
export function Diagram({ source }: { source: string }) {
  const labels = useLabels()
  const { mermaid } = useRenderContext()
  const growing = useContext(GrowingFence)
  const scheme = useSchemeVersion()
  const figure = useRef<HTMLElement>(null)
  const [state, setState] = useState<DrawState | null>(null)

  useEffect(() => {
    const root = figure.current
    if (!mermaid || growing || !root) return
    const controller = new AbortController()
    const look = resolveMermaidLook(root)
    const ready = mermaid.peek(source, look)
    if (ready) {
      setState({ source, svg: ready })
      return
    }
    mermaid.render(source, look, controller.signal).then(
      (svg) => {
        if (!controller.signal.aborted) setState({ source, svg })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const reason = error instanceof Error ? error.message : String(error)
        setState({ source, error: reason.split('\n')[0] || reason })
      },
    )
    return () => controller.abort()
    // `scheme` is read by `resolveMermaidLook` through the page's styles: a theme change redraws.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [mermaid, growing, source, scheme])

  const drawn = state?.source === source ? state : null
  if (drawn?.svg) {
    return (
      <figure ref={figure} aria-label={labels.diagram} className="llx-diagram">
        <div className="llx-diagram-canvas" dangerouslySetInnerHTML={{ __html: drawn.svg }} />
      </figure>
    )
  }
  const note = drawn?.error
    ? labels.diagramFailed(drawn.error)
    : mermaid
      ? labels.drawingDiagram
      : null
  return (
    <figure ref={figure} className="llx-diagram" data-state={drawn?.error ? 'error' : 'source'}>
      <pre>
        <code className="language-mermaid">{source}</code>
      </pre>
      {note && (
        <figcaption className="llx-diagram-note" role="status">
          {note}
        </figcaption>
      )}
    </figure>
  )
}
