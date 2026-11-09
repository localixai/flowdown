---
title: API reference
description:
  Every entry point and export of llx-markdown, and every prop of `<Markdown>`.
---

# API reference

## Entry points

| Import                    | Holds                                                         | Needs                       |
| ------------------------- | ------------------------------------------------------------- | --------------------------- |
| `llx-markdown`            | `<Markdown>`, its components, types and labels.                | `react` 18.2 or 19          |
| `llx-markdown/styles.css` | The stylesheet and its `--llx-*` tokens.                      |                             |
| `llx-markdown/remark`     | The dialect as unified plugins, the sanitize schema, blocks, headings. |                    |
| `llx-markdown/stream`     | Completing a partial reply, without React.                    |                             |
| `llx-markdown/prompt`     | The instructions that teach a model the dialect. Plain text.  |                             |
| `llx-markdown/html`       | The raw HTML stage (parser and sanitizer).                    |                             |
| `llx-markdown/math`       | The math stage.                                               | `katex` 0.16 or later       |
| `llx-markdown/highlight`  | A highlighter for fenced code.                                | `highlight.js` 11           |

The package is ESM only. Every module that uses React hooks starts with `'use client'`.
`llx-markdown/remark`, `/stream` and `/prompt` import no React and run anywhere.

## `<Markdown>`

```tsx
import { Markdown } from 'llx-markdown'
import 'llx-markdown/styles.css'

;<Markdown streaming={!done}>{text}</Markdown>
```

| Prop           | Type                                    | Default            | What it does |
| -------------- | --------------------------------------- | ------------------ | ------------ |
| `children`     | `string`                                |                    | The Markdown. While streaming, the whole text so far, not the new part. |
| `streaming`    | `boolean`                               | `false`            | The text is still arriving: its unfinished end is completed and a caret follows it. See [Streaming](streaming.md). |
| `caret`        | `boolean`                               | `streaming`        | Show the caret after streaming text. |
| `components`   | `MarkdownComponents`                    |                    | Your own elements for any tag or the dialect's, and `diagram` / `tree` for the two fences that are not code. Keep the object stable. See [Components](components.md). |
| `remarkPlugins` | `PluggableList`                        |                    | Your remark plugins, after the dialect's, on each block. Keep the list stable. See [Plugins](remark.md#your-own-plugins-in-markdown). |
| `rehypePlugins` | `PluggableList`                        |                    | Your rehype plugins: after the sanitizer, before formulas are typeset, on each block. Keep the list stable. |
| `headingIds`   | `boolean`                               | `false`            | Give headings ids (`setup`, `setup-1`), the ids `extractHeadings` returns. |
| `html`         | `boolean \| StageOption<HtmlPlugin>`    | `true`             | Raw HTML. `true` loads the parser the first time a document holds HTML and leaves the tags out until then; `html` from `llx-markdown/html` parses in the first render; `false` drops raw HTML. See [Security](security.md). |
| `math`         | `StageOption<MathPlugin>`               | `null`             | Typeset `$…$`: `llx-markdown/math`, or a loader for it. See [Math](math.md). |
| `mermaid`      | `MermaidLoader \| null`                 | `null`             | Draw ` ```mermaid ` fences: `() => import('mermaid')`. See [Diagrams](diagrams.md). |
| `highlight`    | `Highlighter \| null`                   | `null`             | Highlight fenced code. See [Highlighting](highlighting.md). |
| `labels`       | `LabelOverrides`                        | `DEFAULT_LABELS`   | The words the renderer adds, for another language. See [Components](components.md#labels). |
| `urlTransform` | `UrlTransform \| null`                  | react-markdown's   | Rewrite or refuse a link or image URL. See [Security](security.md#links-and-images). |
| `className`    | `string`                                |                    | Added to the root element beside `llx-markdown`. |

The root element is a `div.llx-markdown`. While streaming it has `data-streaming`, and
`data-caret` while the caret shows.

Functions and objects passed as props are compared by reference. Define loaders, the highlighter,
`components` and `labels` once (at module level or in `useMemo`); a new one on every render makes
every block render again.

## `llx-markdown`

### Components

| Export                 | Draws                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `Callout`              | `blockquote`: a typed callout, or a plain quote.                                         |
| `Code`                 | `code`: inline or fenced code, highlighted when a highlighter is set.                    |
| `CodeBlock`            | `pre`: the fenced block with its language and copy button.                              |
| `Diagram`              | A Mermaid diagram from `source`.                                                         |
| `FileTree`             | A directory tree from `source`, the body of a ` ```tree ` fence. `getIcon` picks icons.  |
| `Tabs`, `Tab`          | `answer-tabs` and `answer-tab`: the `[!TABS]` form.                                      |

