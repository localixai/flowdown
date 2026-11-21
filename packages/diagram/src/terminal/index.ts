/**
 * Mermaid diagrams drawn in a terminal, every kind Mermaid has that cells can say honestly:
 * graphs as boxes, lines and arrows; time as bars and rails; charts as bars, plots and grids. A
 * diagram whose picture would not fit is written as an outline of what it holds; one of a kind
 * not here, or one that does not read, is left to the caller, which shows its source.
 *
 * A diagram is a model's text like the rest of a reply: every word of it passes `printable.ts`,
 * every construct read has a bound, and no input makes this throw or take time beyond its size.
 */
import type { Line } from '../style'
import { architectureDiagram } from './architecture'
import { blockDiagram } from './block'
import { c4Diagram } from './c4'
import { classDiagram } from './class'
import { erDiagram } from './er'
import { drawFlowchart } from './flowchart'
import { ganttDiagram } from './gantt'
import { gitGraphDiagram } from './gitgraph'
import { journeyDiagram } from './journey'
import { kanbanDiagram } from './kanban'
import type { DiagramKind } from './kind'
import { indentedLines } from './kit'
import { mindmapDiagram } from './mindmap'
import { packetDiagram } from './packet'
import { isFlowchart, parseFlowchart } from './parse'
import { pieDiagram } from './pie'
import { quadrantDiagram } from './quadrant'
import { radarDiagram } from './radar'
import { requirementDiagram } from './requirement'
import { sankeyDiagram } from './sankey'
import { drawSequence } from './sequence'
import { isSequence, parseSequence } from './sequence-parse'
import { stateDiagram } from './state'
import { diagramLines } from './text'
import { timelineDiagram } from './timeline'
import { treemapDiagram, treemapLines } from './treemap'
import { xychartDiagram } from './xychart'
import { zenumlDiagram } from './zenuml'

/** Past this a diagram's source is not read: no reply draws a picture that long. */
const MOST_SOURCE = 200_000
/** A terminal is never wider than this; a wider `columns` is read as it. */
const MOST_COLUMNS = 1000

const flowchartDiagram: DiagramKind = {
  matches: isFlowchart,
  draw: (lines, columns) => {
    const chart = parseFlowchart(lines)
    return chart && drawFlowchart(chart, columns)
  },
}

const sequenceDiagram: DiagramKind = {
  matches: isSequence,
  draw: (lines, columns) => {
    const chart = parseSequence(lines)
    return chart && drawSequence(chart, columns)
  },
}

/**
 * Every kind, and the lines it reads: most read them trimmed (`diagramLines`); a kind whose nesting
 * is its indentation reads them as written.
 */
const KINDS: ReadonlyArray<readonly [DiagramKind, ((source: string) => string[])?]> = [
  [flowchartDiagram],
  [sequenceDiagram],
  [stateDiagram],
  [classDiagram],
  [erDiagram],
  [requirementDiagram],
  [c4Diagram],
  [architectureDiagram],
  [blockDiagram],
  [ganttDiagram],
  [timelineDiagram],
  [journeyDiagram],
  [gitGraphDiagram],
  [kanbanDiagram, indentedLines],
  [mindmapDiagram, indentedLines],
  [zenumlDiagram],
  [pieDiagram],
  [xychartDiagram],
  [quadrantDiagram],
  [sankeyDiagram],
  [packetDiagram],
  [radarDiagram],
  [treemapDiagram, treemapLines],
]

/**
 * A Mermaid diagram's source as terminal rows no wider than `columns`; null when it is not a
 * diagram this draws.
 */
export function drawDiagram(source: string, columns: number): Line[] | null {
  // Two columns at the least: a character of a label may take two.
  if (!(columns >= 2) || source.length > MOST_SOURCE) return null
  const room = Math.floor(Math.min(columns, MOST_COLUMNS))
  try {
    const lines = diagramLines(source)
    const header = lines[0] ?? ''
    for (const [kind, read] of KINDS)
      if (kind.matches(header)) return kind.draw(read ? read(source) : lines, room)
    return null
  } catch {
    // A drawing is a help over the source, not a part of the reply: should some input still
    // reach a fault here, the source is shown as it was before, and the reply goes on.
    return null
  }
}
