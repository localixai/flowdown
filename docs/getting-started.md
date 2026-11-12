---
title: Getting started
description:
  Install flowdown, render a document, stream a reply and teach the model the dialect.
---

# Getting started

Install flowdown, render a document, stream a reply and teach the model the dialect.

> [!STEPS]
1. **Install the package**
   React 18 or 19 is the only required peer.
2. **Import the stylesheet once**
   It holds the layout of every form and the light and dark colours.
3. **Render Markdown**
   `<Markdown>` takes the text as its child.
4. **Stream a reply**
   Pass `streaming` while the text is still arriving.
5. **Teach the model**
   Add the dialect's instructions to the system prompt.

## 1. Install

> [!TABS]
#### bun

```sh
bun add @localix/flowdown
```

#### npm

```sh
npm install @localix/flowdown
```

#### pnpm

```sh
pnpm add @localix/flowdown
```

#### yarn

```sh
yarn add @localix/flowdown
```

---

The package is ESM only and ships its own types. It runs in any bundler that resolves the `exports`
field (Vite, Next.js, webpack 5, Rspack, esbuild, Bun) and in Node 20 or later.

## 2. Import the stylesheet

```ts
import '@localix/flowdown/styles.css'
```

Import it once, in your app's entry or root layout. Every rule is scoped to the `.flowdown`
element the renderer draws, so it touches nothing else on the page. Colours, fonts and radii are
tokens you can set; [Styling](styling.md) lists them.

## 3. Render

```tsx
import { Markdown } from '@localix/flowdown'

export function Doc({ source }: { source: string }) {
  return <Markdown>{source}</Markdown>
}
```

That is GitHub Markdown — tables, task lists, strikethrough, footnotes, autolinks — plus the
[dialect](syntax.md), with raw HTML parsed and sanitized.

## 4. Stream a reply

While a reply is arriving, pass `streaming`:

```tsx
<Markdown streaming={status === 'streaming'}>{text}</Markdown>
```

- Only the block the new text lands in is parsed again; everything above it is kept.
- The unfinished end is completed so it renders the way it will when finished: `**bo` is bold, an
  open code fence is code, a half-typed link is its text.
- A caret follows the text. Turn it off with `caret={false}`.

Pass the whole text each time, not the new part. When the reply is done, set `streaming` to `false`:
the final text is rendered as written, with nothing completed. [Streaming](streaming.md) explains
the details and shows how to wire it to the Vercel AI SDK.

## 5. Teach the model

A model writes the forms it was told about and no others. Add the dialect's instructions to your
system prompt:

```ts
import { answerFormatPrompt } from '@localix/flowdown/prompt'

const system = ['You are a helpful assistant.', answerFormatPrompt()].join('\n\n')
```

Math and diagrams are left out of the prompt by default, as they are off in `<Markdown>` by default:
turn on `answerFormatPrompt({ math: true, diagrams: true })` together with the page.
[Prompting](prompting.md) shows the full text and how to adapt it.

## Optional: math, diagrams and highlighting

They are off by default, so a page that does not use them does not ship them:

```tsx
import { Markdown } from '@localix/flowdown'
import { highlight } from '@localix/flowdown/highlight'
import 'katex/dist/katex.min.css'

;<Markdown
  math={() => import('@localix/flowdown/math')}
  mermaid={() => import('mermaid')}
  highlight={highlight}
>
  {text}
</Markdown>
```

Install the engines you use: `katex`, `mermaid`, `highlight.js`. See [Math](math.md),
[Diagrams](diagrams.md) and [Highlighting](highlighting.md).

> [!TIP] Next.js and other server components
> `<Markdown>` uses hooks, so its modules carry `'use client'`, and a server component can render it
> with a text child. Functions cannot cross from the server to the client, though, so a page that
> passes loaders (`math`, `mermaid`), a highlighter or `components` renders `<Markdown>` inside a
> client component of its own.
