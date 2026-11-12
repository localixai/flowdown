---
'flowdown': minor
---

The package is now `flowdown` (it was `llx-markdown`), at https://flowdown.dev. To move:

- Install `flowdown` and import from `flowdown`, `flowdown/static`, `flowdown/styles.css` and so on:
  the entries and what they export are the same.
- The root class is `.flowdown`, every other class is `.fd-…` (it was `.llx-…`), and the tokens are
  `--fd-…` (they were `--llx-…`). Rename them in the CSS that restyles a reply.
- The custom element is `<flow-down>` (it was `<llx-markdown>`).
- `remarkLlx` is `remarkFlowdown`, and `llxDialect` is `flowdownDialect`.
