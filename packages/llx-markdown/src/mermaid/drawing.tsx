'use client'
/**
 * The drawn half of a diagram: its toolbar, the colours it is drawn in and the page's renderer.
 * A chunk of its own, fetched with the Mermaid engine the first time a page draws a diagram: a
 * page whose replies hold none never loads it.
 */
import { lazy, Suspense, useEffect, useRef, useState, type Ref } from 'react'
import { copyText, downloadFile } from '../react/file-actions'
import { CheckIcon, CopyIcon, DownloadIcon } from '../react/icons'
import { useLabels } from '../react/labels'
import { DiagramIcon, EnlargeIcon, SourceIcon } from './icons'

export { resolveMermaidLook } from './look'
export { pageMermaidRenderer } from './renderer'

/**
 * The enlarged viewer is its own chunk: most diagrams are never enlarged, so its pan and zoom
 * load on the first Enlarge (or when the pointer reaches the button), not with the renderer.
 */
const loadViewer = () => import('./viewer')
const DiagramViewer = lazy(() => loadViewer().then((module) => ({ default: module.DiagramViewer })))

/**
 * The drawn `<svg>` as a standalone file: serialized from the page, so it is what the reader sees.
 * The page sizes it by CSS; the file gets its own size from its `viewBox`.
 */
function serializeSvg(svg: SVGSVGElement): string {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const box = copy
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (box && box.length === 4 && box.every(Number.isFinite)) {
    copy.setAttribute('width', String(box[2]))
    copy.setAttribute('height', String(box[3]))
    copy.style.removeProperty('max-width')
  }
  const text = new XMLSerializer().serializeToString(copy)
  return text.includes('xmlns=')
    ? text
    : text.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
}

/** How long "Copied" stays before the button reads "Copy source" again. */
const COPIED_MS = 1_600

/**
 * A drawn diagram and its toolbar: enlarge it, swap it for its source and back, copy the source,
 * save the picture. The toolbar shows on hover and on focus, and always under a finger.
 */
export function DrawnDiagram({
  figure,
  svg,
  source,
  toolbar,
}: {
  /** Not `ref`: React 18 does not pass one to a function component. */
  figure: Ref<HTMLElement>
  svg: string
  source: string
  toolbar: boolean
}) {
  const labels = useLabels()
  const canvas = useRef<HTMLDivElement>(null)
  const enlargeButton = useRef<HTMLButtonElement>(null)
  const [showSource, setShowSource] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = () => {
    void copyText(source).then((done) => {
      if (!done) return
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    })
  }
  const download = () => {
    // The picture on the page when it is shown (what the reader sees), else the one drawn.
    const drawn = canvas.current?.querySelector('svg')
    downloadFile(drawn ? serializeSvg(drawn) : svg, 'diagram.svg', 'image/svg+xml')
  }
  const close = () => {
    setEnlarged(false)
    enlargeButton.current?.focus()
  }
  const Copied = copied ? CheckIcon : CopyIcon
  const Swap = showSource ? DiagramIcon : SourceIcon
  const swapLabel = showSource ? labels.showDiagram : labels.showSource

  return (
    <figure
      ref={figure}
      aria-label={labels.diagram}
      className="llx-diagram"
      data-view={showSource ? 'source' : undefined}
    >
      {toolbar && (
        <div className="llx-diagram-actions">
          <button
            ref={enlargeButton}
            type="button"
            className="llx-diagram-action"
            aria-label={labels.enlarge}
            title={labels.enlarge}
            aria-haspopup="dialog"
            onClick={() => setEnlarged(true)}
            onPointerEnter={() => void loadViewer()}
            onFocus={() => void loadViewer()}
          >
            <EnlargeIcon />
          </button>
          <button
            type="button"
            className="llx-diagram-action"
            aria-label={swapLabel}
            title={swapLabel}
            onClick={() => setShowSource((shown) => !shown)}
          >
            <Swap />
          </button>
          <button
            type="button"
            className="llx-diagram-action"
            aria-label={copied ? labels.copied : labels.copySource}
            title={copied ? labels.copied : labels.copySource}
            data-copied={copied || undefined}
            onClick={copy}
          >
            <Copied />
          </button>
          <button
            type="button"
            className="llx-diagram-action"
            aria-label={labels.downloadSvg}
            title={labels.downloadSvg}
            onClick={download}
          >
            <DownloadIcon />
          </button>
        </div>
      )}
      {showSource ? (
        <pre>
          <code className="language-mermaid">{source}</code>
        </pre>
      ) : (
        <div
          ref={canvas}
          className="llx-diagram-canvas"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {enlarged && (
        <Suspense fallback={null}>
          <DiagramViewer svg={svg} onClose={close} />
        </Suspense>
      )}
    </figure>
  )
}
