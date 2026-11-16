# @localix-ai/flowdown

## 0.7.0

### Minor Changes

- 654bfee: `@localix-ai/flowdown/tui/diagram`, a new entry, draws Mermaid diagrams in a terminal, with no
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
- 654bfee: `@localix-ai/flowdown/tui` sets a display formula on rows (`$$`, a `math` fence, or `$$ … $$` alone
  in a paragraph):
  
  - a fraction stands over its rule;
  - a sum, a product or a limit has its limits above and below it;
  - a root's bar runs over what it takes;
  - matrices, `cases` and alignments stand in columns, in brackets as tall as their rows;
  - brackets around something tall grow to its height, with `\left` and `\right` or without.
  
  A script Unicode has small letters for stays small, as before (`x²`, `∫₀¹`). A formula with nothing
  to set on rows, one inside a sentence, and one too wide for the terminal are written on one row, as
  before. Nothing is loaded for it; `math: false` still leaves formulas as written.

### Patch Changes

- 654bfee: A selection copied from a reply drawn by `<Markdown>`, `@localix-ai/flowdown/dom` or `<flow-down>`
  pastes as the reply's own elements, with no class or style. A browser's own copy writes every
  computed style inline, so a reply copied from a dark page pasted into a light document as grey
  text on white. A word copied from inside bold text is still bold, and a line copied from a code
  block is still code. The buttons, icons and labels of code blocks, tabs and trees are left out.
  Only absolute web addresses are kept, and a task pastes as `☑` or `☐`. A selection that runs out
  of the reply is left to the browser ([styling](https://flowdown.dev/docs/styling#copying-a-reply)).
- 654bfee: A block that grows on every token costs its end, not its length, in the targets that had not
  kept up with `<Markdown>` (figures from `bench/src/growth.ts`, `results/growth-before.md` beside
  `results/growth.md`):
  
  - `@localix-ai/flowdown/static`, `/dom` and `/element` highlight each complete piece of a fence
    still being written once, and read each complete piece of a growing table once. A 900-line file
    streamed with a highlighter took 9.7 s of script; it takes 1.0 s, and four times the file costs
    four times as much. A table of 160 rows streams in under half the time.
  - `@localix-ai/flowdown/tui` reads a fence still being written without parsing its block and draws
    it in pieces of 40 lines, with or without a highlighter. It reads a growing table a piece of 16
    rows at a time and lays a row out again only when the widths of the columns change. The parts of
    the block that grows (the items of a list above the last, the paragraphs of a quote) keep their
    rows. A 900-line file draws in a seventh of the time, half with a highlighter; a table of 160
    rows in a fifth, and four times the rows cost four times as much; a list of 240 items in a third.
    The rows of what did not change are the same objects from one token to the next.
  
  What is drawn is unchanged.
- 654bfee: A long list or quote that grows costs the part being written, not the block, in every target.
  A list of more than 16 items is read a piece of 16 items at a time (`document/list.ts`). A piece that
  is complete is parsed once, and its items are drawn once and kept: on a page they are the same
  elements, and in a terminal the same rows. A piece is read as the items one parse of the whole list
  makes, so what is drawn is unchanged. A list is cut only where nothing reaches across its items; a
  loose list, or one with a lazy line, is read whole as before. A quote of more than 8 blocks, a
  callout among them, is read 8 blocks at a time in the same way (`document/quote.ts`); a quote with a
  form that takes what follows its marker, an attribution or a lazy line is read whole.
  
  In `@localix-ai/flowdown/tui`, a paragraph that grows is wrapped again from its last rows, its words
  read from where it changed: a paragraph of 19,000 characters streams in half the time it took.
  
  The repair of a reply's unfinished end reads from the item being written, too: a bullet item ends
  the paragraph above it, so no construct runs across it. Three flashes go with that:
  
  - An unclosed `**` or backtick in an earlier item no longer adds its closer at the end of the last
    one, where it opened nothing.
  - A `$$` in a paragraph above a list no longer hides the list.
  - While a fence in a list item is still being written, its closing line is indented under the item.
    A line at the left edge ended the item and opened an empty code block below the list, which was
    drawn for every frame until the fence closed.
  
  A marker left bare once a half-typed `*` is hidden (`- *`) is held back like one typed so.
- 654bfee: Two flashes of a reply still arriving are gone:
  
  - A last line that is only the marker of a block (`-`, `*`, `+`, `##`, `12.`, `>`, also inside a
    quote, `> -`) is held back until the first word of what it opens. It used to be an empty item,
    heading or quote for a frame; and a `-` under a paragraph made the whole paragraph a heading
    until the item's text came.
  - A reply that stops at a line break or a space inside `**bold`, `*italic`, `` `code `` and the
    like is completed where the text ends, before the break. The closing `**` used to go after it,
    where it closes nothing, so the frame showed `**bold` and a stray `**`.
  
  Only frames of a stream change; a finished reply is drawn as before.
- 654bfee: Raw HTML and formulas are found where the parser finds them. Whether a reply holds HTML, and so
  whether the `html` stage is loaded, was told by a scan of its lines. The scan did not know what
  holds a fence. Under a list item, a fence indented four spaces is a fence, not indented code, so
  the scan took the line that closes it for a line that opens another fence, and everything after
  it for code. Nor did it know where a block ends: a backtick run in one paragraph and another in
  an HTML block below it were blanked as one code span, with every line between them. The HTML in
  442 of the 46,334 blocks of the fuzz corpus was dropped from the page this way.
  
  Now the parser's own reading of the blocks says where code is, and a code span is looked for
  only inside the text of one block. HTML is found in a text that a page with math reads one way and
  a page without math reads another, in either reading. The escaper of literal dollars reads `$$`
  fences as a page with math does: a fence inside a formula is its text. It never touched code, and
  still does not.
  
  `markdownProseWithoutCode` (in `/remark`) takes `mathFences`, true by default. Pass `false` to
  read the text as a page without math does.
- 654bfee: Four readings of the parser are fixed. A new differential fuzz (`bun run --cwd bench
  differential`) found them: it compares the parser with micromark on 50,000 seeded documents, and
  in these four cases micromark and markdown-it agree with each other.
  
  - A blank line after indented code in a list item makes the list loose. The code's trailing blank
    lines were counted as its own, so the gap after them was not seen.
  - A link reference definition is a block of its list item, so a blank line before it makes the
    list loose, as CommonMark's example 317 counts it.
  - A list item that can interrupt a paragraph is read before a table's row of dashes. `b\n- |` is a
    paragraph and a list, as GitHub's parser reads it, not a table.
  - A header that is a pipe alone heads no table.
  
  The Rust crate reads them the same way.

## 0.6.2

### Patch Changes

- 9babcc0: A badge, an image in a link (`[![build](…)](…)`), is drawn as its image while its link is still
  being written, and as the linked image once the address closes. Its brackets and the half-written
  address used to show as text for most of its frames. An image whose address has not started,
  `![alt]` at the very end of a streaming reply, is held back like one whose address is half-written.
  Only frames of a stream change; a finished reply is drawn as before.

## 0.6.1

### Patch Changes

- 4bcefc5: A table that grows row by row is drawn by its last rows only again. In 0.6.0 a block that may
  refer to a link definition was handed a new `refs` with every token while it grew, and `<Markdown>`
  compares it: a long table with a `[` anywhere in it drew all of its rows again on each token, twice
  the time of 0.5.2. The block that stands in the same place keeps the `refs` it had, until a
  definition it asked for changes. And a piece of the reply is no longer searched for definitions
  on every token: one that is link definitions is told by how it starts.

## 0.6.0

### Minor Changes

- be1d767: A reply with link reference definitions (`[docs]: https://…`, or the `[//]: # (comment)` some
  writers use) is drawn block by block like any other. One definition used to keep the whole
  document one block, read again on every token: over a stream of 37,000 characters with one at its
  top the text was scanned 922 times over, and more the longer it was; it is scanned three times
  over now, at any length (`references.test.ts` counts it). Each block is parsed with the
  definitions of all of them, a paragraph of definitions is drawn with the block above it, and when
  a definition arrives only the blocks that refer to it are drawn again. Footnotes still keep a
  document whole.
  
  `<Markdown>`, the page, the element and the terminal view do this by themselves. A target of your
  own asks for it: `createDocument({ refs: true })`, then `parse(source, { refs: block.refs })` for
  each block; without the option a text with definitions is one block, as before. `parse` takes
  `refs`, `definitions(markdown)` of `/engine` reads the definitions of a text, and `splitBlocks`
  and `createBlockSplitter` take `{ refs: true }`.
  
  Three documents drawn block by block now match one parse of the whole, and did not: a reference
  to a definition written inside a quote or a list item of another block, an image on the last line
  of its block with its caption in the next, and a list a form governs that ends in the marker of
  another form.

### Patch Changes

- bb9ec38: A long run of `)` after a bare address no longer stalls the page. Each `)` let go of the address
  counted all of its brackets again, so 160 KB of them took six seconds to read; they are now counted
  once, and an address with no `)` at its end is not counted at all. The case is in `limits.test.ts`,
  and the bare links' ends are held to cmark-gfm's in `spec/github/bare-links.txt`, which the Rust
  crate reads too.
- 9d98cbb: The greys are neutral, light and dark. They were GitHub's, cast with blue: on a black page the dark
  theme's ground (`#0d1117`) and its borders read as navy. Text, ground, borders and the last
  diagram series are now grey with no cast; the dark ground is `#0b0b0b`. The quietest text keeps
  WCAG AA on a code block: 4.91 in the light theme, 5.34 in the dark. The status, diagram and code
  hues are unchanged.
- 6dc3a61: The prompt's first rule says the reader sees the forms drawn, not that the page renders them: the
  same text teaches a model whose reply a terminal draws (the Rust crate's `prompt()` is this one).

## 0.5.2

### Patch Changes

- The package's repository is `localixai/flowdown`: the links of its page on npm and of its README
  lead there (the former `rsaryev/flowdown` forwards to it), and the README's logo is drawn for a
  light page.

## 0.5.1

### Patch Changes

- 0d7c300: A reply can no longer stall or crash its page by its shape alone.
  
  - **Nesting is bounded.** Blocks nest a hundred deep and so do emphasis, links and images; past
    that the rest is kept as text. Twenty thousand `>` on one line, or tens of thousands of `*`
    around a word, used to throw `RangeError: Maximum call stack size exceeded`.
  - **A link destination nests parentheses 32 deep**, as cmark reads them. `[a](` repeated over
    313 KB took thirteen seconds to read and now takes twenty milliseconds.
  - **`flowdown/tui` measures a word wider than its row once.** 656 KB without a space took six
    seconds to wrap and now takes under thirty milliseconds.
- 110fbbc: The quietest text meets WCAG AA on a code block. `--fd-fg-faint` in the light theme goes from
  `#6e7781` to `#656d76`: a code block's language label had a contrast of 4.17 against the block's
  ground, under the 4.5 the guideline asks for, and now has 4.81.
- 1032274: Two things assistive technology could not reach or name.
  
  - **A code block that scrolls sideways is a Tab stop**, as a wide table already was: its `<pre>`
    becomes a group named `labels.scrollableCode`, so the arrow keys scroll it (WCAG 2.1.1). A block
    that fits stays out of the Tab order. In `<Markdown>`, `mount()` and `<flow-down>`.
  - **A task list's box has a name**: `labels.taskDone` ("Completed task") or `labels.taskOpen`
    ("Incomplete task"). It was announced as "checkbox" alone (WCAG 4.1.2).
  - **A box that scrolls is a `group`, not a `region`.** Every wide table of a reply was a landmark
    with the same name, which is what a screen reader's landmark list then filled with. The name and
    the Tab stop are as they were.
- c639833: Colours survive a bundler that lowers `light-dark()`. Vite 8 builds CSS with Lightning CSS for
  browsers older than `light-dark()`, which rewrites every token into a pair of variables it sets only
  where the page declares `color-scheme`. On a page that declared none, every colour was invalid:
  callouts, code blocks, step marks and tabs lost their fills and borders. The stylesheet now makes
  light the default for that case, as `light-dark()` does natively; a `.dark` class,
  `data-theme="dark"` or a `color-scheme` of the page still switch it.
  
  `document.querySelector('flow-down')` is typed as the element, so `markdown` and `streaming` are
  there without a cast once `@localix-ai/flowdown/element` is imported.
- 72542f8: A long reply streams faster in Chrome, Edge and Node. Each token, the parts that remember a growing
  text first check that the new text continues the last one. That check was `startsWith` on a slice,
  which V8 walks a character at a time: seventy microseconds on a 35 KB reply, three times per token.
  It is `===` on two slices now, which V8 compares as memory, in one microsecond. Bun and Safari
  (JavaScriptCore) were already fast either way, which is why the benchmark, run on Bun, never saw it.
  
  The check for a form's marker that arrived before its content stripped trailing blank space with
  `/\s+$/`, which V8 tries at every run of blank space in the reply; it is `trimEnd()` now. Together,
  streaming a 100k-character report token by token in Chromium takes a third to a fifth of the script
  time it did (7.4 s to 1.4 s on a rested machine, 9.2 s to 2.9 s on a busy one, over 22,000
  updates), and a 20k-character answer about half. `bun run browser` in `bench/` measures every
  renderer the same way; results are in `bench/results/browser.md`.

## 0.5.0

### Minor Changes

- bd2abd2: The package is now `@localix-ai/flowdown` (it was `llx-markdown`), at https://flowdown.dev. To move:
  
  - Install `@localix-ai/flowdown` and import from `@localix-ai/flowdown`, `@localix-ai/flowdown/static`,
    `@localix-ai/flowdown/styles.css` and so on: the entries and what they export are the same.
  - The root class is `.flowdown`, every other class is `.fd-…` (it was `.llx-…`), and the tokens are
    `--fd-…` (they were `--llx-…`). Rename them in the CSS that restyles a reply.
  - The custom element is `<flow-down>` (it was `<llx-markdown>`).
  - `remarkLlx` is `remarkFlowdown`, and `llxDialect` is `flowdownDialect`.
- a69b29a: The same reply outside React, from the one package. `@localix-ai/flowdown/static` gives the HTML
  `<Markdown>` draws as text, for a server or an email. `@localix-ai/flowdown/dom` mounts a reply on a page
  with no framework and keeps it up to date token by token, with working tabs, file trees and code
  buttons. `@localix-ai/flowdown/element` is a custom element, `<flow-down>`, for Vue, Svelte, Solid or
  Angular. `@localix-ai/flowdown/tui` draws a reply as the rows of a terminal, wrapped to its width, with code
  coloured by the highlighter a page takes and formulas written in Unicode (`x²`, `1/k ∑ᵢ₌₁ᵏ rᵢ`).
  Each form has a terminal's own look: steps are a numbered chain down a rail, figures stand side by
  side over what they count, a file tree has its branches, a source its address on a row of its own.
  `@localix-ai/flowdown/document` and `@localix-ai/flowdown/engine` are the blocks and the parser, for a target of
  your own. None of them imports React.
  
  `<Markdown>` draws what it drew. It now loads 31.7 KB gzipped, from 30.5: the renderer is shared
  by every target.

### Patch Changes

- ba33db4: A tidier look for a reply on a page. A step is marked by its number in a round badge, with the
  line between two steps on the badges' axis and the same gap at both ends; steps written as a
  bulleted list get a dot. A code block right under a step's title sits nearer that title. A footnote
  reference is a quiet raised number with no underline, and the notes close the reply under a rule,
  smaller than the text. A tab that holds one code block shows it edge to edge. A diagram's nodes no
  longer cast Mermaid's grey shadow, which glowed on a dark page.
  
  If you set `--fd-step-dot`, set `--fd-mark` on `.fd-steps > li` instead.

## 0.4.3

### Patch Changes

- A shorter README and package description. The page leads with one line of facts, the reasons to
  use the library and the comparison chart, and gives the download as 30.5 KB gzipped, the figure
  the size results and the chart show, where it said 30 KB. The description no longer quotes a
  speed ratio. The code is the same as in 0.4.2.

## 0.4.2

### Patch Changes

- A long reply streams about twice as fast. The blocks of a document are drawn in groups of 32, and
  while a reply streams only its last group changes: React passes over each group above as one
  element, where it compared every block of the reply on every token. A 100k-character reply that
  took 240 ms of main-thread time to stream takes 132 ms, and a thread of 30 replies 42 ms where it
  took 66; a short reply costs what it did.
  What is drawn is the same, frame for frame.
  
  Two replies that stream at once no longer slow each other down. The scan for a fence left open
  remembered one text for the whole page, so each reply made the other's start over on every token:
  two 100k-character replies side by side cost twice what they cost one after the other. Each
  `<Markdown>` now has a scan of its own.
  
  While the last row of a table is being typed, the reply is no longer split into its lines on every
  token to find the table's delimiter row; the lines above the row are walked back from its end, and
  the row of dashes is told by one pattern. A 20k-character reply of tables streams in 20 ms, from 30.
  
  An extension's inline rule may call `parse` on a text of its own. The inline parser keeps its place
  in the module, and a parse started from inside a rule used to leave the one around it reading the
  wrong text; each parse now puts back what was being read when it began.

## 0.4.1

### Patch Changes

- The parser reads code and tables faster. The body of a fenced code block is taken as one slice of
  the source instead of line by line, and a table row is cut into its cells by slices instead of
  character by character. A reply that is mostly code parses about five times faster, and what the
  parser reads is unchanged: the new tree is the old one on every text it was compared on.
  
  Each icon is one `<path>`. Its strokes are subpaths of a single outline, and its circle or rounded
  square is written out as arcs, so a callout, a code block's buttons and a diagram's toolbar put
  fewer elements on the page: a 20k-character reply draws 452 where it drew 498. The icons look the
  same. A stylesheet that addressed an icon's `<circle>`, `<rect>` or one of its strokes by position
  no longer matches; `svg` and `svg path` still do.

## 0.4.0

### Minor Changes

- A drawn diagram has a toolbar: Enlarge, Show source, Copy source and Download SVG. Enlarge opens a
  viewer, a modal dialog where the diagram pans and zooms with the pointer, the wheel, a pinch or the
  keys; its code loads only when a diagram is first enlarged. The new words are labels (`enlarge`,
  `showSource`, `showDiagram`, `copySource`, `downloadSvg`, `zoomIn`, `zoomOut`, `fit`, `actualSize`,
  `close`), and `components.diagram` still replaces all of it.
- Single-dollar math follows pandoc's rule, the one GitHub uses: the opening `$` has no space after
  it, and the closing `$` has no space before it and no digit after it. A shell line in a reply,
  `for i in $(seq 1 12); do printf "line %s" $i; done`, is no longer typeset as a formula, and `$ x $` and
  `$a$5` stay text. `$x$`, `$$…$$`, ` ```math `, `\$` and the price and variable rules are as before.
  While a reply streams, a `$` that cannot open a formula (`5$ and`, `$ x`) no longer hides the rest
  of the line. `escapeLiteralDollars` now escapes every `$` that pairs with nothing, so `remark-math`
  reads the same formulas, and `hasMathSyntax` follows the same rule.
  
  Code blocks have a download button beside the copy button: it saves the code under the fence's
  title, or as `code.<ext>` from its language (`code.txt` when there is none). New label: `download`.
  The copy button falls back to the browser's copy command where the Clipboard API is missing or
  refused (an insecure origin), so it shows everywhere, a server render included. On a touch screen
  both buttons are 44 px targets. A fence with no language has no empty language label.
  
  A URL that `urlTransform` refuses is dropped instead of left empty: a link without `href`, an image
  without `src`, rather than `href=""` and `src=""`.
- `@localix-ai/flowdown/highlight` knows the popular languages too: Python, Go, Rust, Java, Kotlin, Swift, C,
  C++, C#, PHP, Ruby, TOML and INI, and Dockerfile, with their usual fence names (`py`, `rs`, `kt`,
  `cs`, `c++`, `rb`, `golang`, `docker`). The entry grows from 21 KB to 38 KB gzipped; it is still its own entry, so a page that does not
  import it bundles none of it.

### Patch Changes

- A long code block streams about three times faster: each token now reads only the lines it added,
  and the block's header and buttons are drawn once, not on every token. A long reply also keeps less
  memory while it streams. What draws a diagram (its toolbar and the renderer) moved into the chunk
  that loads with the first diagram, so `<Markdown>` itself is 30 KB gzipped, down from 32 KB.

## 0.3.0

### Minor Changes

- `<Markdown smooth>` shows a streaming reply at an even pace instead of in the bursts it arrives in:
  whole words, a gradual change of speed, and a soft end when the reply finishes. `useSmoothText` is
  the same pacing as a hook. The newest block of a streaming reply fades in.
  
  Folded sections (`> [!DETAILS]`, `<details>`) are an outlined panel whose content is inset by the
  panel itself, so text written straight after the summary and a code block inside line up; opening
  fades the content in. Checklists draw their own box, centred on the line. `<kbd>` is a keycap.
  Source numbers are centred on their row.
  
  Fixed: a callout's title was merged into its body when the body opened with formatting
  (`> [!CAUTION] Data loss` over a line starting with inline code).

## 0.2.1

### Patch Changes

- The package names its repository, home page and issue tracker, its README shows what a reply looks like, and releases are published with npm provenance. No change to the code.

## 0.2.0

### Minor Changes

- 6e2d464: flowdown now reads Markdown with its own parser and has no dependencies: 29 KB gzipped loads with `<Markdown>` (it was 69 KB) and one package is installed (it was 124). The parser passes every example of CommonMark 0.31.2 and of GitHub's extensions; see `docs/conformance.md`.
  
  **Breaking:** `remarkPlugins` and `rehypePlugins` are gone. Write your own syntax as an extension and pass it in `extensions` (inline rules, fences, passes over the tree), or keep a unified pipeline of your own and add `remarkFlowdown` from `@localix-ai/flowdown/remark`. In `components`, `node` is the package's own node, not a hast element. `html` and `math` stages are extensions (`@localix-ai/flowdown/html`, `@localix-ai/flowdown/math`), passed the same way as before.
  
  Also new: a ` ```math ` fence is typeset as a display formula, a link from raw HTML that sets `target` always gets `rel="noopener"`, and `srcset` is held to the same URL rule as `src`.
  
  `components` now draws every element of its name: a task list's checkbox goes to the page's `input`, and footnotes to its `section`, `ol`, `li` and `sup`. A map that spreads a custom tag in beside HTML tags type-checks. `unstyled` leaves the `flowdown` class off the root, for a surface drawn entirely by `components`.

## 0.1.0

The first release.
