---
'@localix-ai/flowdown': patch
---

Four readings of the parser are fixed. A new differential fuzz (`bun run --cwd bench
differential`) found them: it compares the parser with micromark on 50,000 seeded documents, and
in these four cases micromark and markdown-it agree with each other.

- A blank line after indented code in a list item makes the list loose. The code's trailing blank
  lines were counted as its own, so the gap after them was not seen.
- A link reference definition is a block of its list item, so a blank line before it makes the
  list loose, as CommonMark's example 317 counts it.
- A list item that can interrupt a paragraph is read before a table's row of dashes. `b\n- |` is a
  paragraph and a list, as GitHub's parser reads it, not a table.
- A header that is a pipe alone heads no table.

The Rust crate reads them the same way.
