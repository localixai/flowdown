---
title: Streaming
description:
  How flowdown renders a reply that is still arriving — block memoization, completing the
  unfinished end, the caret, and using the same tools outside React.
---

# Streaming

A model's reply arrives a few characters at a time. Rendering it naively has two problems: the whole
reply is parsed again on every token, and its unfinished end flashes raw syntax — `**bo` shows two
asterisks, an open code fence shows as text, `> [!STE` shows as a grey quote — until the model
closes it a moment later.

`<Markdown streaming>` solves both:

```tsx
<Markdown streaming={isStreaming}>{text}</Markdown>
```

Pass the **whole** text each time, not the new part, and set `streaming` to `false` when the reply
is complete.

## Only the last block is parsed again

The text is cut into its top-level blocks — paragraphs, lists, tables, fences, forms — and each
block is rendered on its own and remembered by its source. A token changes only the last block, so
only the last block is parsed and reconciled; everything above it is kept as it is. The cost of a
token stays the cost of one block, however long the reply grows.

The cut never changes the result. A block is kept together with its neighbours wherever one parse of
the whole document would read them together:

- a form's marker and the content it takes (`> [!STEPS]` and its list, `> [!TABS]` and its sections,
  `[!PROS]` and the `[!CONS]` after it);
- an image and the caption line under it;
- an HTML block whose closing tag comes further down;
- a `$$` formula with blank lines inside.

A document with footnotes or link reference definitions, which resolve across the whole text, is
rendered as one block. The test suite renders a corpus both ways, and token by token, and requires
the same markup.

Heading ids (`headingIds`) are the one feature that reads the whole document on each change, to
number repeated headings; leave it off for a reply that streams.

## The unfinished end is completed

While `streaming` is on, the end of the text is completed so it renders the way it will when it is
finished:

| Arriving                      | Renders as                                    |
| ----------------------------- | --------------------------------------------- |
| `**bo`                        | **bo**                                        |
| `*ital`, `~~stri`             | _ital_, ~~stri~~                              |
| `` `cod ``                    | `cod`                                         |
| ` ```ts ` and lines of code   | a code block, growing                         |
| `[text](https://exa`          | the link text                                 |
| `![alt](https://exa`          | nothing until the URL is complete             |
| `$\frac{a}{`                  | nothing from the `$` until the formula closes |
| a half-typed table row        | the rows that are complete                    |
| `> [!WARN`                    | nothing until the `]`                         |
| `> [!STEPS]` with no list yet | nothing until the list starts                 |

The completion is conservative: it closes what is clearly open and never guesses. A `*` in `*.ts` or
`a * b`, an `_` in `snake_case`, a `$` in `$5` or `$HOME` are not emphasis or math, and are left
alone. When `streaming` turns off, the final text is rendered exactly as written.

## Diagrams and code while streaming

- A Mermaid diagram above the end of the reply is complete, so it is drawn at once.
- The diagram still being written keeps showing its source, which grows, and is drawn when its fence
  closes. A diagram never re-renders on every token.
- Code is highlighted as it is written. A fence still being written is drawn in pieces of 40 lines:
  a token redraws and highlights only the last piece, so a file of a thousand lines streams as fast
  as a short one. When the fence closes, the block is highlighted whole.

## Tables while streaming

A table is one block, and a model that prints results row by row grows it to hundreds of rows. It is
drawn as its header and its rows in pieces of 16: a piece that is complete is parsed and drawn once,
and a token redraws only the last piece, so a table of 160 rows streams about seven times faster
than through one parse. Every piece is read with the table's own header, so the result is the table
one parse draws, element for element.

A page that passes its own `table`, `thead` or `tbody` element, or its own extensions, gets each
table whole, as its code expects.

## The caret

A caret follows the text while it streams. It is drawn in CSS, after the last line, when the reply
ends in text — not inside a code block or a table. Turn it off with `caret={false}`, or restyle it:

```css
.flowdown[data-caret] {
  --fd-caret-color: var(--brand);
}
```

With `prefers-reduced-motion`, the caret stays still.

## Smoothing

A model's text reaches the page in uneven pieces: one network frame holds a word, the next holds
forty. Drawn as it lands, the reply jumps by a line and then stands still. `smooth` shows it at an
even pace instead:

```tsx
<Markdown streaming={!done} smooth>
  {reply}
</Markdown>
```

- **Even speed.** What has arrived and is not shown yet is shown over about 240 ms, and the speed
  changes gradually: a burst makes the flow faster, it does not land whole. `smooth={400}` sets the
  time.
- **Whole words.** A word typed letter by letter at the end of a line grows there and then jumps to
  the next line when it stops fitting. A word shown whole is placed once. The word still being
  typed is held back until it ends, or until the reply has stood still for a moment; a long token
  (a URL, a hash) is not waited for.
- **A soft end.** When `streaming` turns false, what is left is shown at the same pace, and the
  caret and the completed syntax stay until it is all there.
- **No replay.** Text that is there when streaming begins is shown at once; only growth is paced.
- **Nothing extra when idle.** The frame loop runs only while there is text to show, about 30
  steps a second, each of which parses the last block only.
- With `prefers-reduced-motion`, text is shown as it arrives.

Beside the pacing, the stylesheet brings the newest block in over a 200 ms fade, so the panel of a
code block or a table does not pop onto the page, and stops re-balancing the lines of the paragraph
that is still growing. Neither needs `smooth`.

`useSmoothText(text, streaming, catchUpMs?)` is the same pacing for text a page draws itself (a
tool's output, a title): it returns `[shown, behind]`.

## Without React

The same tools are in `@localix/flowdown/stream`, with no React, for a renderer of your own or a server
that sends partial HTML:

```ts
import { closePartialMarkdown, splitBlocks } from '@localix/flowdown/stream'

// Complete the end of a reply that is still arriving. Never apply it to the final text.
const stable = closePartialMarkdown(partialText)

// Cut a document into blocks you can render and cache one by one.
for (const block of splitBlocks(stable)) {
  console.log(block.offset, block.source)
}
```

| Export                         | What it does                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `closePartialMarkdown(text)`   | Completes or hides the constructs `text` ends inside.                        |
| `splitBlocks(text)`            | Top-level blocks: `{ source, offset, line }`, cut where one parse would cut. |
| `openFenceBody(text)`          | The body of the code fence `text` ends inside, or `null`.                    |
| `isGrowingFence(body, source)` | Whether a fence's source is that growing body.                               |

Blocks carry their `offset` and `line` in the document: add them to a position inside a block to
get the place in the whole text.
