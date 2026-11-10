# llx-markdown

## 0.3.0

### Minor Changes

- `<Markdown smooth>` shows a streaming reply at an even pace instead of in the bursts it arrives in:
  whole words, a gradual change of speed, and a soft end when the reply finishes. `useSmoothText` is
  the same pacing as a hook. The newest block of a streaming reply fades in.
  
  Folded sections (`> [!DETAILS]`, `<details>`) are an outlined panel whose content is inset by the
  panel itself, so text written straight after the summary and a code block inside line up; opening
  fades the content in. Checklists draw their own box, centred on the line. `<kbd>` is a keycap.
  Source numbers are centred on their row.
  
  Fixed: a callout's title was merged into its body when the body opened with formatting
  (`> [!CAUTION] Data loss` over a line starting with inline code).

## 0.2.1

### Patch Changes

- The package names its repository, home page and issue tracker, its README shows what a reply looks like, and releases are published with npm provenance. No change to the code.

## 0.2.0

### Minor Changes

- 6e2d464: llx-markdown now reads Markdown with its own parser and has no dependencies: 29 KB gzipped loads with `<Markdown>` (it was 69 KB) and one package is installed (it was 124). The parser passes every example of CommonMark 0.31.2 and of GitHub's extensions; see `docs/conformance.md`.
  
  **Breaking:** `remarkPlugins` and `rehypePlugins` are gone. Write your own syntax as an extension and pass it in `extensions` (inline rules, fences, passes over the tree), or keep a unified pipeline of your own and add `remarkLlx` from `llx-markdown/remark`. In `components`, `node` is the package's own node, not a hast element. `html` and `math` stages are extensions (`llx-markdown/html`, `llx-markdown/math`), passed the same way as before.
  
  Also new: a ` ```math ` fence is typeset as a display formula, a link from raw HTML that sets `target` always gets `rel="noopener"`, and `srcset` is held to the same URL rule as `src`.
  
  `components` now draws every element of its name: a task list's checkbox goes to the page's `input`, and footnotes to its `section`, `ol`, `li` and `sup`. A map that spreads a custom tag in beside HTML tags type-checks. `unstyled` leaves the `llx-markdown` class off the root, for a surface drawn entirely by `components`.

## 0.1.0

The first release.
