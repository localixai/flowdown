---
'@localix-ai/flowdown': patch
---

A reply streams in linear time whatever its code shows. A tag that only code leaves open made
the rest of the reply one block, drawn again whole on every token: a render prop
(`<List renderItem={(x) => (…)} />`, whose `=>` read as the end of the tag), an `<li>` an HTML
snippet leaves to the parser to close, a `<!--` in a template. In Chrome on a two-core machine,
80,000 characters after one such fence took 54 s to stream and now take 0.8 s, and the README
of markdown-to-jsx took 13 s and now takes 1.2 s. A tag in a fenced code block is now code, and a
closing tag in one (`</details>` in an example) no longer ends the HTML block around it, which
drew the text after it outside the `<details>` while the reply streamed.

Four more frames of a stream drew differently from the finished reply:

- a fence still being written left out its file name (`data-title`, from
  ` ```ts title="src/a.ts" `) on React, on the page and in `<flow-down>`;
- tabs whose heading came after a blank line under a lone `$$` lost the block after them;
- an item that opened empty was read as holding the indented code under its blank line;
- a closing tag with nothing open (a second `</div>`) was taken to close the tag opened after it,
  and the heading under that tag was drawn outside it.

While a reply streams, the row of dashes under a table's header (`|--`), a footnote reference
being typed (`[^1`) and a task's box before its first word (`- [x`) are held back for the token or
two until they mean something, instead of showing as text.
