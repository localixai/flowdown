// A formula as MathML (`@localix-ai/math`), remembered by its source.
//
// A streaming reply is read again on every token. A finished formula never changes, so what it
// was turned into is kept and reused: only an expression not seen before is read. The browser lays
// the MathML out itself, with the package's math font (`@localix-ai/flowdown/math.css`).
import { toMathML } from '@localix-ai/math'
import { createBoundedCache } from '../core/bounded-cache'

/** What the renderer draws a formula from: the element it is wrapped in, and the MathML inside. */
export interface Typeset {
  hName: 'span'
  hProperties: {
    className: string
    innerHTML: string
  }
}

const cache = createBoundedCache<string, Typeset>({
  maxEntries: 1_000,
  // Characters of MathML: a formula is a few hundred, so this holds a long math-heavy session.
  maxWeight: 2_000_000,
  weigh: (entry, key) => entry.hProperties.innerHTML.length + key.length,
})

/** One expression as MathML: from the cache when it was read before. Never throws. */
export function typesetMath(source: string, displayMode: boolean): Typeset {
  const key = `${displayMode ? 'display' : 'inline'}\0${source}`
  const hit = cache.get(key)
  if (hit) return hit
  const typeset: Typeset = {
    hName: 'span',
    hProperties: {
      className: displayMode ? 'fd-math fd-math-display' : 'fd-math',
      innerHTML: toMathML(source, { display: displayMode }),
    },
  }
  cache.set(key, typeset)
  return typeset
}
