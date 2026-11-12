---
'@localix-ai/flowdown': patch
---

Colours survive a bundler that lowers `light-dark()`. Vite 8 builds CSS with Lightning CSS for
browsers older than `light-dark()`, which rewrites every token into a pair of variables it sets only
where the page declares `color-scheme`. On a page that declared none, every colour was invalid:
callouts, code blocks, step marks and tabs lost their fills and borders. The stylesheet now makes
light the default for that case, as `light-dark()` does natively; a `.dark` class,
`data-theme="dark"` or a `color-scheme` of the page still switch it.

`document.querySelector('flow-down')` is typed as the element, so `markdown` and `streaming` are
there without a cast once `@localix-ai/flowdown/element` is imported.
