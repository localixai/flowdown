'use client'

import { useEffect, useState } from 'react'

/**
 * Whether a box scrolls sideways: a table's box, or the `<pre>` of a code block.
 *
 * A box that scrolls is a named group the Tab key stops on, so the arrow keys can scroll it: without
 * that what is past the edge cannot be reached from the keyboard at all (WCAG 2.1.1). A box whose
 * content fits stays out of the Tab order. It is measured again whenever it, or the `inner`
 * element that holds its content, changes size, and whenever `grows` changes: a line of code
 * getting longer resizes neither.
 */
export function useScrolls<T extends HTMLElement>(
  inner?: string,
  grows?: unknown,
): [attach: (element: T | null) => void, scrolls: boolean] {
  // The box, once React has attached it: the measuring starts then.
  const [box, setBox] = useState<T | null>(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    if (!box) return
    // One pixel of slack: a subpixel content width rounds up past the box it fits in.
    const measure = () => setScrolls(box.scrollWidth > box.clientWidth + 1)
    measure()
    // `grows` is not read: its change is the reason to measure again.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [box, grows])
  useEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return
    const measure = () => setScrolls(box.scrollWidth > box.clientWidth + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    const content = inner ? box.querySelector(inner) : null
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [box, inner])
  return [setBox, scrolls]
}
