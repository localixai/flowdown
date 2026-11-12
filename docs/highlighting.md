---
title: Highlighting
description:
  Colour fenced code with the bundled highlight.js setup or a highlighter of your own, styled by the
  `--fd-code-*` tokens.
---

# Highlighting

Highlighting is off by default: fenced code is printed as plain text, with its language and a copy
button above it. Pass a highlighter to colour it:

```tsx
import { Markdown } from '@localix-ai/flowdown'
import { highlight } from '@localix-ai/flowdown/highlight'

;<Markdown highlight={highlight}>{text}</Markdown>
```

`@localix-ai/flowdown/highlight` is built on highlight.js, an optional peer dependency: install
`highlight.js` (version 11) to use it. A page that highlights some other way, or not at all, bundles
none of it.

## Languages

The bundled highlighter knows the languages replies and READMEs mostly contain:

| Language | Fence names |
| --- | --- |
| Bash | `bash`, `sh`, `shell`, `zsh` |
| C | `c`, `h` |
| C++ | `cpp`, `c++`, `hpp` |
| C# | `csharp`, `cs`, `c#` |
| CSS | `css` |
| Diff | `diff`, `patch` |
| Dockerfile | `dockerfile`, `docker` |
| Go | `go`, `golang` |
| HTML, XML | `xml`, `html`, `svg` |
| Java | `java` |
| JavaScript | `javascript`, `js`, `jsx`, `mjs`, `cjs` |
| JSON | `json` |
| Kotlin | `kotlin`, `kt` |
| Markdown | `markdown`, `md` |
| PHP | `php` |
| Python | `python`, `py` |
| Ruby | `ruby`, `rb` |
| Rust | `rust`, `rs` |
| SQL | `sql` |
| Swift | `swift` |
| TOML, INI | `toml`, `ini` |
| TypeScript | `typescript`, `ts`, `tsx` |
| YAML | `yaml`, `yml` |

In a shell fence the highlighter colours what a reader looks for in an install line: the command
(the first word of each command, after a `$ ` prompt, a `|`, `&&` or `;`), its flags, numbers,
strings, variables and comments. `bun add @localix-ai/flowdown --dev` shows `bun` and `--dev`; the `test` of
`bun test` is an argument and stays plain.

Only the language the fence names is highlighted. A fence without a language, or with one the
highlighter does not know, is printed as plain text: guessing the language mislabels as often as
it helps, and costs time on every update while a reply streams.

## Colours

The bundled highlighter emits highlight.js classes (`hljs-keyword`, `hljs-string`, …), and
`@localix-ai/flowdown/styles.css` colours them from tokens, so code follows your theme and its dark mode:

| Token                | Colours                                    |
| -------------------- | ------------------------------------------ |
| `--fd-code-bg`      | The block's background.                    |
| `--fd-code-fg`      | Plain code.                                |
| `--fd-code-comment` | Comments and quotes, in italics.           |
| `--fd-code-keyword` | Keywords.                                  |
| `--fd-code-string`  | Strings and regular expressions.           |
| `--fd-code-number`  | Numbers, literals, variables, attributes.  |
| `--fd-code-function`| Function and section titles.               |
| `--fd-code-type`    | Types, built-ins, class names, parameters. |
| `--fd-code-tag`     | Tags and selectors.                        |

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
import type { Highlighter } from '@localix-ai/flowdown'

export const highlightAll: Highlighter = (code, language) =>
  hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : null
```

The highlighter is synchronous, because it runs while React renders. A highlighter that loads its
grammars asynchronously (Shiki, for instance) must have them loaded before it is passed, and
returns `null` for a language that is not loaded yet.

Highlighted code gets the class `fd-highlighted` beside its `language-*` class.

## While a reply streams

The fence being written is highlighted in pieces of 40 lines, and only its last piece again on each
update, so its colours appear as it grows. A construct that spans two pieces (a block comment, a
template string) can be coloured wrongly until the fence closes; then the block is highlighted
whole. Blocks above it are not highlighted again. A page that draws code itself (`components.pre`
or `components.code`) receives the growing fence whole, as before. Keep the highlighter's reference stable (a module-level
function, as above): a new function on every render makes every code block highlight again.

## In a terminal

`@localix-ai/flowdown/tui` takes the same function: `renderToAnsi(reply, { highlight })`, or
`createTerminalView({ highlight })` for a reply that streams. It reads the kind of each token from
highlight.js's class names and draws it in one of the terminal theme's colours; the `--fd-code-*`
tokens are a page's and do not apply. A highlighter that names its colours another way (Shiki's
inline styles) leaves code in its one colour. The tokens are drawn only when together they are the
code that was given, so a highlighter can change a row's colours and never its text.

A view streams code as a page does: the fence being written is highlighted in pieces of 40 lines,
only the last of them again on each token, and whole once it closes. A fence that is finished is
highlighted once, however long the reply goes on.

While a reply streams, the fence being written is highlighted whole on each update.

## Without the renderer

`highlightCode(code, language)` from `@localix-ai/flowdown/highlight` is the same highlighter for code
outside a reply. It returns escaped plain text, rather than `null`, for a language it does not know.
