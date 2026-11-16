---
'@localix-ai/flowdown': patch
---

Raw HTML and formulas are found where the parser finds them. Whether a reply holds HTML, and so
whether the `html` stage is loaded, was told by a scan of its lines. The scan did not know what
holds a fence. Under a list item, a fence indented four spaces is a fence, not indented code, so
the scan took the line that closes it for a line that opens another fence, and everything after
it for code. Nor did it know where a block ends: a backtick run in one paragraph and another in
an HTML block below it were blanked as one code span, with every line between them. The HTML in
442 of the 46,334 blocks of the fuzz corpus was dropped from the page this way.

Now the parser's own reading of the blocks says where code is, and a code span is looked for
only inside the text of one block. HTML is found in a text that a page with math reads one way and
a page without math reads another, in either reading. The escaper of literal dollars reads `$$`
fences as a page with math does: a fence inside a formula is its text. It never touched code, and
still does not.

`markdownProseWithoutCode` (in `/remark`) takes `mathFences`, true by default. Pass `false` to
read the text as a page without math does.
