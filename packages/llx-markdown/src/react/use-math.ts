'use client'
import { useEffect, useState } from 'react'
import type { MathPlugin } from '../core/pipeline'
import { loadOnce } from '../core/load-once'

/** `llx-markdown/math` itself, or a loader that imports it: `() => import('llx-markdown/math')`. */
export type MathLoader = () => Promise<MathPlugin | { default: MathPlugin }>
export type MathOption = MathPlugin | MathLoader | null

const loaders = new WeakMap<MathLoader, () => Promise<MathPlugin>>()
const loaded = new WeakMap<MathLoader, MathPlugin>()

function loaderFor(load: MathLoader) {
  let once = loaders.get(load)
  if (!once) {
    once = loadOnce(async () => {
      const module = await load()
      const plugin = 'default' in module ? module.default : module
      loaded.set(load, plugin)
      return plugin
    })
    loaders.set(load, once)
  }
  return once
}

/**
 * The math stage for a document, or null while it is not there. A loader is called the first time
 * a document holds a formula, once per page; until it resolves, the formula reads as its source,
 * and a failed load leaves it that way (the next document asks again).
 */
export function useMath(option: MathOption, needed: boolean): MathPlugin | null {
  const lazy = typeof option === 'function' ? option : null
  const [, setReady] = useState(0)
  useEffect(() => {
    if (!lazy || !needed || loaded.has(lazy)) return
    let current = true
    loaderFor(lazy)().then(
      () => {
        if (current) setReady((count) => count + 1)
      },
      () => {
        /* The formulas stay readable source. */
      },
    )
    return () => {
      current = false
    }
  }, [lazy, needed])
  if (!option || !needed) return null
  return lazy ? (loaded.get(lazy) ?? null) : (option as MathPlugin)
}
