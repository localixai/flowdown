'use client'

import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import type { Props } from '../render/factory'
import { table } from '../render/views'
import { useLabels } from './labels'
import { react } from './render'

/**
 * A table in a box of its own that scrolls sideways: a wide comparison then scrolls inside the
 * reply instead of widening the page, which on a phone pushed every line of text off screen.
 *
 * A box that scrolls is a region the Tab key stops on, so the arrow keys can scroll it: without
 * that the columns past the edge cannot be reached from the keyboard at all (WCAG 2.1.1). A table
 * that fits stays out of the Tab order. The box is measured again whenever it or the table changes
 * size: a reply that streams a row in, or a window made narrower.
 */
export function Table({
  children,
  ...props
}: ComponentPropsWithoutRef<'table'> & { node?: unknown }) {
  const labels = useLabels()
  // The box, once React has attached it: the measuring starts then.
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const element = box
    if (!element) return
    // One pixel of slack: a subpixel table width rounds up past the box it fits in.
    const measure = () => setScrolls(element.scrollWidth > element.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const inner = element.querySelector('table')
    if (inner) observer.observe(inner)
    return () => observer.disconnect()
  }, [box])
  return table(react, props as Props, children === undefined ? [] : [children], scrolls, labels, {
    ref: setBox,
  })
}
