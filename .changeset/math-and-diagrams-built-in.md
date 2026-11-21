---
'@localix-ai/flowdown': minor
---

Formulas and diagrams are built in, with no dependency.

- **Math is MathML.** `@localix-ai/flowdown/math` writes `$…$`, `$$…$$` and ```` ```math ```` as
  MathML the browser lays out itself (`@localix-ai/math`, 11 KB), nine times faster than KaTeX on the
  formulas agents write. Import `@localix-ai/flowdown/math.css` (the math font) in place of KaTeX's
  stylesheet, and drop the `katex` dependency: it is no longer a peer. A formula is now
  `<span class="fd-math">` (with `fd-math-display` for a display formula) around a `<math>`; a page
  that styled `.katex` styles `.fd-math`. A formula cut off or with an unknown command is drawn as far
  as it goes, never an error.
- **Diagrams without Mermaid.** `<Markdown mermaid>` (`true`) draws ```` ```mermaid ```` fences with
  `@localix-ai/diagram`: every kind Mermaid has, as modern SVG in the page's colours, fetched with the
  first diagram, about 30 times faster than Mermaid and 56 KB against its 1.6 MB. A loader
  (`() => import('mermaid')`) still draws with Mermaid. `builtInDiagrams` is exported from
  `@localix-ai/flowdown/mermaid` for a frame of your own.
- **The terminal reads formulas with the same parser** as a page: every environment, typefaces as
  Unicode's math letters, braces with their labels, `\xrightarrow`.
