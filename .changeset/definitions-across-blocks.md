---
'@localix-ai/flowdown': minor
---

A reply with link reference definitions (`[docs]: https://…`, or the `[//]: # (comment)` some
writers use) is drawn block by block like any other. One definition used to keep the whole
document one block, read again on every token: over a stream of 37,000 characters with one at its
top the text was scanned 922 times over, and more the longer it was; it is scanned three times
over now, at any length (`references.test.ts` counts it). Each block is parsed with the
definitions of all of them, a paragraph of definitions is drawn with the block above it, and when
a definition arrives only the blocks that refer to it are drawn again. Footnotes still keep a
document whole.

`<Markdown>`, the page, the element and the terminal view do this by themselves. A target of your
own asks for it: `createDocument({ refs: true })`, then `parse(source, { refs: block.refs })` for
each block; without the option a text with definitions is one block, as before. `parse` takes
`refs`, `definitions(markdown)` of `/engine` reads the definitions of a text, and `splitBlocks`
and `createBlockSplitter` take `{ refs: true }`.

Three documents drawn block by block now match one parse of the whole, and did not: a reference
to a definition written inside a quote or a list item of another block, an image on the last line
of its block with its caption in the next, and a list a form governs that ends in the marker of
another form.
