---
'llx-markdown': minor
---

llx-markdown now reads Markdown with its own parser and has no dependencies: 29 KB gzipped loads with `<Markdown>` (it was 69 KB) and one package is installed (it was 124). The parser passes every example of CommonMark 0.31.2 and of GitHub's extensions; see `docs/conformance.md`.

**Breaking:** `remarkPlugins` and `rehypePlugins` are gone. Write your own syntax as an extension and pass it in `extensions` (inline rules, fences, passes over the tree), or keep a unified pipeline of your own and add `remarkLlx` from `llx-markdown/remark`. In `components`, `node` is the package's own node, not a hast element. `html` and `math` stages are extensions (`llx-markdown/html`, `llx-markdown/math`), passed the same way as before.

Also new: a ` ```math ` fence is typeset as a display formula, a link from raw HTML that sets `target` always gets `rel="noopener"`, and `srcset` is held to the same URL rule as `src`.

`components` now draws every element of its name: a task list's checkbox goes to the page's `input`, and footnotes to its `section`, `ol`, `li` and `sup`. A map that spreads a custom tag in beside HTML tags type-checks. `unstyled` leaves the `llx-markdown` class off the root, for a surface drawn entirely by `components`.
