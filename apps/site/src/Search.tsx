import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { searchIndex } from './content'
import { search } from './lib/search'
import { useLocation } from './router'

/**
 * Search over titles, headings and text. `/` or Cmd/Ctrl+K focuses it; the arrows move through
 * the hits, Enter opens one, Escape clears and leaves.
 */
export function Search() {
  const { navigate } = useLocation()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const results = useMemo(() => (query.trim() ? search(searchIndex(), query) : []), [query])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest('input, textarea, [contenteditable="true"]')
      if (
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typing)
      ) {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (href: string) => {
    setQuery('')
    setOpen(false)
    input.current?.blur()
    navigate(href)
  }

  const expanded = open && query.trim() !== ''
  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        placeholder="Search docs"
        aria-label="Search the documentation"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-results`}
        aria-activedescendant={expanded && results[selected] ? `${id}-${selected}` : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setSelected(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelected((index) => Math.min(index + 1, results.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelected((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter' && results[selected]) {
            event.preventDefault()
            go(results[selected].href)
          } else if (event.key === 'Escape') {
            setQuery('')
            input.current?.blur()
          }
        }}
      />
      <kbd className="search-hint" aria-hidden="true">
        /
      </kbd>
      {expanded ? (
        <div className="search-results" role="listbox" id={`${id}-results`}>
          {results.length === 0 ? (
            <div className="search-empty">Nothing found for “{query}”</div>
          ) : (
            results.map((result, index) => (
              <div
                key={result.href}
                className="search-result"
                tabIndex={-1}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selected}
                onMouseDown={(event) => {
                  event.preventDefault()
                  go(result.href)
                }}
                onMouseEnter={() => setSelected(index)}
              >
                <span className="search-title">{result.title}</span>
                <span className="search-excerpt">{result.excerpt}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
