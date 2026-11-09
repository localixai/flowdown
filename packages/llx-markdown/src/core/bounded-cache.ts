/**
 * A least-recently-used cache bounded by entry count and by total weight.
 *
 * Typeset formulas and drawn diagrams are kept for the life of the page, so a long chat does not
 * pay KaTeX or Mermaid again when a message scrolls back into view. Both are bounded by weight as
 * well as count: one big entity diagram is hundreds of kilobytes of SVG, so a count alone would
 * not bound the heap.
 *
 * `Map` insertion order is the recency queue: a hit is re-inserted at the tail, and eviction takes
 * from the head. A value heavier than the whole budget is not stored, so it cannot flush every
 * small entry on its way in.
 */
export interface BoundedCache<K, V> {
  get(key: K): V | undefined
  set(key: K, value: V): boolean
  readonly size: number
}

export interface BoundedCacheOptions<K, V> {
  maxEntries: number
  maxWeight?: number
  weigh?: (value: V, key: K) => number
}

export function createBoundedCache<K, V>({
  maxEntries,
  maxWeight = Number.POSITIVE_INFINITY,
  weigh = () => 0,
}: BoundedCacheOptions<K, V>): BoundedCache<K, V> {
  const entries = new Map<K, { value: V; weight: number }>()
  let total = 0

  const remove = (key: K) => {
    const entry = entries.get(key)
    if (!entry) return
    total -= entry.weight
    entries.delete(key)
  }

  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value) {
      remove(key)
      const weight = weigh(value, key)
      if (weight > maxWeight) return false
      entries.set(key, { value, weight })
      total += weight
      // oxlint-disable-next-line no-unmodified-loop-condition -- `remove` lowers `total`.
      while (entries.size > maxEntries || total > maxWeight) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        remove(oldest.value)
      }
      return entries.has(key)
    },
    get size() {
      return entries.size
    },
  }
}
