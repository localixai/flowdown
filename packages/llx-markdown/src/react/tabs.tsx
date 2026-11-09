'use client'
import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useLabels } from './labels'

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
  const tabs = Children.toArray(children).filter((child): child is ReactElement<TabProps> =>
    isValidElement(child),
  )
  if (tabs.length === 0) return null
  // A streamed form can lose a tab between renders only by being re-parsed; never point past it.
  const current = active < tabs.length ? active : 0
  const tabId = (index: number) => `${base}-tab-${index}`
  const panelId = (index: number) => `${base}-panel-${index}`

  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length
    setActive(next)
    buttons.current[next]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    select(target)
  }

  return (
    <div className="llx-tabs">
      <div className="llx-tab-list" role="tablist" aria-label={labels.variants}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            id={tabId(index)}
            className="llx-tab"
            aria-selected={index === current}
            aria-controls={panelId(index)}
            tabIndex={index === current ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.props['data-label'] || String(index + 1)}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={panelId(index)}
          aria-labelledby={tabId(index)}
          className="llx-tab-panel"
          hidden={index !== current}
        >
          {tab.props.children}
        </div>
      ))}
    </div>
  )
}
