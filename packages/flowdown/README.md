<p align="center">
  <img src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/logo.svg" width="72" height="72" alt="">
</p>

<h1 align="center">flowdown</h1>

<p align="center">
  <strong>Ultrafast, lightweight streaming Markdown for React and AI replies</strong><br>
  Its own parser · 0 dependencies · 31.7 KB gzipped · 17× faster on a long stream
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/flowdown"><img alt="npm" src="https://img.shields.io/npm/v/flowdown?color=cb3837"></a>
  <a href="https://github.com/rsaryev/flowdown/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/rsaryev/flowdown/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/rsaryev/flowdown/blob/main/packages/flowdown/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="https://github.com/rsaryev/flowdown/blob/main/docs/getting-started.md">Get started</a> ·
  <a href="https://github.com/rsaryev/flowdown/blob/main/docs/syntax.md">Syntax</a> ·
  <a href="https://github.com/rsaryev/flowdown/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/rsaryev/flowdown/blob/main/docs/targets.md">Beyond React</a> ·
  <a href="https://github.com/rsaryev/flowdown/blob/main/docs/comparison.md">Comparison</a>
</p>

<p align="center">
  <img alt="One reply streaming twice, side by side on black: on a page as callouts, steps, tabs, highlighted code, headline figures, a table, a diagram and a formula, and in a terminal as the same forms in styled text" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/readme/pair.gif" width="878">
</p>

<p align="center">
  <sub>One reply, streamed twice: by <code>&lt;Markdown&gt;</code> on a page and by <code>flowdown/tui</code> <a href="#in-a-terminal">in a terminal</a>.</sub>
</p>

GitHub Markdown, plus the forms a model can write and a reader can scan: steps, tabs, headline
figures, pros and cons, callouts, folded sections, sources, file trees, titled code, diagrams and
math. It is drawn as the text arrives, without flicker or raw syntax showing.

```sh
npm install flowdown
```

```tsx
import { Markdown } from 'flowdown'
import 'flowdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

`<Markdown>` needs React 18 or 19; the entries that draw [without React](#beyond-react) need
nothing. The package is ESM only, ships its own types and runs in any bundler that resolves the
`exports` field, and in Node 20 or later.

## Why

- **Fast.** A 100k-character reply streams in 0.13 s. The next fastest of five other renderers
  takes 2.3 s.
- **Repairs a reply mid-stream.** Unfinished `**bold`, half-typed links and open code fences never
  show their raw syntax.
- **Complete.** Its parser passes every example of CommonMark and of GitHub's extensions
  ([conformance](https://github.com/rsaryev/flowdown/blob/main/docs/conformance.md)).
- **Light.** No dependencies, and 31.7 KB gzipped loads with `<Markdown>`. The HTML reader loads
  only for a reply with raw HTML, KaTeX and Mermaid only for math and diagrams. It comes styled,
  without Tailwind.
- **Safe.** Raw HTML from a reply is parsed and sanitized, and links are held to safe protocols
  ([security](https://github.com/rsaryev/flowdown/blob/main/docs/security.md)).

<p align="center">
  <img alt="flowdown compared with Streamdown, react-markdown, markdown-to-jsx, markstream and marked-react: streaming time in milliseconds, download size, packages installed and how the cost grows with a longer reply" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/bench/results/charts/compare.png">
</p>

Where it is not the best choice: marked-react is a little smaller (27 KB), markdown-to-jsx is about
the same size (31 KB), and react-markdown has the remark and rehype plugin ecosystem. Every figure,
and which renderer suits which project, is in
[the comparison](https://github.com/rsaryev/flowdown/blob/main/docs/comparison.md).

## Use

- **Render.** `<Markdown>{source}</Markdown>` renders GitHub Markdown and the
  [dialect](https://github.com/rsaryev/flowdown/blob/main/docs/syntax.md).
- **Stream.** Pass `streaming` while a reply arrives, and the whole text each time: only the block
  the new text lands in is parsed again, and an unfinished end renders the way it will when done.
- **Teach the model.** `answerFormatPrompt()` from `flowdown/prompt` is the dialect's
  instructions for a system prompt.
- **Your own syntax.** `extensions` adds inline rules, fences and passes over the tree to the
  parser. In a unified pipeline of your own, `remarkFlowdown` from `flowdown/remark` gives the
  dialect as a remark plugin.

Math, diagrams and highlighting are off by default, so a page that does not use them does not ship
them:

| For              | Pass to `<Markdown>`                                   | Install        |
| ---------------- | ------------------------------------------------------ | -------------- |
| Math             | `math={() => import('flowdown/math')}`             | `katex`        |
| Diagrams         | `mermaid={() => import('mermaid')}`                    | `mermaid`      |
| Highlighted code | `highlight={highlight}` from `flowdown/highlight`  | `highlight.js` |

## What a reply can hold

Everything GitHub draws, and the forms below. Each is plain Markdown a model already writes, so a
reply pasted into an issue still reads: a form falls back to a quote, a list or headings.

| Form           | A model writes                       | It is drawn as                              |
| -------------- | ------------------------------------ | ------------------------------------------- |
| Callout        | `> [!WARNING] Downtime`              | a titled note in its colour                 |
| Steps          | `> [!STEPS]` over a numbered list    | a timeline                                  |
| Tabs           | `> [!TABS]` over `####` headings     | tabs, one per heading                       |
| Stats          | `> [!STATS]` over `- **3×** faster`  | headline figures                            |
| Pros and cons  | `> [!PROS]`, then `> [!CONS]`        | two columns side by side                    |
| Folded section | `> [!DETAILS] Timings`               | a title that opens                          |
| Sources        | `> [!SOURCES]` over links            | a numbered list, each link with its site    |
| File tree      | a `tree` fence                       | a tree that folds                           |
| Titled code    | a fence opened with `ts src/main.ts` | the file name in its bar, copy and download |
| Diagram        | a `mermaid` fence                    | the diagram, in the page's colours          |
| Math           | `$r = n / t$`, `$$…$$`               | KaTeX                                       |

