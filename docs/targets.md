---
title: Other targets
description:
  The same Markdown and dialect outside React — as HTML text on a server, on a page with no
  framework, as a custom element for Vue, Svelte, Solid or Angular, and as the rows of a terminal.
---

# Other targets

`<Markdown>` is one of five ways the package draws a reply. All of them read the same text with the
same parser and the same dialect, and all are in the one package: an import path picks the target,
and a page ships only the one it imports.

| Import                 | Draws                                              | Needs        |
| ---------------------- | -------------------------------------------------- | ------------ |
| `llx-markdown`         | React elements.                                    | `react`      |
| `llx-markdown/static`  | HTML text: a server, an email, a static site.      |              |
| `llx-markdown/dom`     | A page with no framework, kept up to date in place. | a browser    |
| `llx-markdown/element` | A custom element, `<llx-markdown>`.                | a browser    |
| `llx-markdown/tui`     | The rows of a terminal.                            |              |

None but the first imports React, and none imports any package. `/static` and `/tui` touch no page
either: they run on a server, in a worker and in a CLI.

## HTML text

```ts
import { renderToHtml } from 'llx-markdown/static'

const html = renderToHtml(reply, { headingIds: true })
```

The HTML is what `<Markdown>` draws, root element and all, so `llx-markdown/styles.css` styles it.
Nothing in it runs: tabs show their first variant, and a code block's buttons are drawn but do
nothing until something on the page wires them. Pass `streaming: true` for a reply that is still
arriving.

Math, raw HTML and highlighting are passed in, the same engines `<Markdown>` takes:

```ts
import { html } from 'llx-markdown/html'
import { highlight } from 'llx-markdown/highlight'
import { math } from 'llx-markdown/math'

renderToHtml(reply, { html, math, highlight })
```

Without `html`, tags in the text are left out. With it they are parsed and sanitized, as in React.

## A page with no framework

```ts
import { mount } from 'llx-markdown/dom'
import 'llx-markdown/styles.css'

const reply = mount(document.querySelector('#reply')!)
for await (const text of stream) reply.update(text, { streaming: true })
reply.update(text)
```

`update` takes the whole text each time. A block that did not change is not touched, so a token
costs the last block, and the elements above it stay the very same nodes: a selection, a scroll
position and an open `<details>` survive the stream. Tabs switch, a file tree folds, a code block
copies and saves, and a wide table can be scrolled from the keyboard. `destroy()` takes the document
off the page.

This is also what a binding for a framework is made of: mount into the element the framework gives
you, call `update` when the text changes, and `destroy` when the element goes.

## A custom element

```ts
import { defineMarkdownElement } from 'llx-markdown/element'
import 'llx-markdown/styles.css'

defineMarkdownElement()
```

```html
<llx-markdown streaming></llx-markdown>
```

```ts
element.markdown = text
```

The text is the `markdown` property, and the `streaming` attribute says the reply is still arriving.
Text written inside the element is shown until the property is first set. The document is drawn in
the page, not in a shadow tree, so the page's stylesheet and theme reach it.
`defineMarkdownElement(name, options)` takes another name and the options every such element is
drawn with.

## A terminal

```ts
import { renderToAnsi } from 'llx-markdown/tui'

process.stdout.write(renderToAnsi(reply, { width: process.stdout.columns }) + '\n')
```

Words are wrapped by the columns they take (a CJK character or an emoji takes two) and no row is
wider than `width`. Escape sequences and other control characters in a reply are never passed on to
the terminal. `color: false` leaves the colours out, for a pipe or `NO_COLOR`.

Each form is drawn the way a terminal draws that kind of thing:

