---
'@localix-ai/flowdown': patch
---

A table that grows row by row is drawn by its last rows only again. In 0.6.0 a block that may
refer to a link definition was handed a new `refs` with every token while it grew, and `<Markdown>`
compares it: a long table with a `[` anywhere in it drew all of its rows again on each token, twice
the time of 0.5.2. The block that stands in the same place keeps the `refs` it had, until a
definition it asked for changes. And a piece of the reply is no longer searched for definitions
on every token: one that is link definitions is told by how it starts.
