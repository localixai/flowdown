<p align="center">
  <img src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/logo.svg" width="72" height="72" alt="">
</p>

<h1 align="center">llx-markdown</h1>

<p align="center">
  <strong>Ultrafast, lightweight streaming Markdown for React and AI replies</strong><br>
  Its own parser · 0 dependencies · 31.7 KB gzipped · 17× faster on a long stream
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/llx-markdown"><img alt="npm" src="https://img.shields.io/npm/v/llx-markdown?color=cb3837"></a>
  <a href="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/packages/llx-markdown/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/getting-started.md">Get started</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md">Syntax</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/comparison.md">Comparison</a>
</p>

<p align="center">
  <img alt="A reply streaming in: tabs with pros and cons, then headline figures, drawn as the text arrives" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/stream-light.png" width="760">
</p>

GitHub Markdown, plus the forms a model can write and a reader can scan: steps, tabs, headline
figures, pros and cons, callouts, folded sections, sources, file trees, titled code, diagrams and
math. It is drawn as the text arrives, without flicker or raw syntax showing.

```sh
npm install llx-markdown
```

```tsx
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

React 18 or 19 is the only required peer. The package is ESM only, ships its own types and runs in
any bundler that resolves the `exports` field, and in Node 20 or later.

## Why

- **Fast.** A 100k-character reply streams in 0.13 s. The next fastest of five other renderers
  takes 2.3 s.
- **Repairs a reply mid-stream.** Unfinished `**bold`, half-typed links and open code fences never
  show their raw syntax.
- **Complete.** Its parser passes every example of CommonMark and of GitHub's extensions
  ([conformance](https://github.com/rsaryev/llx-markdown/blob/main/docs/conformance.md)).
- **Light.** No dependencies, and 31.7 KB gzipped loads with `<Markdown>`. The HTML reader loads
  only for a reply with raw HTML, KaTeX and Mermaid only for math and diagrams. It comes styled,
  without Tailwind.
- **Safe.** Raw HTML from a reply is parsed and sanitized, and links are held to safe protocols
  ([security](https://github.com/rsaryev/llx-markdown/blob/main/docs/security.md)).

<p align="center">
  <img alt="llx-markdown compared with Streamdown, react-markdown, markdown-to-jsx, markstream and marked-react: streaming time in milliseconds, download size, packages installed and how the cost grows with a longer reply" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/bench/results/charts/compare.png">
</p>

Where it is not the best choice: marked-react is a little smaller (27 KB), markdown-to-jsx is about
the same size (31 KB), and react-markdown has the remark and rehype plugin ecosystem. Every figure,
and which renderer suits which project, is in
[the comparison](https://github.com/rsaryev/llx-markdown/blob/main/docs/comparison.md).

## Use

- **Render.** `<Markdown>{source}</Markdown>` renders GitHub Markdown and the
  [dialect](https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md).
- **Stream.** Pass `streaming` while a reply arrives, and the whole text each time: only the block
  the new text lands in is parsed again, and an unfinished end renders the way it will when done.
- **Teach the model.** `answerFormatPrompt()` from `llx-markdown/prompt` is the dialect's
  instructions for a system prompt.
- **Math, diagrams, highlighting.** Off by default, so a page that does not use them does not ship
  them: `math={() => import('llx-markdown/math')}`, `mermaid={() => import('mermaid')}`,
  `highlight={highlight}` from `llx-markdown/highlight`. Install `katex`, `mermaid` or
  `highlight.js` for the ones you use.
- **Without React.** The same reply as HTML text (`llx-markdown/static`), on a page with no
  framework (`/dom`), as a custom element for Vue, Svelte or Solid (`/element`) and in a terminal
  (`/tui`): [other targets](https://github.com/rsaryev/llx-markdown/blob/main/docs/targets.md).
- **Your own syntax.** `extensions` adds inline rules, fences and passes over the tree to the
  parser. In a unified pipeline of your own, `remarkLlx` from `llx-markdown/remark` gives the
  dialect as a remark plugin.

## What a reply can hold

Each picture is one reply drawn by `<Markdown>`.

<p align="center">
  <img alt="Numbered steps to roll back a deploy, a highlighted shell command and a warning callout" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/steps-light.png" width="760">
</p>

<p align="center">
  <img alt="A foldable file tree, a highlighted TypeScript block titled with its file and a tip" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/code-light.png" width="760">
</p>

<p align="center">
  <img alt="A Mermaid flowchart in the page colours and a KaTeX formula" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/diagram-light.png" width="760">
</p>

## In a terminal

`llx-markdown/tui` draws the same reply as rows of styled text: steps as a chain, figures as tiles,
a file tree with its branches, code in the highlighter's colours and formulas in Unicode. It needs
no React and no page.

<p align="center">
  <img alt="A terminal where bun stream.ts streams one reply token by token: nested lists, tasks ticked off, callouts, numbered steps with a rail, tabs, a file tree, highlighted code and a diff, headline figures, a table, a formula and numbered sources" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/tui.gif" width="760">
</p>

```ts
import { highlight } from 'llx-markdown/highlight'
import { renderToAnsi } from 'llx-markdown/tui'

process.stdout.write(renderToAnsi(reply, { width: process.stdout.columns, highlight }) + '\n')
```

The recording is
[`examples/tui`](https://github.com/rsaryev/llx-markdown/tree/main/examples/tui) as it runs.

## Documentation

[Getting started](https://github.com/rsaryev/llx-markdown/blob/main/docs/getting-started.md) ·
[Syntax](https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md) ·
[Prompting](https://github.com/rsaryev/llx-markdown/blob/main/docs/prompting.md) ·
[Streaming](https://github.com/rsaryev/llx-markdown/blob/main/docs/streaming.md) ·
[Styling](https://github.com/rsaryev/llx-markdown/blob/main/docs/styling.md) ·
[Components](https://github.com/rsaryev/llx-markdown/blob/main/docs/components.md) ·
[Math](https://github.com/rsaryev/llx-markdown/blob/main/docs/math.md) ·
[Diagrams](https://github.com/rsaryev/llx-markdown/blob/main/docs/diagrams.md) ·
[Highlighting](https://github.com/rsaryev/llx-markdown/blob/main/docs/highlighting.md) ·
[Security](https://github.com/rsaryev/llx-markdown/blob/main/docs/security.md) ·
[Extensions](https://github.com/rsaryev/llx-markdown/blob/main/docs/remark.md) ·
[API](https://github.com/rsaryev/llx-markdown/blob/main/docs/api.md) ·
[Changelog](https://github.com/rsaryev/llx-markdown/blob/main/packages/llx-markdown/CHANGELOG.md)

## License

MIT
