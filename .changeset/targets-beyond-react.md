---
'llx-markdown': minor
---

The same reply outside React, from the one package. `llx-markdown/static` gives the HTML
`<Markdown>` draws as text, for a server or an email. `llx-markdown/dom` mounts a reply on a page
with no framework and keeps it up to date token by token, with working tabs, file trees and code
buttons. `llx-markdown/element` is a custom element, `<llx-markdown>`, for Vue, Svelte, Solid or
Angular. `llx-markdown/tui` draws a reply as the rows of a terminal, wrapped to its width, with code
coloured by the highlighter a page takes and formulas written in Unicode (`x²`, `1/k ∑ᵢ₌₁ᵏ rᵢ`).
Each form has a terminal's own look: steps are a numbered chain down a rail, figures stand side by
side over what they count, a file tree has its branches, a source its address on a row of its own.
`llx-markdown/document` and `llx-markdown/engine` are the blocks and the parser, for a target of
your own. None of them imports React.

`<Markdown>` draws what it drew. It now loads 31.7 KB gzipped, from 30.5: the renderer is shared
by every target.
