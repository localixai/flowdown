'use client'
import { useEffect, useState } from 'react'
import { loadOnce } from '../core/load-once'

/**
 * A stage of the pipeline that a page may load on demand: math (`llx-markdown/math`), raw HTML
 * (`llx-markdown/html`). Given as the module itself (it is used at once, server rendering
 * included), or as a loader that imports it (it is fetched the first time a document needs it).
 */
export type StageLoader<T> = () => Promise<T | { default: T }>
export type StageOption<T> = T | StageLoader<T> | null

const loaders = new WeakMap<StageLoader<object>, () => Promise<object>>()
const loaded = new WeakMap<StageLoader<object>, object>()

function loaderFor<T extends object>(load: StageLoader<T>): () => Promise<object> {
  let once = loaders.get(load)
  if (!once) {
    once = loadOnce(async () => {
      const module = await load()
      const stage = 'default' in module ? module.default : module
      loaded.set(load, stage)
      return stage
    })
    loaders.set(load, once)
  }
  return once
}

/**
 * The stage for a document, or null while it is not there. A loader is called the first time a
 * document needs it, once per page, however many documents ask; until it resolves the document
 * renders without it, and a failed load leaves it that way (the next document asks again).
 */
export function useStage<T extends object>(option: StageOption<T>, needed: boolean): T | null {
  const lazy = typeof option === 'function' ? (option as StageLoader<T>) : null
  const [, setReady] = useState(0)
  useEffect(() => {
    if (!lazy || !needed || loaded.has(lazy)) return
    let current = true
    loaderFor(lazy)().then(
      () => {
        if (current) setReady((count) => count + 1)
      },
      () => {
        /* The document stays readable without the stage. */
      },
    )
    return () => {
      current = false
    }
  }, [lazy, needed])
  if (!option || !needed) return null
  return lazy ? ((loaded.get(lazy) as T | undefined) ?? null) : (option as T)
}
