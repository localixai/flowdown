# @localix-ai/diagram

Mermaid diagrams as agents write them, every kind Mermaid has, drawn as **SVG for a page** and as
**boxes and lines for a terminal**, from one layout. No browser needed, no dependencies.

```sh
npm install @localix-ai/diagram
```

```ts
import { drawDiagram, toSVG } from '@localix-ai/diagram'

const source = `flowchart LR
  Model -- tokens --> Page
  Page --> Split[Split into blocks]`

element.innerHTML = toSVG(source) ?? '' // null when the text is not a diagram it reads
drawDiagram(source, 80) // terminal rows, as styled spans
```

## Why

- **Every kind.** flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline, journey,
  gitGraph, quadrant, xychart, sankey, requirement, C4, block, packet, kanban, architecture, radar,
  treemap and ZenUML, in Mermaid's own syntax, the one models already write.
- **Fast and small.** Over 20 times faster than Mermaid in Chromium on one diagram of every kind,
  56 KB gzipped against Mermaid's 1.6 MB (`bun run bench`, `bench/results/latest.json`). It needs no
  DOM, so a server can draw a diagram into its HTML.
- **Modern and quiet.** Rounded, lightly filled boxes, thin edges with small heads, sans-serif labels,
  subgraphs as soft panels, a pie as a ring. Every colour is the page's text colour at an opacity, or
  a class a page can set (`fd-diagram-bar`, `fd-diagram-c0` …), so it sits on a light page and a dark
  one alike.
- **Safe to show.** The SVG holds no script, handler, link, `<style>` or `<foreignObject>`; what a
  model wrote is text in it.
- **One layout, two screens.** The SVG is drawn from the very layout the terminal shows: a reply's
  diagram reads the same in a terminal and on a page. A picture too wide to fit is written as an
  outline of what it holds.

## Entries

- `@localix-ai/diagram`: `toSVG(source, { columns, title })` and `drawDiagram(source, columns)`.
- `@localix-ai/diagram/terminal`: `drawDiagram` alone, for a program that only draws in a terminal.

## Development

```sh
bun test            # the tests, in a random order
bun run typecheck
bun run size        # against budgets.json
bun run bench       # against Mermaid in Chromium (CHROMIUM_PATH for your own), held to budgets.json
bun run shots       # every kind, light and dark, screenshotted (CI: every engine, three systems)
```
