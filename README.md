# llx-markdown

Markdown for AI replies and documentation in React: GitHub Markdown plus steps, tabs, stats, pros
and cons, callouts, file trees, diagrams and math, rendered while it streams, without flicker or
raw syntax showing.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/stream-dark.png" />
  <img alt="A reply streaming in: tabs with pros and cons, then headline figures, drawn as the text arrives" src="docs/assets/readme/stream-light.png" width="760" />
</picture>

```tsx
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

Install, usage and the rest: [packages/llx-markdown](packages/llx-markdown/README.md) and
[the documentation](docs/getting-started.md).

## Compared with similar libraries

Six React renderers, each set up the way its own README sets up a chat, without plugins: the same
replies through every one. Every figure below comes from a script in [bench](bench) and can be
rerun; where a figure comes from a library's documentation instead, it says so.

### What it draws

The same inputs through each renderer, each mark a check on the DOM it drew
([bench/src/features.tsx](bench/src/features.tsx)); the markup behind every mark is in
[bench/results/features.json](bench/results/features.json).

| | llx-markdown 0.1 | Streamdown 2.7 | react-markdown 10 | markdown-to-jsx 9 | markstream 2.0 | marked-react 4 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Tables, task lists, strikethrough, bare links | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Footnotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| GitHub alerts (`> [!WARNING]`) | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Raw HTML (`<kbd>`), out of the box | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Streaming:** unfinished `**bold` shows as bold | ✓ | ✓ | ✗ | ✗¹ | ✓ | ✗ |
| **Streaming:** half-typed link shows its text | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Streaming:** unclosed code fence, half a table row | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Safety:** drops `onerror`, `javascript:`, `<script>` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓² |
| Renders on the server (`renderToString`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

¹ It holds unfinished syntax back until it closes, so the word shows unbolded.
² marked-react keeps a `javascript:` link; React 19 replaces the address with one that only throws.

Answer forms (steps, tabs, stats, pros and cons) are llx-markdown's own dialect, so they are not in
the table. Code highlighting, math and diagrams, from each library's documentation: Streamdown has
plugins for Shiki, KaTeX, Mermaid and CJK; markstream renders code, KaTeX, Mermaid and D2 when
those packages are installed; react-markdown takes remark and rehype plugins (rehype-highlight,
rehype-katex); markdown-to-jsx and marked-react leave them to your own components;
llx-markdown has `llx-markdown/highlight` and draws KaTeX and Mermaid when they are installed.

### Size

What a page downloads to render Markdown, in a production build, minified and gzipped, without
React ([bench/src/size.ts](bench/src/size.ts), [results](bench/results/size.md)). Optional
packages a renderer imports only for a reply that needs them (KaTeX, Mermaid, D2) are counted for no
one.

| | Loads with the component | Loaded when a reply needs it |
| --- | ---: | --- |
| marked-react 4 | 27 KB | — |
| markdown-to-jsx 9 | 31 KB | — |
| react-markdown 10 + remark-gfm | 50 KB | — |
| **llx-markdown 0.1** | **82 KB** | 48 KB, the HTML parser, for a reply with raw HTML |
| llx-markdown with code highlighting | 103 KB | 48 KB |
| Streamdown 2.7, without its plugins | 156 KB | — |
| markstream 2.0 | 212 KB | 8 KB |

llx-markdown, react-markdown and Streamdown share one base, unified, remark and micromark;
llx-markdown and Streamdown add marked to split a stream into blocks. Streamdown loads the HTML
parser (rehype-raw and parse5, 48 KB) with the component; llx-markdown loads it only for a reply
that has raw HTML. CI holds llx-markdown to 88 KB for what loads with `<Markdown>`.

### Speed while streaming

Main-thread time to stream a whole reply, one update per animation frame, in milliseconds; lower
is better. Median of three runs on an Apple M5 in Bun 1.4.4 with happy-dom, not a browser, so the
figures compare renderers rather than predict a page ([bench/README.md](bench/README.md), every
scenario and pattern in [bench/results/latest.md](bench/results/latest.md)).

| Reply | llx-markdown | Streamdown | react-markdown | markdown-to-jsx | markstream | marked-react |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chat answer, 5k characters | 45 | 49 | 225 | **11** | 38 | 34 |
| Long answer, 20k | **123** | 282 | 2887 | 129 | 321 | 306 |
| Code, 50k | 593 | 5494 | 5676 | **62** | 1638 | 82 |
| Tables, 20k | 824 | 4887 | 3843 | **187** | 1031 | 329 |
| Very long answer, 100k | **880** | 7283 | stopped at 65% | 2577 | 6032 | 9649 |
| A thread of 30 replies | 134 | 150 | 17196 | 605 | **131** | 1818 |

Where llx-markdown wins is length: it reparses only the block still being written, so the 100k
reply and the 30-reply thread cost about as much per update as the first lines. On a single reply
markdown-to-jsx is the fastest, code included, and marked-react next on code; both do less while
streaming: markdown-to-jsx holds unfinished syntax back and marked-react repairs none of it (the
table above).

## What a reply can hold

Each picture is one reply drawn by `<Markdown>`, from the Markdown in [demo/scenes](demo/scenes): the
forms a model writes once its system prompt has the dialect (`answerFormatPrompt()` from
`llx-markdown/prompt`).

**Steps, a code block and a callout**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/steps-dark.png" />
  <img alt="Numbered steps to roll back a deploy, a highlighted shell command and a warning callout" src="docs/assets/readme/steps-light.png" width="760" />
</picture>

**A file tree and highlighted code**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/code-dark.png" />
  <img alt="A foldable file tree, a highlighted TypeScript block and a tip" src="docs/assets/readme/code-light.png" width="760" />
</picture>

**Diagrams and math**, drawn with Mermaid and KaTeX in the page's colours

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/diagram-dark.png" />
  <img alt="A Mermaid flowchart in the page colours and a KaTeX formula" src="docs/assets/readme/diagram-light.png" width="760" />
</picture>

## Repository

| Path                    | What it holds                                        |
| ----------------------- | ---------------------------------------------------- |
| `packages/llx-markdown` | the library                                          |
| `docs/`                 | the documentation, as Markdown; `nav.json` orders it |
| `demo/`                 | the scenes above and the script that captures them   |
| `bench/`                | rendering benchmarks against other renderers         |

```sh
bun install
bun run test        # the library's tests; CI skips the heavy sweeps (LLX_SKIP_HEAVY=1)
bun run check       # build output: exports, types, entry isolation
bun run shots       # the pictures above, from demo/scenes
bun run size        # bundle size, against its budgets
bun run bench       # the benchmarks
```

## Releases

CI checks every push to `main` and every pull request. A tag `v<version>`, the version in
`packages/llx-markdown/package.json`, publishes that version to GitHub Packages as
`@rsaryev/llx-markdown` ([release workflow](.github/workflows/release.yml)).
