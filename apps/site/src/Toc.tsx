import { useEffect, useMemo, useState } from 'react'
import type { MarkdownHeading } from 'llx-markdown'

/**
 * "On this page": the `##` and `###` headings, the one being read marked. The ids are the ones
 * `<Markdown headingIds>` gives the headings, since both come from the same function.
 */
export function Toc({ headings }: { headings: MarkdownHeading[] }) {
  const items = useMemo(
    () => headings.filter((heading) => heading.depth === 2 || heading.depth === 3),
    [headings],
  )
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const targets = items
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null
  return (
    <nav className="toc" aria-label="On this page">
      <h2>On this page</h2>
      <ul>
        {items.map((heading) => (
          <li key={heading.id} data-depth={heading.depth}>
            <a
              href={`#${heading.id}`}
              aria-current={heading.id === active ? 'location' : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
