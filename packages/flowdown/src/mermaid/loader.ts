import { loadOnce } from '../core/load-once'
import type { MermaidEngine } from './renderer'

/**
 * What `<Markdown mermaid={…}>` takes: `true` for the package's own drawing
 * (`@localix-ai/diagram`, built in), or a loader for another engine, `() => import('mermaid')`.
 */
export type MermaidLoader = () => Promise<MermaidEngine | { default: MermaidEngine }>

/**
 * The package's own engine: `@localix-ai/diagram`, every kind Mermaid has, drawn as SVG from the
 * layout a terminal draws too, in the page's colours. Fetched the first time a diagram shows, so a
 * page without one never loads it. It is Mermaid's engine in shape (`initialize`, `parse`,
 * `render`), so everything around a diagram (its cache, its viewer) is the same for either.
 */
export const builtInDiagrams: MermaidLoader = () =>
  import('@localix-ai/diagram').then(({ toSVG }) => ({
    initialize() {},
    async parse(text: string) {
      if (toSVG(text, { columns: 120 }) === null) throw new Error('Not a diagram this draws')
      return true
    },
    async render(_id: string, text: string) {
      const svg = toSVG(text, { columns: 120 })
      if (svg === null) throw new Error('Not a diagram this draws')
      return { svg }
    },
  }))

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
