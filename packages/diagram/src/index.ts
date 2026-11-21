/**
 * `@localix-ai/diagram`: Mermaid diagrams as agents write them, every kind Mermaid has, for a page
 * and for a terminal, from one layout.
 *
 * - `toSVG(source, { columns, title })`: an SVG document for a page, or null when the source is
 *   not a diagram this reads (the caller shows the source).
 * - `drawDiagram(source, columns)` (also `@localix-ai/diagram/terminal`): terminal rows.
 *
 * Reads any text and never throws; every construct read has a bound.
 */
import { drawDiagram } from './terminal/index'
import { cellsToSVG } from './svg'
import { pieSVG } from './pie-svg'

export interface SVGOptions {
  /**
   * The widest the drawing may run, in cells of a label's letter (8.4 px each): past it a graph is
   * laid out tighter, and one that cannot fit is written as an outline. 120 by default.
   */
  columns?: number
  /** The diagram's accessible name. */
  title?: string
}

/** `source` as an SVG document, or null when it is not a diagram this reads. */
export function toSVG(source: string, options: SVGOptions = {}): string | null {
  const pie = pieSVG(source, options.title ?? '')
  if (pie !== undefined) return pie
  const lines = drawDiagram(source, options.columns ?? 120)
  return lines ? cellsToSVG(lines, options.title ?? '') : null
}

export { drawDiagram } from './terminal/index'
export type { Line, Span, Style } from './style'
