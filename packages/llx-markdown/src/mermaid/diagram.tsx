'use client'
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GrowingFence, useRenderContext } from '../react/context'
import { useLabels } from '../react/labels'
import type * as DrawingModule from './drawing'
import { loadMermaid } from './loader'

/**
 * What draws a diagram (its toolbar, its colours, the renderer) is a chunk of its own: a reply
 * with no diagram, or a page that gave no Mermaid loader, never loads it. Once here it is used at
 * once, so a diagram drawn before (a row scrolled back into a virtualized chat) does not flash.
 */
type Drawing = typeof DrawingModule
let drawing: Drawing | null = null
const loadDrawing = () =>
  import('./drawing').then((module) => {
    drawing = module
    return module
  })

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
    const failed = (error: unknown) => {
      if (controller.signal.aborted) return
      const reason = error instanceof Error ? error.message : String(error)
      setState({ source, error: reason.split('\n')[0] || reason })
    }
    const draw = ({ resolveMermaidLook, pageMermaidRenderer }: Drawing) => {
      if (controller.signal.aborted) return
      const renderer = mermaid === 'page' ? pageMermaidRenderer() : mermaid
      const look = resolveMermaidLook(root)
      const ready = renderer.peek(source, look)
      if (ready) {
        setState({ source, svg: ready })
        return
      }
      renderer.render(source, look, controller.signal).then((svg) => {
        if (!controller.signal.aborted) setState({ source, svg })
      }, failed)
    }
    if (drawing) draw(drawing)
    else {
      // The engine is the long fetch: it starts now, beside the chunk that will ask for it.
      if (mermaid === 'page') loadMermaid().catch(() => {})
      loadDrawing().then(draw, failed)
    }
    return () => controller.abort()
    // `scheme` is not read here: it changes when the page's colours do, and the diagram is drawn
    // again in the new ones.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [mermaid, growing, source, scheme])

  const drawn = state?.source === source ? state : null
  if (drawn?.svg && drawing) {
    const { DrawnDiagram } = drawing
    return <DrawnDiagram figure={figure} svg={drawn.svg} source={source} toolbar={!growing} />
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
