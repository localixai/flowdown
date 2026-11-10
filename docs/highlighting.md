---
title: Highlighting
description:
  Colour fenced code with the bundled highlight.js setup or a highlighter of your own, styled by the
  `--llx-code-*` tokens.
---

# Highlighting

Highlighting is off by default: fenced code is printed as plain text, with its language and a copy
button above it. Pass a highlighter to colour it:

```tsx
import { Markdown } from 'llx-markdown'
import { highlight } from 'llx-markdown/highlight'

;<Markdown highlight={highlight}>{text}</Markdown>
```

`llx-markdown/highlight` is built on highlight.js, an optional peer dependency: install
`highlight.js` (version 11) to use it. A page that highlights some other way, or not at all, bundles
none of it.

## Languages

The bundled highlighter knows the languages replies and READMEs mostly contain:

| Language   | Fence names                    |
| ---------- | ------------------------------ |
| Bash       | `bash`, `sh`, `shell`, `zsh`   |
| CSS        | `css`                          |
| Diff       | `diff`, `patch`                |
| JavaScript | `javascript`, `js`, `jsx`      |
| JSON       | `json`                         |
| Markdown   | `markdown`, `md`               |
| SQL        | `sql`                          |
| TypeScript | `typescript`, `ts`, `tsx`      |
| HTML, XML  | `xml`, `html`                  |
| YAML       | `yaml`, `yml`                  |

In a shell fence the highlighter colours what a reader looks for in an install line: the command
(the first word of each command, after a `$ ` prompt, a `|`, `&&` or `;`), its flags, numbers,
strings, variables and comments. `bun add llx-markdown --dev` shows `bun` and `--dev`; the `test` of
`bun test` is an argument and stays plain.

Only the language the fence names is highlighted. A fence without a language, or with one the
highlighter does not know, is printed as plain text: guessing the language mislabels as often as
it helps, and costs time on every update while a reply streams.

## Colours

The bundled highlighter emits highlight.js classes (`hljs-keyword`, `hljs-string`, …), and
`llx-markdown/styles.css` colours them from tokens, so code follows your theme and its dark mode:

| Token                | Colours                                    |
| -------------------- | ------------------------------------------ |
| `--llx-code-bg`      | The block's background.                    |
| `--llx-code-fg`      | Plain code.                                |
| `--llx-code-comment` | Comments and quotes, in italics.           |
| `--llx-code-keyword` | Keywords.                                  |
| `--llx-code-string`  | Strings and regular expressions.           |
| `--llx-code-number`  | Numbers, literals, variables, attributes.  |
| `--llx-code-function`| Function and section titles.               |
| `--llx-code-type`    | Types, built-ins, class names, parameters. |
| `--llx-code-tag`     | Tags and selectors.                        |

Set them like any other token; see [Styling](styling.md). A highlight.js theme stylesheet works too,
but the tokens are the way that follows the page's light and dark scheme.

## Your own highlighter

A highlighter is a function:

```ts
type Highlighter = (code: string, language: string) => string | null
```

It is called for a fenced block whose fence names a language, with the code and that language. It
returns HTML for the inside of the `<code>` element, or `null` to leave the code as plain text.

> [!WARNING] Escape the code
> The returned HTML is inserted as it is. A highlighter must escape the code it is given (`<`, `>`,
> `&`, quotes), or a reply that contains `<img onerror=…>` in a code block runs it. highlight.js
> escapes its output; check the one you use.

highlight.js with every language, for example:

```ts
import hljs from 'highlight.js'
import type { Highlighter } from 'llx-markdown'

export const highlightAll: Highlighter = (code, language) =>
  hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : null
```

The highlighter is synchronous, because it runs while React renders. A highlighter that loads its
grammars asynchronously (Shiki, for instance) must have them loaded before it is passed, and
returns `null` for a language that is not loaded yet.

Highlighted code gets the class `llx-highlighted` beside its `language-*` class.

## While a reply streams

The fence being written is highlighted in pieces of 40 lines, and only its last piece again on each
update, so its colours appear as it grows. A construct that spans two pieces (a block comment, a
template string) can be coloured wrongly until the fence closes; then the block is highlighted
whole. Blocks above it are not highlighted again. A page that draws code itself (`components.pre`
or `components.code`) receives the growing fence whole, as before. Keep the highlighter's reference stable (a module-level
function, as above): a new function on every render makes every code block highlight again.

## Without the renderer

`highlightCode(code, language)` from `llx-markdown/highlight` is the same highlighter for code
outside a reply. It returns escaped plain text, rather than `null`, for a language it does not know.
