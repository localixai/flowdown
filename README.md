<p align="center">
  <img src="docs/assets/logo.svg" width="72" height="72" alt="llx-markdown">
</p>

<h1 align="center">llx-markdown</h1>

<p align="center">
  <strong>Ultrafast, lightweight streaming Markdown for React and AI replies</strong>
</p>

<p align="center">
  <b>9× faster</b> than the next renderer on a 100k-character stream ·
  <b>linear</b> as a reply grows · <b>0 dependencies</b>, <b>30 KB</b> gzipped
</p>

<p align="center">
  <a href="https://www.anthropic.com/claude/fable"><img alt="Built with Claude Fable 5.2" src="https://img.shields.io/badge/built%20with-Claude%20Fable%205.2-d97757"></a>
  <a href="https://www.npmjs.com/package/llx-markdown"><img alt="npm" src="https://img.shields.io/npm/v/llx-markdown?color=cb3837"></a>
  <a href="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml/badge.svg"></a>
  <a href="bench/results/size.md"><img alt="30 KB gzipped" src="https://img.shields.io/badge/gzip-30%20KB-2ea44f"></a>
  <a href="packages/llx-markdown/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="docs/getting-started.md">Get started</a> ·
  <a href="docs/syntax.md">Syntax</a> ·
  <a href="docs/api.md">API</a> ·
  <a href="docs/comparison.md">Comparison</a> ·
  <a href="bench/README.md">Benchmarks</a>
</p>

GitHub Markdown plus steps, tabs, stats, pros and cons, callouts, folded sections, sources, file
trees, titled code, diagrams and math,
drawn as the text arrives, without flicker or raw syntax showing.

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

<p align="center">
  <img alt="llx-markdown compared with Streamdown, react-markdown, markdown-to-jsx, markstream and marked-react: streaming time in milliseconds, download size, packages installed and how the cost grows with a longer reply" src="bench/results/charts/compare.png">
</p>

**Where llx-markdown is strong**

- **It is the fastest to stream.** It wins all 16 streaming runs, and stays fast as a reply
  grows: a reply four times longer costs about three times more, not sixteen. A 100k-character
  reply streams in 0.25 s; the next fastest takes 2.4 s, Streamdown 6.3 s, and react-markdown does
  not finish. No update takes more than 3 ms, so a stream never drops a frame.
- **It repairs a reply mid-stream.** Unfinished `**bold`, half-typed links and open code fences
  never show their raw syntax.
- **It draws more Markdown.** GitHub alerts, footnotes and raw HTML need no setup. Of six
  renderers, it is the only one that passes every check.
- **It has no dependencies.** The parser is its own and passes every example of CommonMark and of
  GitHub's extensions ([conformance](docs/conformance.md)). One package is installed, and 30 KB
  gzipped loads with the component, against 156 KB for Streamdown; it comes styled without
  Tailwind.

**Where it is not**

- **marked-react is a little smaller**, 27 KB against 30 KB. It does not repair a streaming reply
  and draws less Markdown.
- **It does not take remark or rehype plugins.** Your own syntax is an
  [extension](docs/remark.md); react-markdown is the one with the plugin ecosystem.

**[Read the full comparison →](docs/comparison.md)** It has every check, figure and source, and
says which renderer suits which project. Every number comes from a script in [bench](bench) that you
can rerun.

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
  <img alt="A foldable file tree, a highlighted TypeScript block titled with its file and a tip" src="docs/assets/readme/code-light.png" width="760" />
</picture>

**A diff with its file name, a folded section and sources**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/sources-dark.png" />
  <img alt="A diff titled with its file, a folded section of timings and a numbered list of sources with their sites" src="docs/assets/readme/sources-light.png" width="760" />
</picture>

**Diagrams and math**, drawn with Mermaid and KaTeX in the page's colours

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/diagram-dark.png" />
  <img alt="A Mermaid flowchart in the page colours and a KaTeX formula" src="docs/assets/readme/diagram-light.png" width="760" />
</picture>

**A diagram's toolbar and viewer**: Enlarge opens a viewer that zooms and pans with the pointer, the
wheel, a pinch or the keys; the other buttons show, copy and download the source

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/viewer-dark.png" />
  <img alt="A sequence diagram enlarged in its viewer, zoomed with the wheel, dragged, fitted back and closed" src="docs/assets/readme/viewer-light.png" width="760" />
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

How to work on it, and what a change has to keep: [CONTRIBUTING.md](CONTRIBUTING.md).

## Releases

CI checks every push to `main` and every pull request. A tag `v<version>`, the version in
`packages/llx-markdown/package.json`, publishes that version to npm as `llx-markdown`
([release workflow](.github/workflows/release.yml)).
