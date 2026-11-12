// A formula typeset by KaTeX, remembered by its source.
//
// A streaming reply is read again on every token, and typesetting is the expensive part of a
// formula: thirty of them cost about 12 ms a pass against half a millisecond for the rest of the
// Markdown. A finished formula never changes, so what KaTeX made of it is kept and reused: only
// an expression not seen before pays KaTeX.
import katex from 'katex'
import { createBoundedCache } from '../core/bounded-cache'

/** What the renderer draws a formula from: the element KaTeX wraps it in, and the HTML inside. */
export interface Typeset {
  hName: 'span'
  hProperties: {
    className: string
    innerHTML: string
    title?: string
    style?: Record<string, string>
  }
}

const cache = createBoundedCache<string, Typeset>({
  maxEntries: 1_000,
  // Characters of KaTeX HTML: a formula is a few KB, so this holds a long math-heavy session.
  maxWeight: 6_000_000,
  weigh: (entry, key) => entry.hProperties.innerHTML.length + key.length,
})

function renderMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, { displayMode, throwOnError: true })
  } catch {
    // KaTeX's own fallback: the source, marked as an error, instead of a thrown render.
    return katex.renderToString(source, { displayMode, throwOnError: false, strict: 'ignore' })
  }
}

const UNESCAPES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
}
const unescape = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => UNESCAPES[entity] as string)

/** KaTeX answers with one `<span>`: its attributes go on the element, its inside is the HTML. */
const OUTER = /^<span((?: [a-z-]+="[^"]*")*)>([\s\S]*)<\/span>$/

function split(html: string): Typeset {
  const outer = OUTER.exec(html)
  if (!outer) return { hName: 'span', hProperties: { className: 'katex', innerHTML: html } }
  const properties: Typeset['hProperties'] = { className: '', innerHTML: outer[2] as string }
  for (const [, name, value] of (outer[1] as string).matchAll(/ ([a-z-]+)="([^"]*)"/g)) {
    if (name === 'class') properties.className = value as string
    else if (name === 'title') properties.title = unescape(value as string)
    else if (name === 'style') {
      const style: Record<string, string> = {}
      for (const rule of unescape(value as string).split(';')) {
        const colon = rule.indexOf(':')
        if (colon === -1) continue
        const property = rule
          .slice(0, colon)
          .trim()
          .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        style[property] = rule.slice(colon + 1).trim()
      }
      properties.style = style
    }
  }
  return { hName: 'span', hProperties: properties }
}

/** One expression typeset: from the cache when it was set before. */
export function typesetMath(source: string, displayMode: boolean): Typeset {
  const key = `${displayMode ? 'display' : 'inline'}\0${source}`
  const hit = cache.get(key)
  if (hit) return hit
  const typeset = split(renderMath(source, displayMode))
  cache.set(key, typeset)
  return typeset
}
