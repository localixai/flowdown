import { useSyncExternalStore } from 'react'

type Theme = 'system' | 'light' | 'dark'
const KEY = 'llx-site-theme'
const THEMES: { value: Theme; label: string; glyph: string }[] = [
  { value: 'system', label: 'System theme', glyph: '◐' },
  { value: 'light', label: 'Light theme', glyph: '☀' },
  { value: 'dark', label: 'Dark theme', glyph: '☾' },
]

// The choice lives on <html>; components read it from there, so every toggle agrees.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
function current(): Theme {
  const theme = document.documentElement.dataset.theme
  return theme === 'light' || theme === 'dark' ? theme : 'system'
}
// The server knows no stored choice, and hydration starts from what it rendered.
const serverTheme = (): Theme => 'system'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    /* A private window: the choice lasts for this page only. */
  }
}

/**
 * System, light or dark. It sets `data-theme` on <html>, which the library's tokens follow. The
 * stored choice is applied before paint by the inline script in index.html; hydration renders
 * "system" like the server did, then React switches to what <html> says.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, serverTheme)
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {THEMES.map(({ value, label, glyph }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
        >
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  )
}
