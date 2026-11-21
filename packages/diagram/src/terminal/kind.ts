/**
 * One kind of Mermaid diagram as this folder draws it: which header names it, and how its lines
 * are drawn. `index.ts` asks each kind in turn; a kind that does not read its lines says null, and
 * the caller shows the source.
 */
import type { Line } from '../style'

export interface DiagramKind {
  /** Whether a diagram's header, its first line as `diagramLines` gives it, names this kind. */
  matches(header: string): boolean
  /**
   * The diagram's lines (`diagramLines` of its source: comments and directives out, the header
   * first) as rows no wider than `columns`, or an outline of it when its picture would not fit;
   * null when the lines do not read as this kind. Never throws.
   */
  draw(lines: string[], columns: number): Line[] | null
}
