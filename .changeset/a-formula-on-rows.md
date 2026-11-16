---
'@localix-ai/flowdown': minor
---

`@localix-ai/flowdown/tui` sets a display formula on rows (`$$`, a `math` fence, or `$$ … $$` alone
in a paragraph):

- a fraction stands over its rule;
- a sum, a product or a limit has its limits above and below it;
- a root's bar runs over what it takes;
- matrices, `cases` and alignments stand in columns, in brackets as tall as their rows;
- brackets around something tall grow to its height, with `\left` and `\right` or without.

A script Unicode has small letters for stays small, as before (`x²`, `∫₀¹`). A formula with nothing
to set on rows, one inside a sentence, and one too wide for the terminal are written on one row, as
before. Nothing is loaded for it; `math: false` still leaves formulas as written.
