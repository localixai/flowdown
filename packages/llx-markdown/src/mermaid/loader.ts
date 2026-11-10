import { loadOnce } from '../core/load-once'
import type { MermaidEngine } from './renderer'

/** What `<Markdown mermaid={…}>` takes: a loader for the engine, `() => import('mermaid')`. */
export type MermaidLoader = () => Promise<MermaidEngine | { default: MermaidEngine }>

let latest: MermaidLoader | null = null

/**
 * The loader the page's engine comes from: the one passed most recently. A loader written inline
 * (a new function on each render) changes nothing once the engine is here.
 */
export function setMermaidLoader(load: MermaidLoader): void {
  latest = load
}

/** The page's Mermaid engine, fetched once; a failed fetch is tried again by the next diagram. */
export const loadMermaid = loadOnce<MermaidEngine>(() => {
  if (!latest) return Promise.reject(new Error('No Mermaid loader was given'))
  return latest().then((module) => ('default' in module ? module.default : module))
})
