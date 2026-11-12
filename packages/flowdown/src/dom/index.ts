/**
 * `@localix-ai/flowdown/dom`: Markdown on a page with no framework.
 *
 *     import { mount } from '@localix-ai/flowdown/dom'
 *     import '@localix-ai/flowdown/styles.css'
 *
 *     const reply = mount(document.querySelector('#reply'))
 *     for await (const text of stream) reply.update(text, { streaming: true })
 *     reply.update(text)
 *
 * The elements are the ones `<Markdown>` draws, and the page is kept up to date the same way: a
 * block that did not change is not touched, so a token costs the last block. Tabs switch, a file
 * tree folds, a code block copies and saves, a wide table scrolls: all with the keyboard too.
 *
 * It is also what a binding for a framework is made of: mount into the element the framework
 * gives you, call `update` when the text changes, `destroy` when the element goes.
 */
import { codeFileName, copyText, downloadFile } from '../browser/file-actions'
import { mergeLabels, type MarkdownLabels } from '../render/labels'
import { createView, type ViewOptions } from '../render/view'
import type { DrawnElement } from '../render/vnode'
import { create, patch } from './patch'

export type { ViewComponents } from '../render/view'
export type { VComponent, VElement, VNode } from '../render/vnode'
export { DEFAULT_LABELS, type LabelOverrides, type MarkdownLabels } from '../render/labels'
export type { Highlighter } from '../render/views'
export { defaultUrlTransform, type UrlTransform } from '../engine/url'
export type { Extension, Node } from '../engine/types'

export type MountOptions = Omit<ViewOptions, 'host' | 'idPrefix'>

export interface UpdateOptions {
  /** The text is a reply still arriving: its unfinished end is completed, and a caret follows it. */
  streaming?: boolean
}

export interface Mounted {
  /** The document's root: `<div class="flowdown">`, the last child of what it was mounted in. */
  readonly element: HTMLElement
  /** Shows `markdown`. Call it on every token: what did not change is not drawn again. */
  update(markdown: string, options?: UpdateOptions): void
  /** Takes the document off the page and stops everything it started. */
  destroy(): void
}

/** Documents mounted so far: each gets its own ids for its tabs. */
let mounts = 0

/**
 * A table's box, or a code block's `<pre>`, scrolls sideways when what it holds is wider: then the
 * keyboard must reach it.
 */
function measure(box: Element, labels: MarkdownLabels): void {
  // One pixel of slack: a subpixel content width rounds up past the box it fits in.
  const scrolls = box.scrollWidth > box.clientWidth + 1
  if (scrolls === box.hasAttribute('tabindex')) return
  const label = box.localName === 'pre' ? labels.scrollableCode : labels.scrollableTable
  if (scrolls) {
    box.setAttribute('role', 'group')
    box.setAttribute('aria-label', label)
    box.setAttribute('tabindex', '0')
  } else {
    box.removeAttribute('role')
    box.removeAttribute('aria-label')
    box.removeAttribute('tabindex')
  }
}

export function mount(target: Element, options: MountOptions = {}): Mounted {
  const document = target.ownerDocument
  const labels = mergeLabels(options.labels)
  let text = ''
  let streaming = false
  let shown: DrawnElement | null = null
  let root: HTMLElement | null = null
  let drawing = false
  let again = false
  let gone = false

  /** The table boxes on the page, and the ones made since the last drawing. */
  const boxes = new WeakSet<Element>()
  let fresh: Element[] = []
  /** Whether a measuring of the last code block is already waiting for the next frame. */
  let asked = false
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const box = entry.target.closest('.fd-table, pre')
            if (box) measure(box, labels)
          }
        })

  const view = createView({
    ...options,
    idPrefix: `fd-${(mounts += 1)}-`,
    host: {
      redraw: () => draw(),
      copy: copyText,
      download: (code, title, language) => downloadFile(code, codeFileName(title, language)),
      table: (box) => {
        const element = box as Element
        if (boxes.has(element)) return
        boxes.add(element)
        fresh.push(element)
      },
    },
  })

  function draw(): void {
    if (gone) return
    // A listener that fires while the page is being changed asks for one more drawing after it.
    if (drawing) {
      again = true
      return
    }
    drawing = true
    try {
      do {
        again = false
        const next = view.render(text, streaming)
        if (root === null || shown === null) {
          root = create(next, document) as HTMLElement
          target.appendChild(root)
        } else {
          root = patch(root, shown, next, document) as HTMLElement
        }
        shown = next
      } while (again)
    } finally {
      drawing = false
    }
    // Measured once it is on the page, and again whenever it or its table changes size: a reply
    // that streams a row in, a window made narrower.
    for (const box of fresh) {
      measure(box, labels)
      if (observer) {
        observer.observe(box)
        const table = box.querySelector('table')
        if (table) observer.observe(table)
      }
    }
    fresh = []
    // A line of code getting longer resizes nothing an observer watches. The block being written
    // is the last one: it is measured once a frame, when the page is laid out anyway.
    if (!asked && root !== null && typeof requestAnimationFrame === 'function') {
      asked = true
      requestAnimationFrame(() => {
        asked = false
        if (gone || root === null) return
        const blocks = root.getElementsByTagName('pre')
        const last = blocks[blocks.length - 1]
        if (last && boxes.has(last)) measure(last, labels)
      })
    }
  }

  draw()

  return {
    get element() {
      return root!
    },
    update(markdown, { streaming: live = false } = {}) {
      text = markdown
      streaming = live
      draw()
    },
    destroy() {
      if (gone) return
      gone = true
      observer?.disconnect()
      view.dispose()
      root?.remove()
    },
  }
}