### Helpers

| Export                              | Returns                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `extractHeadings(markdown)`         | `MarkdownHeading[]`: `{ depth, text, id }` for each heading. |
| `getLanguage(className)`            | The language of a `language-*` class, or `undefined`.       |
| `childrenToText(children)`          | The text of React children.                                 |
| `isCodeBlock(children, className)`  | Whether a `code` element is a block rather than inline.     |
| `DEFAULT_LABELS`                    | The English labels, a `MarkdownLabels`.                     |

### Types

| Type                         | Shape                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| `MarkdownProps`              | The props above.                                                            |
| `Components`                 | react-markdown's element map.                                               |
| `Highlighter`                | `(code: string, language: string) => string \| null`: HTML, escaped, or `null` to leave the code plain. |
| `StageLoader<T>`             | `() => Promise<T \| { default: T }>`: a dynamic `import()` of a stage.      |
| `StageOption<T>`             | `T \| StageLoader<T> \| null`.                                              |
| `HtmlPlugin`                 | `{ rehypePlugins }`: the raw HTML stage.                                    |
| `MathPlugin`                 | `{ remarkPlugins, rehypePlugins }`: the math stage.                         |
| `MermaidLoader`              | `() => Promise<Mermaid \| { default: Mermaid }>`.                           |
| `MarkdownLabels`             | Every label. `LabelOverrides` is the same with every key optional.          |
| `FileTreeProps`              | `{ source: string; getIcon?: (row: TreeRow, open: boolean) => TreeIcon }`.   |
| `TreeRow`                    | `{ depth, name, comment, folder, path, parent }`: one row of a tree.        |
| `TreeIcon`                   | A component that takes SVG props.                                           |
| `MarkdownHeading`            | `{ depth: number; text: string; id: string }`.                              |

A stage loader is called once per `<Markdown>`, the first time its document needs the stage. A
load that fails leaves the document readable without it.

## `llx-markdown/remark`

See [Remark and rehype](remark.md).

