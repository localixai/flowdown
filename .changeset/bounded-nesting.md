---
'@localix-ai/flowdown': patch
---

A reply can no longer stall or crash its page by its shape alone.

- **Nesting is bounded.** Blocks nest a hundred deep and so do emphasis, links and images; past
  that the rest is kept as text. Twenty thousand `>` on one line, or tens of thousands of `*`
  around a word, used to throw `RangeError: Maximum call stack size exceeded`.
- **A link destination nests parentheses 32 deep**, as cmark reads them. `[a](` repeated over
  313 KB took thirteen seconds to read and now takes twenty milliseconds.
- **`flowdown/tui` measures a word wider than its row once.** 656 KB without a space took six
  seconds to wrap and now takes under thirty milliseconds.
