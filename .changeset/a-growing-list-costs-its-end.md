---
'@localix-ai/flowdown': patch
---

A long list or quote that grows costs the part being written, not the block, in every target.
A list of more than 16 items is read a piece of 16 items at a time (`document/list.ts`). A piece that
is complete is parsed once, and its items are drawn once and kept: on a page they are the same
elements, and in a terminal the same rows. A piece is read as the items one parse of the whole list
makes, so what is drawn is unchanged. A list is cut only where nothing reaches across its items; a
loose list, or one with a lazy line, is read whole as before. A quote of more than 8 blocks, a
callout among them, is read 8 blocks at a time in the same way (`document/quote.ts`); a quote with a
form that takes what follows its marker, an attribution or a lazy line is read whole.

In `@localix-ai/flowdown/tui`, a paragraph that grows is wrapped again from its last rows, its words
read from where it changed: a paragraph of 19,000 characters streams in half the time it took.

The repair of a reply's unfinished end reads from the item being written, too: a bullet item ends
the paragraph above it, so no construct runs across it. Three flashes go with that:

- An unclosed `**` or backtick in an earlier item no longer adds its closer at the end of the last
  one, where it opened nothing.
- A `$$` in a paragraph above a list no longer hides the list.
- While a fence in a list item is still being written, its closing line is indented under the item.
  A line at the left edge ended the item and opened an empty code block below the list, which was
  drawn for every frame until the fence closed.

A marker left bare once a half-typed `*` is hidden (`- *`) is held back like one typed so.
