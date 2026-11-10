'use client'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import { useLabels } from '../react/labels'
import { CloseIcon, FitIcon, MinusIcon, PlusIcon } from './icons'

/**
 * The enlarged diagram: a modal `<dialog>` over the page, with the picture on a stage that pans
 * and zooms. Plain state and a CSS transform; no gesture library. Loaded only when a diagram is
 * first enlarged (`diagram.tsx`).
 */

/** Where the picture sits: its scale (1 is its own size) and its offset from the stage's centre. */
interface View {
  scale: number
  x: number
  y: number
}
interface Point {
  x: number
  y: number
}
/** A drag or a pinch in progress, measured from where it started. */
interface Gesture {
  from: View
  start: Point
  distance: number
}

/** A button or key zooms by this much; the wheel by its own delta. */
const STEP = 1.25
/** An arrow key pans by this many pixels. */
const PAN = 48
/** Room left around a fitted diagram. */
const PADDING = 32

/**
 * A diagram's size in its own units, from the opening tag alone: its `viewBox`, else its `width`
 * and `height`. Mermaid writes `width="100%"`, so a percentage counts as unknown.
 */
function diagramBounds(svg: string) {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? ''
  const attribute = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(root)?.[2]
  const length = (name: string) => {
    const value = attribute(name)
    return value?.includes('%') ? undefined : Number.parseFloat(value ?? '')
  }
  const box = attribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const positive = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback
  return {
    width: positive(box?.[2] ?? length('width'), 800),
    height: positive(box?.[3] ?? length('height'), 600),
  }
}

/**
 * The scale that shows the whole diagram on the stage, kept as the stage resizes. A small diagram
 * is enlarged up to twice its size; a stage not laid out yet (a test DOM) shows it at its own.
 */
function useFitScale(
  stage: RefObject<HTMLDivElement | null>,
  size: { width: number; height: number },
) {
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width <= PADDING || height <= PADDING) return
      setFit(Math.min((width - PADDING) / size.width, (height - PADDING) / size.height, 2))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [stage, size])
  return fit
}

/** `from` zoomed by `factor` around `point` (relative to the stage's centre), within the limits. */
function zoomed(from: View, factor: number, point: Point, fit: number): View {
  const scale = Math.min(Math.max(fit, 1) * 8, Math.max(Math.min(fit, 1) / 4, from.scale * factor))
  const k = scale / from.scale
  return { scale, x: point.x - (point.x - from.x) * k, y: point.y - (point.y - from.y) * k }
}

const centre: Point = { x: 0, y: 0 }

/** The first two pointers' midpoint and distance apart; the distance is 0 for one pointer. */
function spread(pointers: Map<number, Point>): { start: Point; distance: number } {
  const [first, second] = [...pointers.values()]
  if (!first) return { start: centre, distance: 0 }
  if (!second) return { start: first, distance: 0 }
  return {
    start: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  }
}

const ZOOM_KEYS = new Map([
  ['+', STEP],
  ['=', STEP],
  ['-', 1 / STEP],
  ['_', 1 / STEP],
])
/** The picture follows the key: the right arrow shows what is to the right. */
const PAN_KEYS = new Map<string, Point>([
  ['ArrowLeft', { x: PAN, y: 0 }],
  ['ArrowRight', { x: -PAN, y: 0 }],
  ['ArrowUp', { x: 0, y: PAN }],
  ['ArrowDown', { x: 0, y: -PAN }],
])

