---
'@localix-ai/flowdown': patch
---

A block that grows on every token costs its end, not its length, in the targets that had not
kept up with `<Markdown>` (figures from `bench/src/growth.ts`, `results/growth-before.md` beside
`results/growth.md`):

- `@localix-ai/flowdown/static`, `/dom` and `/element` highlight each complete piece of a fence
  still being written once, and read each complete piece of a growing table once. A 900-line file
  streamed with a highlighter took 9.7 s of script; it takes 1.0 s, and four times the file costs
  four times as much. A table of 160 rows streams in under half the time.
- `@localix-ai/flowdown/tui` reads a fence still being written without parsing its block and draws
  it in pieces of 40 lines, with or without a highlighter. It reads a growing table a piece of 16
  rows at a time and lays a row out again only when the widths of the columns change. The parts of
  the block that grows (the items of a list above the last, the paragraphs of a quote) keep their
  rows. A 900-line file draws in a seventh of the time, half with a highlighter; a table of 160
  rows in a fifth, and four times the rows cost four times as much; a list of 240 items in a third.
  The rows of what did not change are the same objects from one token to the next.

What is drawn is unchanged.