| In the reply         | In the terminal                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| Headings             | By weight: underlined bold, bold, bold italic, then italic                        |
| Lists                | `•` and `◦` by depth; a task is `✓` or `☐`                                        |
| A callout            | Behind a bar in its kind's colour, its label and title on the first row           |
| `[!STEPS]`           | A chain: the numbers in one column, a rail from each step down to the next        |
| `[!STATS]`           | Side by side, each number over what it counts; a list when a row cannot hold them |
| `[!TABS]`            | One under another, each under a rule with its label                               |
| `[!PROS]`, `[!CONS]` | `+` in green, `-` in red                                                          |
| `[!SOURCES]`         | Numbered; the name and its note on a row, the address whole on the next           |
| A table              | In columns, aligned as written, cells wrapped inside their column                 |
| A `tree` fence       | With branches (`├─`, `└─`), folders bold, what is said of the names in one column |
| A `diff` fence       | Green where it adds, red where it removes, with or without a highlighter          |
| A `mermaid` fence    | Its source under a `Diagram` label: a terminal cannot draw it                     |

Other fenced code is one colour until the terminal is given a highlighter, the same one a page
takes:

```ts
import { highlight } from 'llx-markdown/highlight'
import { renderToAnsi } from 'llx-markdown/tui'

process.stdout.write(renderToAnsi(reply, { width: process.stdout.columns, highlight }) + '\n')
```

Keywords are magenta, strings green, numbers and attributes yellow, types and commands cyan,
comments dim, function names bold. Those
are the terminal theme's own colours, so they follow a light or a dark one. Highlighting changes
colours only: every row has the text, the width and the breaks it has without it.

A formula is written in Unicode, since a terminal has one size of letter on one line:
`$\bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i$` is drawn as `r̄ = 1/k ∑ᵢ₌₁ᵏ rᵢ`. A command with a symbol
becomes the symbol, a fraction a slash, a script the small letters Unicode has (`x^2` is `x²`) or
the script as written where it has none (`e^(iπ)`); a command the terminal does not know stays as
it was written. A formula inside a sentence stays inside it, and one on lines of its own (`$$`, a
`math` fence) is set in on rows of its own. A `$` that is money or a shell variable is text, by the
[rule a page follows](math.md#dollar-signs-that-are-not-math). No KaTeX is loaded; `math: false`
leaves formulas as the text they were written as.

For a reply that is still arriving, keep a view:

```ts
import { createTerminalView, toAnsi } from 'llx-markdown/tui'

const view = createTerminalView({ width: 80 })
for await (const text of stream) draw(view.render(text, { streaming: true }))
draw(view.render(text))
```

`render` returns rows as plain values: `Line`, a list of `{ text, style }`. The rows of a block that
did not change are the same objects as at the last render, so a screen that compares by identity
repaints only what is new. `toAnsi(lines)` writes them for a terminal; a TUI library with a screen
of its own reads them as they are.

[`examples/tui`](https://github.com/rsaryev/llx-markdown/tree/main/examples/tui) is that loop in one short
script: a reply with every form, streamed into the terminal and redrawn from the first row that
changed.

## A target of your own

Two lower entries are what the targets above are built on:

- `llx-markdown/document` turns a growing text into blocks. `createDocument().update(text, {
  streaming })` gives `blocks`, and a block that reads the same as at the last update is the same
  object.
- `llx-markdown/engine` is the parser: `parse(markdown)` gives the tree, `toHtml(tree)` writes it.

The dialect marks what a node is, apart from how it is drawn: a quote is
`{ form: 'callout', kind: 'warning' }`, a list `{ form: 'steps' }`. A target switches on the form
and draws it its own way; a form it does not know is still the Markdown it was written as, a quote
or a list.

```ts
import { createDocument, formOf, llxDialect } from 'llx-markdown/document'
import { parse } from 'llx-markdown/engine'

const doc = createDocument()

function draw(text: string, streaming: boolean) {
  const { blocks, closer } = doc.update(text, { streaming })
  blocks.forEach((block, index) => {
    // Keep what you drew for a block: the same object means the same block.
    const source = index === blocks.length - 1 ? block.source + closer : block.source
    for (const node of parse(source, { extensions: [llxDialect] }).children ?? []) {
      if (formOf(node)?.form === 'callout') {
        // …
      }
    }
  })
}
```
