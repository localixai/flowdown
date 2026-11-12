'use client'

import { useState } from 'react'

/**
 * Whether a box scrolls sideways: a table's box, or the `<pre>` of a code block.
 *
 * A box that scrolls is a named group the Tab key stops on, so the arrow keys can scroll it:
 * without that what is past the edge cannot be reached from the keyboard at all (WCAG 2.1.1). A box
 * whose content fits stays out of the Tab order. It is measured again whenever it, or the `inner`
 * element that holds its content, changes size.
 *
 * A line of code getting longer resizes neither, so the caller says when its text has changed
 * (`again`): the box is then measured once in the next frame, when the page is laid out anyway. A
 * measuring per token would lay the page out per token.
 *
 * Two hooks and no effect: a code block is drawn again on every token of its text, and an update
 * there is short enough that each hook a component calls shows in the stream's whole time.
 */
export function useScrolls<T extends HTMLElement>(
  inner?: string,
): [attach: (element: T | null) => void, scrolls: boolean, again: () => void] {
  const [scrolls, setScrolls] = useState(false)
  const [box] = useState(() => watch<T>(setScrolls, inner))
  return [box.attach, scrolls, box.again]
}

/** The watching of one box, from React attaching it (`attach(element)`) to its leaving (`attach(null)`). */
function watch<T extends HTMLElement>(tell: (scrolls: boolean) => void, inner: string | undefined) {
  let box: T | null = null
  let observer: ResizeObserver | null = null
  let frame = 0
  // One pixel of slack: a subpixel content width rounds up past the box it fits in.
  const measure = () => {
    if (box) tell(box.scrollWidth > box.clientWidth + 1)
  }
  return {
    attach(element: T | null): void {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      observer?.disconnect()
      observer = null
      box = element
      if (!element) return
      measure()
      if (typeof ResizeObserver === 'undefined') return
      observer = new ResizeObserver(measure)
      observer.observe(element)
      const content = inner ? element.querySelector(inner) : null
      if (content) observer.observe(content)
    },
    again(): void {
      if (!box || typeof requestAnimationFrame !== 'function') return
      frame ||= requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    },
  }
}
