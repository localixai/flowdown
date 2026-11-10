---
title: Extensions and remark
description:
  Your own syntax in <Markdown>, and the dialect as a remark plugin without React — render HTML on
  a server, use another renderer, or cut a document into blocks yourself.
---

# Extensions and remark

llx-markdown reads Markdown with a parser of its own: `<Markdown>` has no dependencies. There are
two ways to go beyond what it draws:

- **An extension** adds your syntax to `<Markdown>`: an inline rule, a fence, a pass over the tree.
- **`llx-markdown/remark`** is the dialect as a [unified](https://unifiedjs.com) plugin, for a
  pipeline that is not `<Markdown>`: HTML built on a server, in an email or in a static site, or
  another renderer with components of your own.

## Your own syntax in `<Markdown>`

An extension is a plain object. `<Markdown>` runs it on each block, not on the whole document: a
block is read once and kept while the text below it grows, so an extension costs a streaming reply
only its last block.

```tsx
import { Markdown, type Extension } from 'llx-markdown'

/** `@name` as a link to the person. */
const mentions: Extension = {
  name: 'mentions',
  inline: [
    {
      chars: '@',
      parse(state) {
        const match = /^@([a-z\d-]+)/i.exec(state.text.slice(state.pos))
        if (!match) return false
        state.push({
          type: 'element',
          data: { hName: 'a', hProperties: { href: `/people/${match[1]}`, className: 'mention' } },
          children: [{ type: 'text', value: match[0] }],
        })
        state.pos += match[0].length
        return true
      },
    },
  ],
}

// A module constant: a new list on every render reads every block again.
const extensions = [mentions]

<Markdown extensions={extensions}>{reply}</Markdown>
```

An extension has a `name` and any of three parts:

| Part        | What it does                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `inline`    | Rules tried when the parser meets one of their `chars` in text (never inside code). `parse` reads from `state.pos` in `state.text`; on a match it calls `state.push(node)`, moves `state.pos` past what it read and returns `true`. Returning `false` leaves the character as text. |
| `fences`    | Fenced blocks by language: the rule gets the `code` node (`value` is the body, `meta` the rest of the opening line) and returns the node that replaces it. |
| `transform` | A pass over the finished tree of a block, with the block's text: how the dialect turns a quote into a callout. |

A node is `{ type, children?, value?, data? }`. Give a node `data.hName` and `data.hProperties`
and it is drawn as that element with those properties; a name you list in
[`components`](components.md) is drawn by your component. So a fence becomes a chart of your own:

```tsx
const charts: Extension = {
  name: 'charts',
  fences: {
    chart: (node) => ({
      type: 'element',
      data: { hName: 'my-chart', hProperties: { dataSpec: node.value ?? '' } },
    }),
  },
}

<Markdown extensions={[charts]} components={{ 'my-chart': Chart }}>{reply}</Markdown>
```

What to know:

- Your extensions run after the dialect's own pass and math, and before raw HTML is made into
  elements: a pass sees raw HTML as `html` nodes holding the text as written.
- `node.position` counts from the start of the block the node is in.
- A URL an extension writes in `href` or `src` passes [`urlTransform`](security.md#links-and-images)
  like any link's. Nothing else an extension makes is sanitized: it is your code, not the reply's.
- A page that passes extensions has its tables read whole, not row by row, so a pass sees all of a
  table; see [Streaming](streaming.md).

These examples are tests in the repository (`src/react/extensions.test.tsx`).

## HTML on a server

With React on the server, `<Markdown>` itself is the simplest way: it renders to a string like any
component, with every form drawn.

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from 'llx-markdown'
import { html } from 'llx-markdown/html'

const page = renderToStaticMarkup(<Markdown html={html}>{markdown}</Markdown>)
```

Without React, use the remark plugin in a unified pipeline of your own. The plugin is the dialect
only: GitHub's syntax is `remark-gfm`'s to read, before it.

```sh
bun add llx-markdown unified remark-parse remark-gfm remark-rehype rehype-stringify
```

```ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { remarkLlx } from 'llx-markdown/remark'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkLlx)
  .use(remarkRehype)
  .use(rehypeStringify)

const html = String(await processor.process(markdown))
```

`llx-markdown/remark` does not depend on unified; these packages are your pipeline's. Wrap the
output in an element with the class `llx-markdown` and import the stylesheet:

```html
<link rel="stylesheet" href="/llx-markdown/styles.css" />
<div class="llx-markdown"><!-- html --></div>
```

What the static output does not have: tabs that switch (the variants are all shown, one after
another, until a script or your own component turns `answer-tabs` into tabs), the copy button,
drawn diagrams, and file trees that open and close. ` ```mermaid ` and ` ```tree ` stay code blocks
with `language-mermaid` and `language-tree` classes.

Raw HTML and math in such a pipeline are the pipeline's own: `rehype-raw` and `rehype-sanitize`
(with [the schema below](#the-sanitize-schema)), `remark-math` and `rehype-katex`. With math, escape
literal dollars first, as `<Markdown>` does: `processor.process(escapeLiteralDollars(markdown))`.
See [Math](math.md#dollar-signs-that-are-not-math) for the rules.

## react-markdown with your own components

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkLlx } from 'llx-markdown/remark'

const remarkPlugins = [remarkGfm, remarkLlx]

;<ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
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
| Folded section | `<details class="llx-details">` with a `<summary>` when the marker has a title                        |
| Sources       | `<ul class="llx-sources">`, each `<li>` holding `div.llx-source`: the link (`span.llx-source-title`, `span.llx-source-host`) and `span.llx-source-note` |
| Code file name | `<code class="language-ts" data-title="src/app.ts">` for a fence that names its file                  |
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

A pipeline of your own that sanitizes would strip the dialect's markup: it does not know the
classes and attributes above. `sanitizeSchemaFor` adds them to a schema:

```ts
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { sanitizeSchemaFor } from 'llx-markdown/remark'

processor.use(rehypeSanitize, sanitizeSchemaFor(defaultSchema))
```

Only the dialect's own names pass: `llx-` classes, the forms' data attributes and the two tab
elements. `<Markdown>` does not need this: it has its own sanitizer, with the same rules.
[Security](security.md) lists what it allows.

## Heading ids

| Export                         | What it does                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `extractHeadings(markdown)`    | Every heading as `{ depth, text, id }`: an outline or table of contents.              |
| `remarkHeadingIds`             | A remark plugin that gives each heading the same id.                                  |
| `headingIdsByOffset(markdown)` | The ids as a map from where each heading starts in the text.                          |

Ids are made from the heading's text (`## Set up` is `set-up`), and a repeated heading is numbered
(`setup`, `setup-1`), so the outline from `extractHeadings` links to the ids `<Markdown headingIds>`
gives the page. `extractHeadings` is also exported from `llx-markdown` itself.

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
last time, so `React.memo` or a `WeakMap` can skip them. Each call scans only the end of the text;
a text that changed above its end is split afresh.

In `<Markdown>` every task-list checkbox carries `data-task-key`, where its `[ ]` starts in the
document: a stable key for storing a tick or rewriting the text it came from.

## More helpers

| Export                                     | What it does                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `hasMathSyntax(markdown)`                  | Whether the text holds a formula, without counting prices, shell variables or code. |
| `hasHtmlSyntax(markdown)`                  | Whether the text holds raw HTML outside code.                                    |
| `escapeLiteralDollars(markdown)`           | The text with every `$` that is not a math delimiter escaped, so `remark-math` pairs what `<Markdown>` pairs. |
| `isLiteralDollar(text, index)`             | Whether the `$` at `index` is a price or a shell variable, by its look alone.    |
| `markdownProseWithoutCode(markdown)`       | The text with code spans and fences blanked out, same length.                    |
| `parseFileTree(source)`                    | The rows of a ` ```tree ` fence body, as `TreeRow` objects.                      |
| `parseCalloutMarker`, `parseContainerMarker` | Read a `[!WARNING]` or `[!STEPS]` marker at the start of a quote.              |
| `CALLOUT_KINDS`, `CONTAINER_KINDS`         | The marker kinds: `note`…`caution`, and `steps`, `tabs`, `stats`, `pros`, `cons`. |

`llx-markdown/stream` holds the streaming helpers, also without React: see
[Streaming](streaming.md#without-react).
