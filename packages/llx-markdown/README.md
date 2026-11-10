# llx-markdown

Markdown for AI replies and documentation in React. It renders GitHub Markdown, plus a small dialect
of forms a model can write and a reader can scan: steps, tabs, headline figures, the case for and
against, callouts, file trees, diagrams and math. It renders while the text is still arriving,
without flicker or raw syntax showing.

```tsx
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

## Install

For now the package is published to GitHub Packages as `@rsaryev/llx-markdown`. Install it under
the name `llx-markdown`, so imports stay the same when it moves to npm:

```sh
bun add llx-markdown@npm:@rsaryev/llx-markdown
```

GitHub Packages asks for a token even to read a package: a personal access token with
`read:packages`. Point the `@rsaryev` scope at the registry with it, in `bunfig.toml`:

```toml
[install.scopes]
rsaryev = { url = "https://npm.pkg.github.com", token = "$GITHUB_TOKEN" }
```

or in `.npmrc`, for npm, pnpm and yarn:

```ini
@rsaryev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

React 18 or 19 is the only required peer. The package is ESM only, ships its own types and runs in
any bundler that resolves the `exports` field, and in Node 20 or later.

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

29 KB, minified and gzipped in a production build, loads with `<Markdown>`, without React, and the
package has no dependencies: the parser is its own. The HTML reader (14 KB with the full table of
character references) is loaded only for a reply with raw HTML, and KaTeX and Mermaid only for math
and diagrams. How it compares with Streamdown, react-markdown, markdown-to-jsx, markstream and
marked-react on size, speed and what each draws, every figure from a script you can rerun:
[the comparison](https://github.com/rsaryev/llx-markdown/blob/main/docs/comparison.md).

## Documentation

[Getting started](https://github.com/rsaryev/llx-markdown/blob/main/docs/getting-started.md) · [Syntax](https://github.com/rsaryev/llx-markdown/blob/main/docs/syntax.md) ·
[Prompting](https://github.com/rsaryev/llx-markdown/blob/main/docs/prompting.md) · [Streaming](https://github.com/rsaryev/llx-markdown/blob/main/docs/streaming.md) · [Styling](https://github.com/rsaryev/llx-markdown/blob/main/docs/styling.md) ·
[Components](https://github.com/rsaryev/llx-markdown/blob/main/docs/components.md) · [Math](https://github.com/rsaryev/llx-markdown/blob/main/docs/math.md) · [Diagrams](https://github.com/rsaryev/llx-markdown/blob/main/docs/diagrams.md) ·
[Highlighting](https://github.com/rsaryev/llx-markdown/blob/main/docs/highlighting.md) · [Security](https://github.com/rsaryev/llx-markdown/blob/main/docs/security.md) · [Remark](https://github.com/rsaryev/llx-markdown/blob/main/docs/remark.md) ·
[API](https://github.com/rsaryev/llx-markdown/blob/main/docs/api.md)

## License

MIT
