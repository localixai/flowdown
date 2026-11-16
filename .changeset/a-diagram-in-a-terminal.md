---
'@localix-ai/flowdown': minor
---

`@localix-ai/flowdown/tui/diagram`, a new entry, draws Mermaid diagrams in a terminal, with no
Mermaid and no dependency. Pass its `drawDiagram` to the terminal target as `diagrams`, as a
highlighter is passed: `renderToAnsi(reply, { diagrams: drawDiagram })`.

It draws every kind Mermaid has that cells can say honestly:

- graphs as boxes, lines and arrows: flowcharts, state, class, entity-relationship, requirement,
  C4, architecture and block diagrams, mind maps and kanban boards;
- a flowchart is a layered layout in any of its four directions, its nodes in the shapes the
  diagram gives them, its edges routed between them with junctions joined, arrowheads, dotted and
  thick lines, its edge labels kept clear of the boxes and its subgraphs in titled frames;
- a sequence diagram (also written as ZenUML) puts its participants over their lifelines, its
  messages as arrows with their labels, `autonumber`, notes, and `loop`, `alt`, `opt`, `par`,
  `critical` and `break` blocks as frames;
- time as bars and rails: Gantt charts, timelines, user journeys and git graphs;
- charts as bars, plots and grids: pie, XY, quadrant, radar, Sankey, packet and treemap.

A diagram too wide for the terminal is written as an outline of what it holds, wrapped to the
width. A picture is never cut.

While its fence is still being written, a diagram shows its source, as on a page. A diagram that
does not read, and every diagram when no drawer is given, shows its source as before.
