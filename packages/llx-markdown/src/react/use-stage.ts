'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * A stage of the pipeline that a page may load on demand: math (`llx-markdown/math`), raw HTML
 * (`llx-markdown/html`). Given as the module itself (it is used at once, server rendering
 * included), or as a loader that imports it (it is fetched the first time a document needs it).
 */
export type StageLoader<T> = () => Promise<T | { default: T }>
export type StageOption<T> = T | StageLoader<T> | null

/** Stages already loaded on this page, by the loader that brought them. */
const loaded = new WeakMap<StageLoader<object>, object>()

const unwrap = <T extends object>(module: T | { default: T }): T =>
  'default' in module ? module.default : module

/**
 * The stage for a document, or null while it is not there. Each `<Markdown>` calls its loader
 * once, the first time its document needs the stage, and keeps what it brought: a loader written
 * inline, a new function on every render, is not called again, and the stage does not drop out
 * while the page re-renders (on every token of a reply). The bundler fetches the module once for
 * the whole page. Until it resolves the document renders without it, and a failed load leaves it
 * that way (the next document to mount asks again).
 */
export function useStage<T extends object>(option: StageOption<T>, needed: boolean): T | null {
  const lazy = typeof option === 'function' ? (option as StageLoader<T>) : null
  const latest = useRef(lazy)
  useEffect(() => {
    latest.current = lazy
  })
  // A stage another document on the page already loaded is there from the first render.
  const [stage, setStage] = useState<T | null>(() =>
    lazy ? ((loaded.get(lazy) as T | undefined) ?? null) : null,
  )
  const isLazy = lazy !== null
  useEffect(() => {
    const load = latest.current
    if (!isLazy || !needed || stage || !load) return
    let current = true
    load().then(
      (module) => {
        const value = unwrap(module)
        loaded.set(load, value)
        if (current) setStage(value)
      },
      () => {
        /* The document stays readable without the stage. */
      },
    )
    return () => {
      current = false
    }
  }, [isLazy, needed, stage])
  if (!option || !needed) return null
  return lazy ? stage : (option as T)
}
