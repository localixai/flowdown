<p align="center">
  <img src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/logo.svg" width="72" height="72" alt="">
</p>

<h1 align="center">llx-markdown</h1>

<p align="center">
  <strong>Ultrafast, lightweight streaming Markdown for React and AI replies</strong>
</p>

<p align="center">
  <b>17× faster</b> than the next renderer on a 100k-character stream ·
  <b>linear</b> as a reply grows · <b>0 dependencies</b>, <b>30 KB</b> gzipped
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/llx-markdown"><img alt="npm" src="https://img.shields.io/npm/v/llx-markdown?color=cb3837"></a>
  <a href="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/rsaryev/llx-markdown/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/bench/results/size.md"><img alt="30 KB gzipped" src="https://img.shields.io/badge/gzip-30%20KB-2ea44f"></a>
  <img alt="No dependencies" src="https://img.shields.io/badge/dependencies-0-2ea44f">
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/packages/llx-markdown/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/getting-started.md">Get started</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md">Syntax</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/rsaryev/llx-markdown/blob/main/docs/comparison.md">Comparison</a>
</p>

GitHub Markdown, plus a small dialect of forms a model can write and a reader can scan: steps, tabs,
headline figures, the case for and against, callouts, folded sections, sources, file trees, diagrams
and math. It is drawn while the text is still arriving, without flicker or raw syntax showing.

<p align="center">
  <img alt="A reply streaming in: tabs with pros and cons, then headline figures, drawn as the text arrives" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/stream-light.png" width="760">
</p>

```tsx
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

## Install

```sh
npm install llx-markdown
```

React 18 or 19 is the only required peer. The package is ESM only, ships its own types and runs in
any bundler that resolves the `exports` field, and in Node 20 or later.

## Why this one

- **It stays fast as a reply grows.** A 100k-character reply streams in 0.13 s. The next fastest
  of five other renderers takes 2.3 s.
- **It repairs a reply mid-stream.** Unfinished `**bold`, half-typed links and open code fences
  never show their raw syntax.
- **It has no dependencies.** The parser is its own and passes every example of CommonMark and of
  GitHub's extensions ([conformance](https://github.com/rsaryev/llx-markdown/blob/main/docs/conformance.md)). 30 KB gzipped loads with the
  component, and it comes styled, without Tailwind.
- **It is safe by default.** Raw HTML from a reply is parsed and sanitized, and links are held to
  safe protocols ([security](https://github.com/rsaryev/llx-markdown/blob/main/docs/security.md)).

<p align="center">
  <img alt="llx-markdown compared with Streamdown, react-markdown, markdown-to-jsx, markstream and marked-react: streaming time in milliseconds, download size, packages installed and how the cost grows with a longer reply" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/bench/results/charts/compare.png">
</p>

Where it is not the best choice: marked-react is a little smaller (27 KB against
30 KB), and react-markdown is the one with the remark and rehype plugin ecosystem. Every
figure, and which renderer suits which project: [the comparison](https://github.com/rsaryev/llx-markdown/blob/main/docs/comparison.md).

## What a reply can hold

Each picture is one reply drawn by `<Markdown>`. A model writes these forms once its system
prompt has the dialect: `answerFormatPrompt()` from `llx-markdown/prompt`.

<p align="center">
  <img alt="Numbered steps to roll back a deploy, a highlighted shell command and a warning callout" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/steps-light.png" width="760">
</p>

<p align="center">
  <img alt="A foldable file tree, a highlighted TypeScript block titled with its file and a tip" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/code-light.png" width="760">
</p>

<p align="center">
  <img alt="A diff titled with its file, a folded section of timings and a numbered list of sources with their sites" src="https://raw.githubusercontent.com/rsaryev/llx-markdown/main/docs/assets/readme/sources-light.png" width="760">
</p>

## Use

- **Render.** `<Markdown>{source}</Markdown>` renders GitHub Markdown and the
  [dialect](https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md), with raw HTML parsed and sanitized.
- **Stream.** Pass `streaming` while a reply arrives, and the whole text each time: only the block
  the new text lands in is parsed again, and an unfinished end renders the way it will when done.
- **Teach the model.** `answerFormatPrompt()` from `llx-markdown/prompt` is the dialect's
  instructions for a system prompt.
- **Math, diagrams, highlighting.** Off by default, so a page that does not use them does not ship
  them: `math={() => import('llx-markdown/math')}`, `mermaid={() => import('mermaid')}`,
  `highlight={highlight}` from `llx-markdown/highlight`. Install `katex`, `mermaid` or
  `highlight.js` for the ones you use.
- **Your own syntax.** `extensions` adds inline rules, fences and passes over the tree to the
  parser. In a unified pipeline of your own, `remarkLlx` from `llx-markdown/remark` gives the
  dialect as a remark plugin.

## Size

30 KB, minified and gzipped in a production build, loads with `<Markdown>`, without React, and the
package has no dependencies. The HTML reader (14 KB with the full table of character references) is
loaded only for a reply with raw HTML, and KaTeX and Mermaid only for math and diagrams.

## Documentation

[Getting started](https://github.com/rsaryev/llx-markdown/blob/main/docs/getting-started.md) · [Syntax](https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md) ·
[Prompting](https://github.com/rsaryev/llx-markdown/blob/main/docs/prompting.md) · [Streaming](https://github.com/rsaryev/llx-markdown/blob/main/docs/streaming.md) ·
[Styling](https://github.com/rsaryev/llx-markdown/blob/main/docs/styling.md) · [Components](https://github.com/rsaryev/llx-markdown/blob/main/docs/components.md) · [Math](https://github.com/rsaryev/llx-markdown/blob/main/docs/math.md) ·
[Diagrams](https://github.com/rsaryev/llx-markdown/blob/main/docs/diagrams.md) · [Highlighting](https://github.com/rsaryev/llx-markdown/blob/main/docs/highlighting.md) ·
[Security](https://github.com/rsaryev/llx-markdown/blob/main/docs/security.md) · [Extensions](https://github.com/rsaryev/llx-markdown/blob/main/docs/remark.md) · [API](https://github.com/rsaryev/llx-markdown/blob/main/docs/api.md) ·
[Changelog](https://github.com/rsaryev/llx-markdown/blob/main/packages/llx-markdown/CHANGELOG.md)

## License

MIT
