'use client'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { readTabs, tabs } from '../render/views'
import { useLabels } from './labels'
import { react } from './render'

type TabProps = { children?: ReactNode; node?: unknown; 'data-label'?: string }

/**
 * One variant of a `[!TABS]` form. Its label rides as a data attribute; the panel is drawn by
 * `Tabs`, so on its own this is just its content.
 */
export function Tab({ children }: TabProps) {
  return <>{children}</>
}

/**
 * `[!TABS]`: the variants of one answer (an install per OS, an example per language), of which
 * the reader needs one. The first is shown. Every panel stays in the document, `hidden`, so a
 * search on the page, a copy of the whole reply and a screen reader's panel navigation still
 * reach the others.
 *
 * The WAI-ARIA tabs pattern: one Tab stop for the row, the arrow keys, Home and End move between
 * tabs and select them, each tab names the panel it controls.
 */
export function Tabs({ children }: { children?: ReactNode; node?: unknown }) {
  const labels = useLabels()
  const base = useId()
  const [active, setActive] = useState(0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const list = readTabs(react, children === undefined ? [] : [children])
  if (list.length === 0) return null
  // A streamed form can lose a tab between renders only by being re-parsed; never point past it.
  const current = active < list.length ? active : 0

  const select = (index: number) => {
    const next = (index + list.length) % list.length
    setActive(next)
    buttons.current[next]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: list.length - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    select(target)
  }

  return tabs(react, list, current, base, labels, (index) => ({
    ref: (element: HTMLButtonElement | null) => {
      buttons.current[index] = element
    },
    onClick: () => setActive(index),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index),
  }))
}
