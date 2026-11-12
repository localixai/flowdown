'use client'

import { useEffect, useRef, useState } from 'react'

const NOTHING = () => {}

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
 */
export function useScrolls<T extends HTMLElement>(
  inner?: string,
): [attach: (element: T | null) => void, scrolls: boolean, again: () => void] {
  // The box, once React has attached it: the measuring starts then.
  const [box, setBox] = useState<T | null>(null)
  const [scrolls, setScrolls] = useState(false)
  const ask = useRef(NOTHING)
  const [again] = useState(() => () => ask.current())
  useEffect(() => {
    if (!box) return
    // One pixel of slack: a subpixel content width rounds up past the box it fits in.
    const measure = () => setScrolls(box.scrollWidth > box.clientWidth + 1)
    measure()
    let frame = 0
    if (typeof requestAnimationFrame === 'function')
      ask.current = () => {
        frame ||= requestAnimationFrame(() => {
          frame = 0
          measure()
        })
      }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(box)
    const content = inner ? box.querySelector(inner) : null
    if (content) observer?.observe(content)
    return () => {
      ask.current = NOTHING
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [box, inner])
  return [setBox, scrolls, again]
}
