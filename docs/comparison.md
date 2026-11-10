# Compared with similar libraries

llx-markdown next to five other React Markdown renderers: Streamdown 2.7, react-markdown 10,
markdown-to-jsx 9.10, markstream-react 2.0 and marked-react 4. Each one is set up the way its own
README sets up a chat, without plugins, and gets the same replies.

Every figure and mark here comes from a script in [bench](../bench) that you can rerun. The few rows
taken from a library's documentation say so. The sizes, package counts and feature marks were
rerun and checked with Claude Fable 5.2 on 2026-11-10
([what was checked](../bench/README.md#checked-with-claude-fable-52)).

## While a reply streams

What the reader sees in a frame where the reply stops mid-syntax.

| | Unfinished `**bold` | Half-typed link | Open code fence | Half a table row |
| :--- | :---: | :---: | :---: | :---: |
| **llx-markdown** | ✅ bold | ✅ its text | ✅ | ✅ |
| Streamdown | ✅ bold | ✅ its text | ✅ | ✅ |
| react-markdown | ❌ `**` shows | ❌ `[`, `(` show | ✅ | ✅ |
| markdown-to-jsx | ➖ held back¹ | ✅ its text | ✅ | ✅ |
| markstream | ✅ bold | ✅ its text | ✅ | ✅ |
| marked-react | ❌ `**` shows | ❌ `[`, `(` show | ✅ | ✅ |

¹ It waits for the closing `**`, so the word shows unbolded until then.

## Markdown

All six draw tables, task lists, strikethrough and bare links.

| | Footnotes | GitHub alerts | Raw HTML, no setup |
| :--- | :---: | :---: | :---: |
| **llx-markdown** | ✅ | ✅ | ✅ |
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

| | Download, gzip | Packages installed | Styles | Licence |
| :--- | ---: | ---: | :--- | :--- |
| **llx-markdown** | 30 KB | 1 | Own CSS, light and dark | MIT |
| Streamdown | 156 KB | 118 | Tailwind classes; the page needs Tailwind | Apache-2.0 |
| react-markdown | 50 KB | 82 | None | MIT |
| markdown-to-jsx | 31 KB | 1 | None | MIT |
| markstream | 212 KB | 19 | Own CSS, or Tailwind | MIT |
| marked-react | 27 KB | 3 | None | MIT |

- **Download** is what loads with the component. Each library is bundled as a page's bundler would
  do it: a production build, minified and gzipped, without React; react-markdown with remark-gfm
  ([bench/src/size.ts](../bench/src/size.ts)).
- **Loaded on demand.** llx-markdown fetches its HTML reader and the full table of HTML5 character
  references (14 KB together) only for a reply that needs them. Streamdown loads its HTML parser up
  front. Packages a renderer loads only when a reply needs them (KaTeX, Mermaid, D2) are not counted
  for any library.
- **Highlighting.** llx-markdown with code highlighting is 50 KB.
- **Packages installed** counts dependencies all the way down, read from the lockfile, without
  React ([bench/src/install.ts](../bench/src/install.ts)).

## Code, math and diagrams

From each library's documentation, not measured.

| | Code highlighting | Math | Diagrams |
| :--- | :--- | :--- | :--- |
| **llx-markdown** | highlight.js, `llx-markdown/highlight` | KaTeX | Mermaid |
| Streamdown | Shiki plugin | KaTeX plugin | Mermaid plugin |
| react-markdown | rehype plugin | remark and rehype plugins | Your component |
| markdown-to-jsx | Your component | — | Your component |
| markstream | stream-diffs | KaTeX | Mermaid, D2 |
| marked-react | Your renderer | — | — |

## Speed while streaming

Main-thread time to stream a whole reply, one update per animation frame, in milliseconds. Lower is
better.

| | Chat, 5k | Answer, 20k | Code, 50k | Tables, 20k | Answer, 100k | Thread of 30 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **llx-markdown** | **13** | **37** | 94 | **35** | **254** | **61** |
| Streamdown | 56 | 311 | 5,342 | 3,932 | 6,038 | 145 |
| react-markdown | 206 | 2,773 | 2,866 | 3,195 | stopped at 67% | 16,607 |
| markdown-to-jsx | 18 | 128 | **58** | 165 | 2,580 | 724 |
| markstream | 41 | 336 | 946 | 856 | 5,631 | 133 |
| marked-react | 42 | 283 | 80 | 267 | 7,124 | 1,754 |

- **Where llx-markdown wins: length.** It parses again only the block still being written, so a
  100k reply and a 30-reply thread cost about as much per update as the first lines.
- **Where markdown-to-jsx and marked-react win: one long code block.** They are the fastest there;
  llx-markdown is third. markdown-to-jsx holds unfinished syntax back instead of repairing it.
- **Why react-markdown is slowest.** It parses the whole text again on every update.

How speed is measured: median of three runs on an Apple M5 in Bun 1.4.4. Pages are drawn with
happy-dom, not a real browser, so the figures compare renderers rather than predict a real page.
Every scenario, chunk pattern and percentile is in
[bench/results/latest.md](../bench/results/latest.md).

## Which one to pick

- **llx-markdown.** For an AI chat or assistant whose replies run long, threads that grow, and
  documentation. It repairs unfinished syntax, comes styled, and is one package of 30 KB with its
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

llx-markdown's answer forms (steps, tabs, stats, pros and cons, folded sections, sources) are its
own dialect, so they are not
compared here.
