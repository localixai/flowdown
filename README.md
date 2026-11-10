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

## Size

What a page downloads to render Markdown, minified and gzipped, without React (the page has it):

| | Loads with the component | Loaded only when a reply needs it |
| --- | --- | --- |
| **llx-markdown** | **89 KB** | 48 KB, the HTML parser, for a reply with raw HTML |
| llx-markdown with code highlighting | 110 KB | 48 KB |
| `llx-markdown/stream` (healing and splitting, no React) | 17 KB | — |
| react-markdown with remark-gfm | 58 KB | — |
| Streamdown 2.7 | 163 KB | — |

KaTeX and Mermaid are loaded by the page on demand, only when a reply has math or a diagram, and
are counted for no one. CI holds the package to a budget: 95 KB for what loads with `<Markdown>`, and
one for each entry's own code. How it is measured: [bench/src/size.ts](bench/src/size.ts); the latest
run: [bench/results/size.md](bench/results/size.md).

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
