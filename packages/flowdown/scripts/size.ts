/**
 * What each entry costs a page, minified and gzipped: the code it loads at once, and beside it
 * what it fetches on demand (the HTML stage, the rarer character references) and the peer
 * packages it imports (a page may already have them). The package has no dependencies, so this is
 * all of it. Fails when an entry grows past its budget, so a change that bloats the renderer is a
 * decision, not an accident. Run after `build`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { packageOf, reach } from './graph'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
}

/** Budgets for what each entry loads at once, minified and gzipped, in KB: today's size and a margin. */
const BUDGET: Record<string, number> = {
  // The parser is the package's own now (it was react-markdown's, 52 KB of dependencies). Counted
  // with the chunk the entry shares with what it loads on demand: 4.5 KB that this script used to
  // leave out, which is why the figure is past the 30 it was held to.
  // A kilobyte more since a document with link definitions is read block by block: collecting
  // them and handing them to each block (`document/references.ts`, 0.4 KB), and the cut that
  // joins a paragraph of definitions to the block above it (`core/blocks.ts`, 0.4 KB). Every
  // entry that cuts a document carries it.
  // 0.2 KB more since the healer holds a bare block marker (`-`, `##`, `1.`) back until its first
  // word, and completes `**bold` where the text stops rather than after the line break it ends in
  // (`core/heal.ts`). Every entry that heals a reply carries it.
  // 0.3 KB more since the sniffers for HTML and math and the escaper of dollars find code where
  // the parser finds it (`engine/code-ranges.ts`): a scan of lines alone missed the HTML of 442 in
  // 46,334 blocks of the fuzz corpus, and dropped it from the page. Every entry that cuts one.
  // 0.7 KB more since a copy of a selection takes the reply's elements and none of the page's
  // styles (`browser/clipboard.ts`): a browser's own copy pasted a dark page's reply as grey on
  // white. Every entry that draws on a page carries it.
  // 1.2 KB more since a long list is read a piece of items at a time and its items kept as they
  // were drawn (`document/list.ts`, `render/tree.ts`): a token of a 240-item list reads its last
  // piece, not the list. Every entry that cuts a document carries it. 0.6 KB more for a long
  // quote, a callout among them, read in pieces the same way (`document/quote.ts`).
  // 0.1 KB more since a `---` between two tabs parts them rather than ending the tabs
  // (`core/blocks.ts`) and a formula may start with a number, `$2 + 2 = 4$` (`core/dollars.ts`).
  // 0.2 KB more since a fence's code is code to the cut (`core/blocks.ts`): a render prop's `=>`
  // or an `<li>` in a snippet read as a tag left open and made the rest of a reply one block, an
  // update cost the whole reply, and 80,000 characters after one such fence streamed in seconds
  // where they took a fraction of one. With it, an item that opens empty holds one blank line,
  // and the healer holds back a row of dashes, a `[^1` and a task's box until they mean something
  // (`core/heal.ts`). Every entry that cuts and heals a reply carries it.
  // 0.2 KB more since a fence still being written is coloured a line at a time by a highlighter
  // that reads lines (`createLineColourer`, `document/fence.ts`): a token costs its line, not its
  // piece, and a comment opened in one piece is still one in the next. Every entry that draws a
  // growing fence carries it.
  '.': 37.6,
  // The renderer with no framework under it: as HTML text, on a page, as an element of the page's.
  // The code ranges of the sniffers, and on a page the copy of a selection, as for `.`.
  // And the pieces of a long list and a long quote, as for `.`.
  // And a fence's code read as code to the cut, as for `.`.
  // And a growing fence coloured a line at a time, as for `.`.
  './static': 33,
  './dom': 35.1,
  './element': 35.3,
  // The renderer for a terminal: the parser, the dialect, and rows wrapped by their columns.
  // 2.4 KB more since a block that grows costs its end: a fence still being written is read
  // without parsing its block and drawn in pieces (`document/fence.ts`, 0.7 KB of it); a table is
  // read a piece of rows at a time, and a row laid out again only when the columns change
  // (`tui/table.ts`); and the parts of a list or a quote that grows keep their rows
  // (`tui/render.ts`). A 900-line file streams in a seventh of the time it took, a 160-row table in
  // a fifth, a 240-item list in a third (`bench/results/growth.md`).
  // 3.6 KB more since a display formula is set on rows (`tui/formula.ts`): fractions over their
  // rule, limits above and below, roots, matrices and brackets as tall as what they hold.
  // And 1.6 KB for the pieces of a long list and a long quote, as for `.`; 0.6 KB more since a
  // paragraph that grows is wrapped again from its last rows (`tui/wrap.ts`).
  // 0.1 KB for a fence's code read as code to the cut, as for `.`. 0.2 KB for a growing fence
  // coloured a line at a time, as for `.`.
  './tui': 41.3,
  // Mermaid flowcharts and sequence diagrams drawn in a terminal, parsed, laid out and routed with
  // no dependency (`tui/diagram/`). An entry of its own, as `./highlight` is: a terminal that does
  // not draw diagrams does not load them. 31 KB more since it draws every kind Mermaid has that
  // cells can say: state, class, ER, requirement, C4, architecture and block diagrams on the same
  // layered layout; Gantt charts, timelines, journeys, git graphs, kanban boards, mind maps and
  // ZenUML; pie, XY, quadrant, Sankey, packet, radar and treemap charts. 4.5 KB more for git graphs
  // across and up, activations on lifelines, notes beside their states, C4 placement hints, and
  // architecture services on a grid by the sides their edges name.
  './tui/diagram': 51,
  // A growing text as blocks with the dialect to parse them by (2.6 KB of the figure, and a page
  // that imports only `createDocument` does not ship it), and the parser alone. 0.2 KB more for
  // what the healer holds back and where it completes, 0.3 KB for the code ranges (see `.`), and
  // the parser's four readings the differential fuzz found (`engine/blocks.ts`). 0.1 KB more for
  // tabs parted by a `---` and a formula that starts with a number, as for `.`. 0.2 KB more for a
  // fence's code read as code to the cut and what the healer holds back, as for `.`.
  './document': 22.6,
  './engine': 13,
  // The plugin and the helpers; `extractHeadings` reads Markdown, so the parser is here too.
  // 0.1 KB more for a fence's code read as code to the cut, as for `.`.
  './remark': 20.7,
  // Past 4.5 KB by twenty bytes: the check that a text continues the last one (`continues.ts`);
  // then 0.4 KB for the cut of a document with link definitions.
  // 0.1 KB more since the repair of an unfinished end reads from the item being written, and holds
  // a marker left bare once a half-typed `*` is hidden (`core/heal.ts`). Then a few bytes for a
  // formula that starts with a number, which the repair reads as the renderer does.
  // 0.2 KB more for a fence's code read as code to the cut, an item that opens empty, and the row
  // of dashes, `[^1` and task box the repair holds back (see `.`).
  './stream': 5.4,
  './prompt': 2,
  // The HTML reader and sanitizer, and every HTML5 character reference (11.7 KB of it).
  './html': 16.5,
  './math': 1.5,
  // The highlighter itself, `@localix-ai/highlight`, built in: 26 languages read a line at a
  // time. It was a 1.1 KB setup of highlight.js, an optional peer that added 37.6 KB on demand
  // (`flowdown + highlight` in `bench`); there is nothing to install now, and less to load.
  // 0.4 KB more for a Markdown fence read as its language and JSX text read as text.
  './highlight': 12.3,
  // Past 5 KB since a drawn diagram has a toolbar and an enlarged viewer (`diagram.css`).
  './styles.css': 5.5,
}

