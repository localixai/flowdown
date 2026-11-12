'use client'

import type { ComponentPropsWithoutRef } from 'react'
import type { Props } from '../render/factory'
import { table } from '../render/views'
import { useLabels } from './labels'
import { react } from './render'
import { useScrolls } from './scrolls'

/**
 * A table in a box of its own that scrolls sideways: a wide comparison then scrolls inside the
 * reply instead of widening the page, which on a phone pushed every line of text off screen.
 *
 * A box that scrolls is a Tab stop, and one that fits is not: see `useScrolls`. The box is measured
 * again whenever it or the table changes size: a reply that streams a row in, or a window made
 * narrower.
 */
export function Table({
  children,
  ...props
}: ComponentPropsWithoutRef<'table'> & { node?: unknown }) {
  const labels = useLabels()
  const [attach, scrolls] = useScrolls<HTMLDivElement>('table')
  return table(react, props as Props, children === undefined ? [] : [children], scrolls, labels, {
    ref: attach,
  })
}
