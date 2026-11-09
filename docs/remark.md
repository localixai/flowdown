---
title: Remark and rehype
description:
  The dialect as unified plugins, without React — render HTML on a server, use react-markdown with
  your own components, or cut a document into blocks yourself.
---

# Remark and rehype

`llx-markdown/remark` is the dialect without React: the plugins `<Markdown>` runs, as ordinary
[unified](https://unifiedjs.com) plugins. The forms become HTML elements with `llx-` classes and
data attributes, which `llx-markdown/styles.css` draws the same way it draws `<Markdown>`.

Use it for:

- HTML rendered on a server, in an email or in a static site build;
- react-markdown, or another renderer, with components of your own;
- a search index, an outline or a table of contents built from the same parse.

## HTML on a server

```sh
bun add llx-markdown unified remark-parse remark-rehype rehype-stringify
```

```ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { remarkLlx } from 'llx-markdown/remark'

const processor = unified().use(remarkParse).use(remarkLlx).use(remarkRehype).use(rehypeStringify)

const html = String(await processor.process(markdown))
```

`remarkLlx` is GitHub Flavored Markdown (`remark-gfm`) plus the dialect (`remarkAnswerBlocks`).
Wrap the output in an element with the class `llx-markdown` and import the stylesheet:

```html
<link rel="stylesheet" href="/llx-markdown/styles.css" />
<div class="llx-markdown"><!-- html --></div>
```

What the static output does not have: tabs that switch (the variants are all shown, one after
another, until a script or your own component turns `answer-tabs` into tabs), the copy button,
drawn diagrams, and file trees that open and close. ` ```mermaid ` and ` ```tree ` stay code blocks
with `language-mermaid` and `language-tree` classes.

## Raw HTML and math

`remarkPluginsFor` and `rehypePluginsFor` build the same plugin lists `<Markdown>` uses, with the
optional stages:

```ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { rehypePluginsFor, remarkPluginsFor } from 'llx-markdown/remark'
import { html } from 'llx-markdown/html'
import { math } from 'llx-markdown/math'

const processor = unified()
  .use(remarkParse)
  .use(remarkPluginsFor({ math }))
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypePluginsFor({ html, math }))
  .use(rehypeStringify)
```

With `html`, raw HTML is parsed (`rehype-raw`) and then cleaned with `sanitizeSchema`; it needs
`allowDangerousHtml` on `remark-rehype` so the HTML reaches the parser. Without `html`, leave that
option off and `remark-rehype` drops raw HTML. Math is typeset last, after the sanitizer, so KaTeX's
markup is kept. The second argument of `rehypePluginsFor` is a list of plugins to run between the
sanitizer and the math; put a pass that must see the cleaned tree there.

With math, escape literal dollars first, as `<Markdown>` does: `processor.process(escapeLiteralDollars(markdown))`.
See [Math](math.md#dollar-signs-that-are-not-math) for the rules.

## react-markdown with your own components

```tsx
import ReactMarkdown from 'react-markdown'
import { remarkLlx } from 'llx-markdown/remark'

;<ReactMarkdown remarkPlugins={remarkLlx} components={components}>
  {text}
</ReactMarkdown>
```

This gives you the dialect without `<Markdown>`'s streaming, block memoization and built-in
components. Map `answer-tabs` and `answer-tab` in `components` to draw tabs; each `answer-tab` has
its label in `data-label`.

## What the dialect emits

| Form          | HTML                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Callout       | `<blockquote data-callout="warning" data-callout-title="…">`                                           |
| Steps         | `<ol class="llx-steps">`, each `<li>` holding `div.llx-step-head` (`span.llx-step-title`, `span.llx-step-meta`) and `div.llx-step-body` |
| Stats         | `<ul class="llx-stats">`, each `<li>` holding `div.llx-stat` (`span.llx-stat-value`, `span.llx-stat-label`) |
| Pros and cons | `<div class="llx-verdicts">` holding `aside.llx-verdict[data-verdict=pros]` and `[data-verdict=cons]`, each with `ul.llx-verdict-list` |
| Tabs          | `<answer-tabs>` holding `<answer-tab data-label="…">`                                                  |
| A titled form | `<div class="llx-form">` with `p.llx-steps-title` (or `llx-tabs-title`, `llx-stats-title`, …) before the form |
| Quote source  | `<footer class="llx-quote-source">` inside the quote                                                   |
| Figure        | `<figure class="llx-figure">` with the `<img>` and a `<figcaption>`                                    |
| Section number | `<span class="llx-section-number">1.2</span>` at the start of a heading                               |

For example, this Markdown:

```markdown
> [!WARNING] Back up first
> This deletes the table.

> [!STATS]
- **42 ms** p95 update
```

becomes:

```html
<blockquote data-callout="warning" data-callout-title="Back up first">
<p>This deletes the table.</p>
</blockquote>
<ul class="llx-stats">
<li>
<div class="llx-stat"><span class="llx-stat-value">42 ms</span><span class="llx-stat-label">p95 update</span></div>
</li>
</ul>
```

A callout stays a `blockquote` in the HTML; `<Markdown>`'s `Callout` component draws it as an
`aside` with an icon. The stylesheet draws both.

## The sanitize schema

`sanitizeSchema` is GitHub's schema from `rehype-sanitize`, extended with the elements, classes and
attributes above. Use it in a pipeline of your own that sanitizes, so the dialect's markup is not
stripped:

```ts
import rehypeSanitize from 'rehype-sanitize'
import { sanitizeSchema } from 'llx-markdown/remark'

processor.use(rehypeSanitize, sanitizeSchema)
```

[Security](security.md) lists what it allows.

## Heading ids

| Export                         | What it does                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `extractHeadings(markdown)`    | Every heading as `{ depth, text, id }`: an outline or table of contents.              |
| `remarkHeadingIds`             | A remark plugin that gives each heading the same id.                                  |
| `headingIdsByOffset(markdown)` | The ids as a map from where each heading starts in the text.                          |
| `rehypeHeadingIds(ids)`        | A rehype plugin that sets ids from that map.                                          |

Ids are made from the heading's text (`## Set up` is `set-up`), and a repeated heading is numbered
(`setup`, `setup-1`), so the outline from `extractHeadings` links to the ids the page has.

With the html stage, the sanitizer prefixes every id with `user-content-`. To keep the plain ids,
set them after the sanitizer: pass `[rehypeHeadingIds(headingIdsByOffset(markdown))]` as the second
argument of `rehypePluginsFor`.

## Cutting a document into blocks

`<Markdown>` parses a reply block by block. The same tools are exported:

```ts
import { createBlockSplitter, splitBlocks } from 'llx-markdown/remark'

splitBlocks('# A\n\nText\n')
// [{ source: '# A\n\n', offset: 0, line: 1 }, { source: 'Text\n', offset: 5, line: 3 }]
```

Each block is a top-level piece of the document: a paragraph, a list, a table, a fence, a form. Its
`offset` and `line` say where it starts.

`createBlockSplitter()` is the same for a text that grows at its end. `splitter.split(text)` returns
the same blocks as `splitBlocks`, and the blocks that did not change are the very same objects as
last time, so `React.memo` or a `WeakMap` can skip them. Each call lexes only the end of the text;
a text that changed above its end is split afresh.

Parse a block on its own with `remarkBlockOffset({ offset, line })` first in the plugin list:
its positions then count from the start of the document, so heading ids and task-list keys are the
same as in a whole-document parse.

`rehypeTaskKeys` adds `data-task-key`, the source offset of the task, to each task-list checkbox: a
stable key for storing a tick or rewriting the `[ ]` it came from.

## More helpers

| Export                                     | What it does                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `hasMathSyntax(markdown)`                  | Whether the text holds a formula, without counting prices, shell variables or code. |
| `hasHtmlSyntax(markdown)`                  | Whether the text holds raw HTML outside code.                                    |
| `escapeLiteralDollars(markdown)`           | The text with each dollar sign that is not math escaped.                         |
| `isLiteralDollar(text, index)`             | Whether the `$` at `index` is a dollar sign.                                     |
| `markdownProseWithoutCode(markdown)`       | The text with code spans and fences blanked out, same length.                    |
| `parseFileTree(source)`                    | The rows of a ` ```tree ` fence body, as `TreeRow` objects.                      |
| `parseCalloutMarker`, `parseContainerMarker` | Read a `[!WARNING]` or `[!STEPS]` marker at the start of a quote.              |
| `CALLOUT_KINDS`, `CONTAINER_KINDS`         | The marker kinds: `note`…`caution`, and `steps`, `tabs`, `stats`, `pros`, `cons`. |

`llx-markdown/stream` holds the streaming helpers, also without React: see
[Streaming](streaming.md#without-react).