/** The entry's bundle, and the chunks it imports on demand (split out, as a page's bundler does). */
async function minified(target: string) {
  const result = await Bun.build({
    entrypoints: [join(root, target)],
    minify: true,
    splitting: true,
    packages: 'external',
    target: 'browser',
    throw: false,
  })
  if (!result.success) throw new AggregateError(result.logs, `could not bundle ${target}`)
  // A stylesheet is an asset, not an entry point: it is the one output there is.
  const entry = result.outputs.find((output) => output.kind === 'entry-point') ?? result.outputs[0]
  if (!entry) throw new Error(`no entry in the bundle of ${target}`)
  const name = (path: string) => `./${path.split('/').pop()!}`
  const texts = new Map<string, string>()
  for (const output of result.outputs) texts.set(name(output.path), await output.text())
  // What loads at once is the entry and every chunk it imports statically, through any number of
  // chunks: code two entries share is split into a chunk of its own, and it is still loaded with
  // the page. Only what is behind an `import()` waits.
  const atOnce = new Set<string>()
  const follow = (chunk: string) => {
    if (atOnce.has(chunk)) return
    atOnce.add(chunk)
    for (const hit of (texts.get(chunk) ?? '').matchAll(/(?:\bfrom|\bimport)\s*"(\.\/[^"]+)"/g))
      if (texts.has(hit[1]!)) follow(hit[1]!)
  }
  follow(name(entry.path))
  const text = (chunks: string[]) => chunks.map((chunk) => texts.get(chunk)!).join('\n')
  return {
    atOnce: text([...atOnce]),
    onDemand: text([...texts.keys()].filter((chunk) => !atOnce.has(chunk))),
  }
}
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
let over = false
for (const [path, target] of Object.entries(manifest.exports)) {
  const budget = BUDGET[path]
  if (budget === undefined) continue
  const { atOnce, onDemand } = await minified(target)
  const size = gzipSync(atOnce).length
  const lazy = onDemand ? gzipSync(onDemand).length : 0
  const imports = target.endsWith('.css')
    ? []
    : [...new Set([...reach(join(root, target)).packages].map(packageOf))].toSorted()
  const fits = size <= budget * 1024
  over ||= !fits
  console.log(
    `${fits ? '✓' : '✗'} ${path.padEnd(13)} ${kb(size).padStart(8)} / ${String(budget).padEnd(4)} KB  ${(lazy ? `+${kb(lazy)} on demand` : '').padEnd(20)} ${imports.join(', ')}`,
  )
}
if (over) process.exit(1)
