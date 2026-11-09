/**
 * A seeded generator (mulberry32): the same seed gives the same replies and the same chunks on
 * every machine, so two runs differ only in the code they measure.
 */
export function seeded(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
  return { next, int, pick }
}

export type Random = ReturnType<typeof seeded>

/** FNV-1a of a text, printed with each scenario so a changed corpus is never compared silently. */
export function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}
