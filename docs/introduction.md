---
title: Introduction
description:
  Ultrafast, lightweight streaming Markdown for React and AI replies — GitHub Markdown plus steps, tabs, stats, pros
  and cons, callouts, folded sections, sources, file trees, diagrams and math, rendered while it
  streams.
---

# Introduction

Ultrafast, lightweight streaming Markdown for React and AI replies: its own parser, no
dependencies, 31.7 KB gzipped, and [the fastest to stream](comparison.md) of six React renderers. It renders GitHub Markdown, plus a small dialect
of forms a model can write and a reader can scan: steps, tabs, headline figures, the case for and
against, callouts, folded sections, sources, file trees, diagrams and math. It renders while the text is still arriving,
without flicker or raw syntax showing.

```tsx
import { Markdown } from '@localix/flowdown'
import '@localix/flowdown/styles.css'

export function Reply({ text, done }: { text: string; done: boolean }) {
  return <Markdown streaming={!done}>{text}</Markdown>
}
```

## What it looks like

A model asked "Postgres or SQLite for a side project?" can answer like this:

```markdown
> [!TABS]
#### SQLite
> [!PROS]
- one file, nothing to run

> [!CONS]
- one writer at a time

#### PostgreSQL
> [!PROS]
- concurrent writes

> [!CONS]
- a server to run

---

Start with SQLite; move when writes from several processes become the norm.
```

and the reader sees:

> [!TABS]
#### SQLite
> [!PROS]
- one file, nothing to run

> [!CONS]
- one writer at a time

#### PostgreSQL
> [!PROS]
- concurrent writes

> [!CONS]
- a server to run

---

Start with SQLite; move when writes from several processes become the norm.

Where the dialect is not rendered — GitHub, a terminal, an email — the same text still reads as a
quote line and a list. Nothing is lost by writing it.

## Why another Markdown renderer

> [!STATS]
- **1** block re-parsed per token while streaming
- **5** forms beyond GitHub Markdown
- **0** dependencies: the parser is its own

What sets it apart:

- **Forms a model actually uses.** Each form is opt-in by a marker (`> [!STEPS]`), never guessed
  from the shape of a list, and comes with [a prompt](prompting.md) that teaches the model to write
  it. The prompt's examples are the renderer's test cases, so the model is never taught a form that
  would print as raw text.
- **Built for streaming.** The text is cut into top-level blocks and each is remembered: a new token
  re-parses only the last block. The unfinished end is completed (`**bo` is bold, an open fence is
  code, a half-typed `> [!STE` is hidden) so nothing flashes. Every frame is tested to render
  exactly what one parse of that frame would. See [Streaming](streaming.md).
- **Heavy parts load when needed.** The HTML parser is fetched the first time a document holds HTML;
  KaTeX, Mermaid and highlight.js are optional and yours to load. See [Math](math.md),
  [Diagrams](diagrams.md) and [Highlighting](highlighting.md).
- **Plain CSS.** One stylesheet on `--fd-*` custom properties, light and dark built in, no Tailwind
  required. See [Styling](styling.md).
- **Safe by default.** Raw HTML is sanitized, unsafe URLs are dropped and diagrams run in Mermaid's
  strict mode. See [Security](security.md).
- **Not only React.** The same package draws a reply as HTML text on a server, on a page with no
  framework, as a custom element and in a terminal. See [Other targets](targets.md). The dialect is
  also a remark plugin for a pipeline of your own: [Extensions and remark](remark.md).

## Next

- [Getting started](getting-started.md) — install, render, stream.
- [Syntax](syntax.md) — every form, with its source.
- [flowdown.dev](https://flowdown.dev) — a reply streaming live, in a page.
