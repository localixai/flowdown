---
title: Math
description:
  Typeset `$…$` and `$$…$$` with KaTeX, loaded only when a reply holds a formula, and leave the
  dollar signs that are prices or shell variables alone.
---

# Math

Math is off by default: `$…$` stays text and KaTeX is not in the page. Pass the math stage to turn it
on:

```tsx
import { Markdown } from 'llx-markdown'
import 'katex/dist/katex.min.css'

const loadMath = () => import('llx-markdown/math')

export function Reply({ text }: { text: string }) {
  return <Markdown math={loadMath}>{text}</Markdown>
}
```

Install `katex` (version 0.16 or later). It is an optional peer dependency, so a page without math
does not install it. KaTeX's stylesheet holds its fonts and layout, and it is yours to import: without
it a formula renders as stacked, unstyled text.

## A loader or the stage itself

| `math`                              | What happens                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `null` (the default)                | `$…$` is text.                                                                                                                 |
| `() => import('llx-markdown/math')` | KaTeX is fetched the first time a document holds a formula. Until it arrives, the formula reads as its source.                |
| `math` from `llx-markdown/math`     | Typeset in the first render. Use this on a server, or on a prerendered page that hydrates, so both renders draw the same markup. |

The loader is called once per `<Markdown>`, when its document first needs math. If the load fails
(a chunk lost on a bad connection), it is tried again three times, a second and a half apart; the
document stays readable meanwhile, its formulas shown as source, and they are typeset the moment
the chunk arrives.

> [!TIP] Keep the loader stable
> Define the loader once, at module level, as above. Every `<Markdown>` that is handed the same
> function shares the loaded stage, so a thread of replies fetches KaTeX once. A new arrow function
> on every render works, but each document then waits for its own load.

## Writing formulas

Inline math sits between single dollars, `$e^{i\pi} + 1 = 0$`, and reads as $e^{i\pi} + 1 = 0$. A
display formula goes between `$$` lines:

```markdown
$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
```

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

A formula KaTeX cannot parse is not an error page: it shows its source in KaTeX's error style, and
the rest of the reply renders as usual.

## Dollar signs that are not math

remark-math pairs any two single dollars in a paragraph. On its own, "costs $5 and $10" would be
typeset as the formula `5 and`. With math on, llx-markdown first decides which dollars are dollar
signs and escapes them, so the parser sees `\$`:

| Written                     | Read as                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `$5`, `$1,200`, `$3.5k`, `$2M` | A price: digits, an optional `k`, `m` or `b`, then a space, punctuation or the end. |
| `$5–$10`                    | Two prices.                                                                            |
| `$HOME/bin`, `$PATH:`       | A shell variable: an upper-case name followed by `/ : . , ; ) ]`, a quote or the end.  |
| `$PATH before`              | A shell variable: an upper-case name of three or more characters before a space.       |
| `$AB = CD$`                 | Math: a name of two characters before a space does not count as a variable.            |
| `$x$`, `$\pi r^2$`          | Math.                                                                                  |
| `$$…$$`                     | Display math, always.                                                                  |
| `\$`                        | A dollar sign, always.                                                                 |

Code is left exactly as written: `` `$HOME` `` and fenced blocks are never escaped or typeset. When the
rules guess wrong for your text, escape the dollar yourself: `\$`.

These rules apply only while `math` is set. Without it, no `$` is touched.

## While a reply streams

Formulas are typeset as the reply arrives, not only when it is finished:

- A formula still being typed (`$\frac{a}{`) is held back from its opening `$` until the closing
  one arrives, so half a formula never flashes as raw TeX or as a KaTeX error.
- Each expression is typeset once. The result is cached by its source (up to 1,000 expressions), and
  the next update reuses the same nodes. A reply with thirty formulas pays KaTeX only for the one
  being written.

## Tell the model

Turn math on in the prompt and in the renderer together. A model that is told about math it cannot
see rendered writes `$` where it should not; a renderer that typesets math the model was not told
about receives none.

```ts
import { answerFormatPrompt } from 'llx-markdown/prompt'

const system = answerFormatPrompt({ math: true })
```

See [Prompting](prompting.md).

## Without React

`llx-markdown/math` exports the stage as a plain object, `{ remarkPlugins, rehypePlugins }`. Use it
in your own unified pipeline with `remarkPluginsFor({ math })` and `rehypePluginsFor({ math })` from
[`llx-markdown/remark`](remark.md). `typesetMath(source, displayMode)` returns the typeset hast nodes
for one expression, from the same cache.
