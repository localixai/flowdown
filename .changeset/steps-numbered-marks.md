---
'llx-markdown': patch
---

A tidier look for a reply on a page. A step is marked by its number in a round badge, with the
line between two steps on the badges' axis and the same gap at both ends; steps written as a
bulleted list get a dot. A code block right under a step's title sits nearer that title. A footnote
reference is a quiet raised number with no underline, and the notes close the reply under a rule,
smaller than the text. A tab that holds one code block shows it edge to edge. A diagram's nodes no
longer cast Mermaid's grey shadow, which glowed on a dark page.

If you set `--llx-step-dot`, set `--llx-mark` on `.llx-steps > li` instead.