[Syntax](https://github.com/rsaryev/flowdown/blob/main/docs/syntax.md) has every form with what it draws. Each picture is one reply drawn by
`<Markdown>`.

<p align="center">
  <img alt="Numbered steps to roll back a deploy, a highlighted shell command and a warning callout" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/readme/steps-light.png" width="760">
</p>

<p align="center">
  <img alt="A foldable file tree, a highlighted TypeScript block titled with its file and a tip" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/readme/code-light.png" width="760">
</p>

<p align="center">
  <img alt="A Mermaid flowchart in the page colours and a KaTeX formula" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/readme/diagram-light.png" width="760">
</p>

A diagram opens in a viewer that zooms and pans with the pointer, the wheel or a pinch. From the
keyboard: <kbd>+</kbd> and <kbd>-</kbd> zoom, the arrow keys pan, <kbd>0</kbd> fits the window and
<kbd>Esc</kbd> closes.

## Beyond React

`<Markdown>` is one of five targets. All read the same text with the same parser and the same
dialect, and an import path picks one:

| Import                 | Draws                                               | Runs                |
| ---------------------- | --------------------------------------------------- | ------------------- |
| `flowdown`         | React elements                                      | wherever React does |
| `flowdown/static`  | HTML text: a server, an email, a static site        | anywhere, no page   |
| `flowdown/dom`     | a page with no framework, kept up to date in place  | a browser           |
| `flowdown/element` | `<flow-down>`, for Vue, Svelte, Solid or Angular | a browser           |
| `flowdown/tui`     | the rows of a terminal                              | anywhere, no page   |

None but the first imports React, and none imports any package.

<details>
<summary><b>HTML text</b>, on a server</summary>
<br>

```ts
import { renderToHtml } from 'flowdown/static'

const html = renderToHtml(reply, { headingIds: true })
```

</details>

<details>
<summary><b>A page with no framework</b>, as the reply streams</summary>
<br>

```ts
import { mount } from 'flowdown/dom'
import 'flowdown/styles.css'

const reply = mount(document.querySelector('#reply')!)
for await (const text of stream) reply.update(text, { streaming: true })
reply.update(text)
```

</details>

<details>
<summary><b>A custom element</b>, in any framework</summary>
<br>

```ts
import { defineMarkdownElement } from 'flowdown/element'
import 'flowdown/styles.css'

defineMarkdownElement()
```

```html
<flow-down streaming></flow-down>
```

</details>

[Other targets](https://github.com/rsaryev/flowdown/blob/main/docs/targets.md) has the options of each, and how to write a target of your own.

### In a terminal

`flowdown/tui` draws the same reply as rows of styled text: steps as a chain, figures as tiles,
a file tree with its branches, code in the highlighter's colours and formulas in Unicode.

<p align="center">
  <img alt="A terminal where bun stream.ts streams one reply token by token: nested lists, tasks ticked off, callouts, numbered steps with a rail, tabs, a file tree, highlighted code and a diff, headline figures, a table, a formula and numbered sources" src="https://raw.githubusercontent.com/rsaryev/flowdown/main/docs/assets/readme/tui.gif" width="760">
</p>

```ts
import { highlight } from 'flowdown/highlight'
import { renderToAnsi } from 'flowdown/tui'

process.stdout.write(renderToAnsi(reply, { width: process.stdout.columns, highlight }) + '\n')
```

The recording is [`examples/tui`](https://github.com/rsaryev/flowdown/tree/main/examples/tui) as it runs.

## Documentation

[Getting started](https://github.com/rsaryev/flowdown/blob/main/docs/getting-started.md) ·
[Syntax](https://github.com/rsaryev/flowdown/blob/main/docs/syntax.md) ·
[Prompting](https://github.com/rsaryev/flowdown/blob/main/docs/prompting.md) ·
[Streaming](https://github.com/rsaryev/flowdown/blob/main/docs/streaming.md) ·
[Styling](https://github.com/rsaryev/flowdown/blob/main/docs/styling.md) ·
[Components](https://github.com/rsaryev/flowdown/blob/main/docs/components.md) ·
[Math](https://github.com/rsaryev/flowdown/blob/main/docs/math.md) ·
[Diagrams](https://github.com/rsaryev/flowdown/blob/main/docs/diagrams.md) ·
[Highlighting](https://github.com/rsaryev/flowdown/blob/main/docs/highlighting.md) ·
[Security](https://github.com/rsaryev/flowdown/blob/main/docs/security.md) ·
[Extensions](https://github.com/rsaryev/flowdown/blob/main/docs/remark.md) ·
[API](https://github.com/rsaryev/flowdown/blob/main/docs/api.md) ·
[Changelog](https://github.com/rsaryev/flowdown/blob/main/packages/flowdown/CHANGELOG.md)

## License

MIT