export function DiagramViewer({ svg, onClose }: { svg: string; onClose: () => void }) {
  const labels = useLabels()
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const size = useMemo(() => diagramBounds(svg), [svg])
  const fit = useFitScale(stage, size)
  // Null until the reader moves the picture: it stays fitted while the window resizes.
  const [moved, setMoved] = useState<View | null>(null)
  // A drag or pinch follows the finger; only a button or a key glides (`data-moving` off).
  const [moving, setMoving] = useState(false)
  const view = moved ?? { scale: fit, x: 0, y: 0 }
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!element.open) element.showModal()
    stage.current?.focus()
    // No close on cleanup: a dialog leaves the top layer with the page when it unmounts, and a
    // close here would end the viewer in Strict Mode, whose second mount follows a cleanup.
  }, [])

  // The wheel zooms at the pointer; a trackpad pinch arrives as the wheel with Ctrl held. A
  // listener of its own, because React's is passive and the page behind must not scroll.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = element.getBoundingClientRect()
      const point = {
        x: event.clientX - box.left - box.width / 2,
        y: event.clientY - box.top - box.height / 2,
      }
      const delta = Math.max(-100, Math.min(100, event.deltaY))
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002))
      setMoving(true)
      setMoved((current) => zoomed(current ?? { scale: fit, x: 0, y: 0 }, factor, point, fit))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [fit])

  const zoomBy = (factor: number) => {
    setMoving(false)
    setMoved(zoomed(view, factor, centre, fit))
  }
  const actualSize = () => {
    setMoving(false)
    setMoved(zoomed(view, 1 / view.scale, centre, fit))
  }
  const fitToStage = () => {
    setMoving(false)
    setMoved(null)
  }

  /** Starts a drag or a pinch from the pointers down now, from the view shown now. */
  const begin = (from: View) => {
    const now = spread(pointers.current)
    gesture.current = pointers.current.size ? { from, ...now } : null
    setMoving(pointers.current.size > 0)
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    begin(view)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current
    if (!start || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const now = spread(pointers.current)
    const box = event.currentTarget.getBoundingClientRect()
    const anchor = {
      x: start.start.x - box.left - box.width / 2,
      y: start.start.y - box.top - box.height / 2,
    }
    const factor = start.distance > 0 && now.distance > 0 ? now.distance / start.distance : 1
    const next = zoomed(start.from, factor, anchor, fit)
    setMoved({
      scale: next.scale,
      x: next.x + now.start.x - start.start.x,
      y: next.y + now.start.y - start.start.y,
    })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    // A finger lifted from a pinch: the one left drags on from here.
    begin(view)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      // Closed here rather than by the dialog's own cancel, so every browser closes the same way.
      event.preventDefault()
      dialog.current?.close()
      return
    }
    if (event.altKey || event.metaKey || event.ctrlKey) return
    const factor = ZOOM_KEYS.get(event.key)
    const pan = PAN_KEYS.get(event.key)
    if (factor) zoomBy(factor)
    else if (event.key === '0') fitToStage()
    else if (pan) {
      setMoving(false)
      setMoved({ ...view, x: view.x + pan.x, y: view.y + pan.y })
    } else return
    event.preventDefault()
  }

  const percent = `${Math.round(view.scale * 100)}%`
  return (
    // The dialog's keys and its backdrop click; every control in it is a button of its own.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className="llx-diagram-viewer"
      aria-label={labels.diagram}
      onClose={onClose}
      onKeyDown={onKeyDown}
      // A click on the backdrop lands on the dialog itself: it closes, as a click outside does.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="llx-diagram-viewer-bar">
        <button
          type="button"
          className="llx-diagram-action"
          aria-label={labels.zoomOut}
          title={labels.zoomOut}
          onClick={() => zoomBy(1 / STEP)}
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className="llx-diagram-action llx-diagram-zoom"
          aria-label={`${labels.actualSize} (${percent})`}
          title={labels.actualSize}
          onClick={actualSize}
        >
          {percent}
        </button>
        <button
          type="button"
          className="llx-diagram-action"
          aria-label={labels.zoomIn}
          title={labels.zoomIn}
          onClick={() => zoomBy(STEP)}
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className="llx-diagram-action"
          aria-label={labels.fit}
          title={labels.fit}
          onClick={fitToStage}
        >
          <FitIcon />
        </button>
        <button
          type="button"
          className="llx-diagram-action llx-diagram-close"
          aria-label={labels.close}
          title={labels.close}
          onClick={() => dialog.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>
      {/* A pan and zoom surface: it takes the focus so the keys reach it, and handles its own. */}
      <div
        ref={stage}
        className="llx-diagram-stage"
        role="application"
        aria-label={labels.diagram}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        data-moving={moving || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="llx-diagram-viewer-canvas"
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
          // The same SVG the page shows, from Mermaid in strict mode.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </dialog>
  )
}
