# Compared with similar libraries

flowdown next to five other React Markdown renderers: Streamdown 2.7, react-markdown 10,
markdown-to-jsx 9.10, markstream-react 2.0 and marked-react 4. Each one is set up the way its own
README sets up a chat, without plugins, and gets the same replies.

Every figure and mark here comes from a script in [bench](../bench) that you can rerun. The few rows
taken from a library's documentation say so. The sizes, package counts and feature marks were
rerun and checked with Claude Fable 5.2 on 2026-11-10
([what was checked](../bench/README.md#checked-with-claude-fable-52)).

## While a reply streams

What the reader sees in a frame where the reply stops mid-syntax.

| Library | Unfinished `**bold` | Half-typed link | Open code fence | Half a table row |
| :--- | :---: | :---: | :---: | :---: |
| **flowdown** | ✅ bold | ✅ its text | ✅ | ✅ |
| Streamdown | ✅ bold | ✅ its text | ✅ | ✅ |
| react-markdown | ❌ `**` shows | ❌ `[`, `(` show | ✅ | ✅ |
| markdown-to-jsx | ➖ held back¹ | ✅ its text | ✅ | ✅ |
| markstream | ✅ bold | ✅ its text | ✅ | ✅ |
| marked-react | ❌ `**` shows | ❌ `[`, `(` show | ✅ | ✅ |

¹ It waits for the closing `**`, so the word shows unbolded until then.

## Markdown

All six draw tables, task lists, strikethrough and bare links.

| Library | Footnotes | GitHub alerts | Raw HTML, no setup |
| :--- | :---: | :---: | :---: |
| **flowdown** | ✅ | ✅ | ✅ |
| Streamdown | ✅ | ❌ | ✅ |
| react-markdown | ✅ | ❌ | ❌ needs rehype-raw |
| markdown-to-jsx | ✅ | ✅ | ✅ |
| markstream | ✅ | ❌ | ✅ |
| marked-react | ❌ | ❌ | ❌ |

All six drop `onerror` handlers and `<script>`, render on the server with `renderToString`, and
leave no `javascript:` link that runs. marked-react keeps the link, but React 19 swaps its address
for one that only throws.

How these are checked: the same inputs go through every renderer, and each mark is a check on the
DOM it drew ([bench/src/features.tsx](../bench/src/features.tsx)). The markup behind every mark is
in [bench/results/features.json](../bench/results/features.json).

## In your project

| Library | Download, gzip | Packages installed | Styles | Licence |
| :--- | ---: | ---: | :--- | :--- |
| **flowdown** | 32.1 KB | 1 | Own CSS, light and dark | MIT |
| Streamdown | 155.5 KB | 118 | Tailwind classes; the page needs Tailwind | Apache-2.0 |
| react-markdown | 50.0 KB | 82 | None | MIT |
| markdown-to-jsx | 31.0 KB | 1 | None | MIT |
| markstream | 211.5 KB | 19 | Own CSS, or Tailwind | MIT |
| marked-react | 26.9 KB | 3 | None | MIT |

- **Download** is what loads with the component. Each library is bundled as a page's bundler would
  do it: a production build, minified and gzipped, without React; react-markdown with remark-gfm
  ([bench/src/size.ts](../bench/src/size.ts)).
- **Loaded on demand.** flowdown fetches its HTML reader and the full table of HTML5 character
  references (14 KB together) only for a reply that needs them. Streamdown loads its HTML parser up
  front. Packages a renderer loads only when a reply needs them (KaTeX, Mermaid, D2) are not counted
  for any library.
- **Highlighting.** flowdown with code highlighting for 23 languages is 68 KB.
- **Packages installed** counts dependencies all the way down, read from the lockfile, without
  React ([bench/src/install.ts](../bench/src/install.ts)).

## Code, math and diagrams

From each library's documentation, not measured.

| Library | Code highlighting | Math | Diagrams |
| :--- | :--- | :--- | :--- |
| **flowdown** | highlight.js, `@localix-ai/flowdown/highlight` | KaTeX | Mermaid |
| Streamdown | Shiki plugin | KaTeX plugin | Mermaid plugin |
| react-markdown | rehype plugin | remark and rehype plugins | Your component |
| markdown-to-jsx | Your component | — | Your component |
| markstream | stream-diffs | KaTeX | Mermaid, D2 |
| marked-react | Your renderer | — | — |

## Speed while streaming

Main-thread time to stream a whole reply, one update per animation frame, in milliseconds. Lower is
better.

| Library | Chat, 5k | Answer, 20k | Code, 50k | Tables, 20k | Answer, 100k | Thread of 30 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **flowdown** | **12** | **29** | **49** | **26** | **138** | **41** |
| Streamdown | 51 | 291 | 5,926 | 4,248 | 6,529 | 137 |
| react-markdown | 213 | 3,002 | 3,808 | 3,473 | stopped at 65% | 16,506 |
| markdown-to-jsx | 15 | 127 | 63 | 173 | 2,393 | 591 |
| markstream | 41 | 331 | 1,076 | 908 | 5,714 | 133 |
| marked-react | 37 | 298 | 80 | 280 | 7,709 | 1,765 |

- **Where flowdown wins: everywhere here, and most on length.** It parses again only the block
  still being written, and reads only the new lines of a growing code block, so a 100k reply and a
  30-reply thread cost about as much per update as the first lines.
- **Where the others come close: short replies and one long code block.** markdown-to-jsx is within
  4 ms on a 5k chat answer, and both it and marked-react are within 2× on 50k of code.
  markdown-to-jsx holds unfinished syntax back instead of repairing it.
- **Why react-markdown is slowest.** It parses the whole text again on every update.

How speed is measured: on an Apple M5 in Bun 1.4.4, three runs of each stream and the median
kept. flowdown's row is the whole table three times over; each other row is the mean of five to
seven such runs made over four days, because one run differs from the next by a tenth with how busy
the machine is, and those renderers did not change in between. Pages are drawn with
happy-dom, not a real browser, so the figures compare renderers rather than predict a real page.
Every scenario, chunk pattern and percentile is in
[bench/results/latest.md](../bench/results/latest.md).

### In a real browser

The same replies streamed token by token in Chromium, six updates per animation frame, read from the
browser's own counters. Main-thread time in milliseconds: script, style, layout and paint together,
with script alone in brackets. Lower is better.

| Library | Chat, 5k | Answer, 20k | Tables, 20k | Code, 50k | Answer, 100k |
| :--- | ---: | ---: | ---: | ---: | ---: |
| **flowdown** | **287** (135) | **977** (411) | **700** (349) | **3,113** (647) | **7,731** (2,917) |
| Streamdown | 556 (474) | 2,611 (2,275) | 16,491 (16,157) | 23,387 (18,754) | 20,875 (19,162) |
| react-markdown | 1,060 (996) | 11,132 (10,892) | 12,962 (12,687) | 13,061 (10,359) | stopped at 37% |
| markdown-to-jsx | 327 (208) | 1,604 (1,276) | 2,482 (2,130) | 4,543 (697) | 19,813 (18,153) |
| markstream | 631 (490) | 2,538 (1,877) | 4,526 (4,017) | 10,202 (6,613) | 28,126 (24,069) |
| marked-react | 491 (382) | 1,979 (1,626) | 2,650 (2,296) | 3,864 (**527**) | 25,461 (23,789) |

- **The order holds, the gaps are smaller.** A browser lays the page out and paints it for every
  renderer alike, and that is most of what flowdown has left: on 50k of code it spends 0.6 s in
  script and 3.1 s in all.
- **One place flowdown is not first:** script time on one long code block, where marked-react
  spends less (527 ms against 647). Over the whole main thread flowdown is first in every row.

How this is measured: Chromium 156 on the same Apple M5, the median of three runs, every renderer
in turn so a slow minute falls on all of them. The run takes 45 minutes and the machine warms up
through it: flowdown alone on a rested machine streams the 100k answer in 1.4 to 2.0 s of script,
so read the rows against each other, not as what a page will take. flowdown is drawn with its
stylesheet, the others as their components leave them. Every number is in
[bench/results/browser.md](../bench/results/browser.md).

## Parser speed

The parser alone, with no React and no DOM: megabytes of Markdown read in a second, each text of
the benchmark parsed whole. Higher is better.

| Parser | Writes | Bun (JavaScriptCore) | Node (V8) |
| :--- | :--- | ---: | ---: |
| **flowdown** | a tree | **187** | **187** |
| markdown-it | HTML | 51 | 43 |
| marked | HTML | 33 | 48 |
| micromark | HTML | 4 | 4 |
| mdast-util-from-markdown | a tree | 4 | 3 |

- **What is compared.** flowdown's parser is the one `<Markdown>` runs.
  mdast-util-from-markdown is remark's, the one react-markdown and Streamdown run; micromark is the
  tokenizer under it. All read GitHub's extensions: tables, task lists, strikethrough, autolinks
  and, except marked, footnotes.
- **A tree against HTML.** marked and markdown-it write HTML and build no tree. flowdown
  writing HTML from its tree reads 131 and 139 MB in a second.
- **Where the trees differ.** mdast gives every node its position in the source; flowdown's
  tree gives positions to blocks only, which is part of the gap.
- **In a reply's terms.** A 100k-character reply is parsed whole in under 0.6 ms, so the parser is
  a small share of what streaming one costs: the rest is React and the DOM.

How it is measured: the median of three runs on an Apple M5, each parser in a process of its own,
in Bun 1.4.4 and Node 25.6.1. Every text, and what each parser read in it, is in
[bench/results/parse.md](../bench/results/parse.md).

## Which one to pick

- **flowdown.** For an AI chat or assistant whose replies run long, threads that grow, and
  documentation. It repairs unfinished syntax, comes styled, and is one package of 32 KB with its
  own parser. It does not take remark or rehype plugins.
- **markdown-to-jsx.** When a small, unstyled renderer for short replies is enough. It is one
  package and 31 KB. It slows down on very long replies and threads, and ships no styles.
- **Streamdown.** If the app is already on Tailwind and shadcn/ui. It comes from Vercel, with
  plugins for Shiki, math, Mermaid and CJK.
- **react-markdown.** For finished Markdown and the remark and rehype plugins, not for streaming.
- **markstream.** For D2 diagrams and code diffs as a reply streams. It is the largest download.
- **marked-react.** For small, finished Markdown. It has no streaming repairs, footnotes or raw
  HTML.

## Run it yourself

From `bench/`:

```sh
bun run size      # download sizes
bun run features  # what each renderer draws
bun run deps      # packages installed, licence, styles
bun run bench     # streaming speed, about half an hour
bun run charts    # redraw the README chart from the results
```

flowdown's answer forms (steps, tabs, stats, pros and cons, folded sections, sources) are its
own dialect, so they are not
compared here.
