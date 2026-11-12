<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo.svg">
    <img src="docs/assets/logo-light.svg" width="72" height="72" alt="">
  </picture>
</p>

<h1 align="center">flowdown</h1>

<p align="center">
  <strong>Ultrafast, lightweight streaming Markdown for React and AI replies</strong><br>
  Its own parser · 0 dependencies · 32 KB gzipped · 17× faster on a long stream
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@localix-ai/flowdown"><img alt="npm" src="https://img.shields.io/npm/v/@localix-ai/flowdown?color=cb3837"></a>
  <a href="https://github.com/localixai/flowdown/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/localixai/flowdown/actions/workflows/ci.yml/badge.svg"></a>
  <a href="packages/flowdown/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="https://flowdown.dev"><b>flowdown.dev</b></a> ·
  <a href="https://flowdown.dev/docs/getting-started">Get started</a> ·
  <a href="https://flowdown.dev/docs/syntax">Syntax</a> ·
  <a href="https://flowdown.dev/docs/api">API</a> ·
  <a href="https://flowdown.dev/docs/comparison">Comparison</a>
</p>

<p align="center">
  <img alt="One reply streaming twice, side by side on black: on a page as callouts, steps, tabs, highlighted code, headline figures, a table, a diagram and a formula, and in a terminal as the same forms in styled text" src="docs/assets/readme/pair.gif" width="878">
</p>

<p align="center">
  <sub>One reply, streamed twice: by <code>&lt;Markdown&gt;</code> on a page and by <code>@localix-ai/flowdown/tui</code> in a terminal.</sub>
</p>

GitHub Markdown, plus the forms a model can write and a reader can scan: steps, tabs, headline
figures, pros and cons, callouts, folded sections, sources, file trees, titled code, diagrams and
math. It is drawn as the text arrives, without flicker or raw syntax showing.

```sh
npm install @localix-ai/flowdown
```

```tsx
import { Markdown } from '@localix-ai/flowdown'
import '@localix-ai/flowdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

`<Markdown>` needs React 18 or 19. A model writes the forms once its system prompt has the dialect:
`answerFormatPrompt()` from `@localix-ai/flowdown/prompt` is that text ([prompting](https://flowdown.dev/docs/prompting)).

## Why

- **Fast.** A 100k-character reply streams in 0.14 s. The next fastest renderer takes 2.4 s and
  Streamdown 6.5 s.
- **Linear.** A reply four times longer costs about three times more, not sixteen, and no update
  takes more than 5 ms.
- **Repairs a reply mid-stream.** Unfinished `**bold`, half-typed links and open code fences never
  show their raw syntax.
- **Complete.** Its parser passes every example of CommonMark and of GitHub's extensions.
- **Light.** One package with no dependencies, 32 KB gzipped, styled without Tailwind.
- **Safe.** Raw HTML from a reply is sanitized, and links are held to safe protocols.

<p align="center">
  <a href="https://flowdown.dev/docs/comparison"><img alt="flowdown beside five other React Markdown renderers: time to stream six kinds of reply, download size, packages installed, and the cost of a four times longer reply" src="bench/results/charts/compare.png" width="878"></a>
</p>

Every figure, its method and where another renderer suits better are in
[the comparison](https://flowdown.dev/docs/comparison).

## Beyond React

The same reply, from the same package, by import path. None but the first imports React.

| Import             | Draws                                              |
| ------------------ | -------------------------------------------------- |
| `@localix-ai/flowdown` | React elements                                     |
| `@localix-ai/flowdown/static`  | HTML text, for a server or an email                |
| `@localix-ai/flowdown/dom`     | a page with no framework, kept up to date in place |
| `@localix-ai/flowdown/element` | `<flow-down>`, for Vue, Svelte, Solid or Angular   |
| `@localix-ai/flowdown/tui`     | the rows of a terminal                             |

[Other targets](https://flowdown.dev/docs/targets) has each one's options.

## Documentation

Everything is at **[flowdown.dev](https://flowdown.dev)**:
[getting started](https://flowdown.dev/docs/getting-started) ·
[syntax](https://flowdown.dev/docs/syntax) ·
[prompting](https://flowdown.dev/docs/prompting) ·
[streaming](https://flowdown.dev/docs/streaming) ·
[styling](https://flowdown.dev/docs/styling) ·
[components](https://flowdown.dev/docs/components) ·
[math](https://flowdown.dev/docs/math) ·
[diagrams](https://flowdown.dev/docs/diagrams) ·
[highlighting](https://flowdown.dev/docs/highlighting) ·
[security](https://flowdown.dev/docs/security) ·
[extensions](https://flowdown.dev/docs/remark) ·
[API](https://flowdown.dev/docs/api) ·
[releases](packages/flowdown/CHANGELOG.md)

## Development

```sh
bun install
bun run test     # the library's tests
bun run check    # the build's exports, types and entry isolation
bun run bench    # the benchmarks, against other renderers
```

The library is in `packages/flowdown`, the documentation in `docs/`, the site in `site/` and the
benchmarks in [`bench/`](bench/README.md). How to work on it: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](packages/flowdown/LICENSE)