| Export                                              | What it is                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `remarkLlx`                                         | The plugin list: `remark-gfm` and `remarkAnswerBlocks`.                         |
| `remarkAnswerBlocks`                                | The dialect alone: callouts, forms, quote sources, figures, section numbers.    |
| `remarkPluginsFor({ math })`                        | `remarkLlx`, plus the math stage's plugins when given.                          |
| `rehypePluginsFor({ html, math }, beforeMath?)`     | Raw HTML and the sanitizer when `html` is given, task keys, `beforeMath`, then math. |
| `sanitizeSchema`                                    | GitHub's sanitize schema, extended for the dialect.                             |
| `rehypeTaskKeys`                                    | Adds `data-task-key`, the source offset, to task-list checkboxes.               |
| `extractHeadings(markdown)`                         | Every heading with its id.                                                      |
| `remarkHeadingIds`                                  | Gives each heading its id.                                                      |
| `headingIdsByOffset(markdown)`                      | `Map<offset, id>` for every heading.                                            |
| `rehypeHeadingIds(ids)`                             | Sets heading ids from that map.                                                 |
| `splitBlocks(markdown)`                             | `MarkdownBlock[]`: the top-level blocks, `{ source, offset, line }`.            |
| `createBlockSplitter()`                             | A `BlockSplitter`: `split(markdown)` for a growing text, reusing unchanged blocks; `lexed`, the characters lexed so far. |
| `remarkBlockOffset({ offset, line })`               | Shifts a block's positions to where it sits in its document.                    |
| `escapeLiteralDollars(markdown)`                    | The text with dollar signs that are not math escaped.                           |
| `isLiteralDollar(text, index)`                      | Whether one `$` is a dollar sign.                                               |
| `hasMathSyntax(markdown)`, `hasHtmlSyntax(markdown)` | Whether the text holds math, or raw HTML, outside code.                        |
| `markdownProseWithoutCode(markdown)`                | The text with code blanked out, same length.                                    |
| `parseFileTree(source)`                             | `TreeRow[]` from a ` ```tree ` fence body.                                      |
| `parseCalloutMarker(text)`                          | `{ kind, title, consumed }` for a `[!NOTE]`-style marker, or `null`.            |
| `parseContainerMarker(text)`                        | The same for `[!STEPS]`, `[!TABS]`, `[!STATS]`, `[!PROS]`, `[!CONS]`.           |
| `containerMarker(kind)`                             | The marker text for a kind: `[!STEPS]`.                                         |
| `CALLOUT_KINDS`                                     | `note`, `tip`, `important`, `warning`, `caution`.                               |
| `CONTAINER_KINDS`                                   | `steps`, `tabs`, `stats`, `pros`, `cons`.                                       |
| `DIAGRAM_FENCE_LANGUAGE`, `TREE_FENCE_LANGUAGE`     | `'mermaid'` and `'tree'`.                                                       |
| `DIAGRAM_KINDS`                                     | The Mermaid kinds the prompt teaches.                                           |
| `ANSWER_FORM_EXAMPLES`                              | The examples the prompt shows.                                                  |
| `ATTRIBUTION_PREFIX`                                | The pattern of a quote's source line, `— Author`.                               |

Types: `HtmlPlugin`, `MathPlugin`, `PipelineOptions`, `MarkdownHeading`, `MarkdownBlock`,
`BlockSplitter`, `TreeRow`.

## `llx-markdown/stream`

See [Streaming](streaming.md#without-react).

| Export                                 | What it does                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `closePartialMarkdown(text)`           | Completes or hides the constructs a partial reply ends inside: a fence, `**bold`, a link, a formula, a half-typed marker. Never apply it to the final text. |
| `openFenceBody(text)`                  | The body of the code fence `text` ends inside, or `null` when every fence is closed. |
| `isGrowingFence(growing, source)`      | Whether a block's source is that fence body: the one block still being written. |
| `splitBlocks(markdown)`                | The top-level blocks.                                                         |

## `llx-markdown/prompt`

See [Prompting](prompting.md).

| Export                                   | What it is                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `answerFormatPrompt(options?)`           | The section that teaches the dialect. Options: `header`, `math`, `diagrams`. |
| `answerFormsPrinciple(header?)`          | Its first line alone, for a system prompt's leading rules.              |
| `ANSWER_FORMAT_HEADER`                   | `'# Answer formatting'`.                                                |
| `ANSWER_FORM_EXAMPLES`                   | The examples, as arrays of lines.                                       |
| `CALLOUT_KINDS`, `DIAGRAM_KINDS`         | The callout kinds and the Mermaid diagram kinds, for a prompt of your own. |
| `DIAGRAM_FENCE_LANGUAGE`, `TREE_FENCE_LANGUAGE` | `'mermaid'` and `'tree'`.                                         |
| `AnswerFormatOptions`                    | The options' type.                                                      |

## `llx-markdown/html`

| Export               | What it is                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `html` (and default) | The raw HTML stage: `{ rehypePlugins: [rehypeRaw] }`. The sanitizer is added by the pipeline. |

The HTML parser is about a third of the renderer's weight, which is why it is its own entry and
loaded only when a document holds HTML.

## `llx-markdown/math`

| Export                          | What it is                                                         |
| ------------------------------- | ------------------------------------------------------------------ |
| `math` (and default)            | The math stage: remark-math and a KaTeX typesetter that caches each expression. |
| `typesetMath(source, display)`  | The typeset hast nodes for one expression.                         |
| `MathPlugin`                    | The stage's type.                                                  |

Import `katex/dist/katex.min.css` on the page.

## `llx-markdown/highlight`

| Export                            | What it is                                                                 |
| --------------------------------- | -------------------------------------------------------------------------- |
| `highlight` (and default)         | A `Highlighter` on highlight.js: HTML, or `null` for a language it does not know. |
| `highlightCode(code, language?)`  | The same, returning escaped plain text instead of `null`.                  |

Languages: Bash, CSS, JavaScript, JSON, Markdown, SQL, TypeScript, HTML/XML and YAML; see
[Highlighting](highlighting.md#languages).

## `llx-markdown/mermaid`

For a page that draws ` ```mermaid ` fences itself, with `components.diagram`. See
[Diagrams](diagrams.md#your-own-diagram).

| Export                         | What it is                                                                  |
| ------------------------------ | --------------------------------------------------------------------------- |
| `mermaidRendererFor(load)`     | The page's one renderer: `peek(source, look)` for an SVG already drawn, `render(source, look, signal?)` to draw one. The same queue and cache `<Markdown mermaid>` uses. |
| `resolveMermaidLook(element)`  | The Mermaid configuration from the `--llx-*` tokens around `element`.        |
| `MermaidEngine`, `MermaidLoader`, `MermaidRenderer`, `MermaidLook` | Their types.            |
