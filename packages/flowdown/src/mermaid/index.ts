/**
 * `@localix-ai/flowdown/mermaid`: what a page that draws ```mermaid fences itself needs, with
 * `components.diagram`: the page's one queue and cache of drawn diagrams, and the colours of
 * the tokens around an element.
 *
 * Mermaid is one global engine, so every diagram on a page goes through `mermaidRendererFor`:
 * the same renderer `<Markdown mermaid>` draws with, which lays out one diagram at a time and
 * keeps what it drew. The engine itself is the loader's: nothing here imports it.
 */
export {
  mermaidRendererFor,
  type MermaidEngine,
  type MermaidLoader,
  type MermaidRenderer,
} from './renderer'
export { resolveMermaidLook, type MermaidLook } from './look'
