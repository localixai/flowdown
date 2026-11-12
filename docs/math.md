---
title: Math
description:
  Typeset `$…$`, `$$…$$` and math fences with KaTeX, loaded only when a reply holds a formula, and leave the
  dollar signs that are prices or shell variables alone.
---

# Math

Math is off by default: `$…$` stays text and KaTeX is not in the page. With it on, three ways of
writing a formula are typeset, the three GitHub reads: `$…$` in a line, `$$…$$` on lines of its own,
and a fence whose language is `math`. Pass the math stage to turn it
on:

```tsx
import { Markdown } from '@localix/flowdown'
import 'katex/dist/katex.min.css'

const loadMath = () => import('@localix/flowdown/math')

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
| `() => import('@localix/flowdown/math')` | KaTeX is fetched the first time a document holds a formula. Until it arrives, the formula reads as its source.                |
| `math` from `@localix/flowdown/math`     | Typeset in the first render. Use this on a server, or on a prerendered page that hydrates, so both renders draw the same markup. |

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

A single dollar is a math delimiter only by pandoc's rule, the one GitHub follows: the opening `$`
has something other than a space right after it, and the closing `$` has something other than a
space right before it and no digit right after. So a shell line in a reply,
`for i in $(seq 1 12); do printf "line %s" $i; done`, stays text: the `$` before `i` has a space
before it and closes nothing.

That rule alone still reads "costs $5 and x$" as a formula. So flowdown also decides which
dollars are dollar signs by their look, and escapes them before the parser sees them:

| Written                        | Read as                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `$5`, `$1,200`, `$3.5k`, `$2M` | A price: digits, an optional `k`, `m` or `b`, then a space, punctuation or the end.   |
| `$5–$10`, `costs $5 and $10`   | Prices.                                                                               |
| `$HOME/bin`, `$PATH:`          | A shell variable: an upper-case name followed by `/ : . , ; ) ]`, a quote or the end. |
| `$PATH before`                 | A shell variable: an upper-case name of three or more characters before a space.      |
| `$AB = CD$`                    | Math: a name of two characters before a space does not count as a variable.           |
| `$ x $`, `$x $`                | Text: a space after the opening or before the closing dollar.                         |
| `$a$5`                         | Text: a digit right after the closing dollar.                                         |
| `$x$`, `$\pi r^2$`, `a $b$, c` | Math.                                                                                 |
| `$$…$$`                        | Display math, always.                                                                 |
| `\$`                           | A dollar sign, always. Inside a formula, `$a + \$b$`, it closes nothing.              |

A formula does not reach across a blank line. Code is left exactly as written: `` `$HOME` `` and
fenced blocks are never escaped or typeset. When the rules guess wrong for your text, escape the
dollar yourself: `\$`.

These rules apply only while `math` is set. Without it, no `$` is touched.

## While a reply streams

Formulas are typeset as the reply arrives, not only when it is finished:

- A formula still being typed (`$\frac{a}{`) is held back from its opening `$` until the closing
  one arrives, so half a formula never flashes as raw TeX or as a KaTeX error. The same rule
  decides: a `$` that cannot open (`5$ and`, `$ x`) hides nothing, and once a `$` arrives that
  does not close the open one (`$(seq 1 12) … $i`), the line shows as the text it is.
- Each expression is typeset once. The result is cached by its source (up to 1,000 expressions), and
  the next update reuses the same nodes. A reply with thirty formulas pays KaTeX only for the one
  being written.

## Tell the model

Turn math on in the prompt and in the renderer together. A model that is told about math it cannot
see rendered writes `$` where it should not; a renderer that typesets math the model was not told
about receives none.

```ts
import { answerFormatPrompt } from '@localix/flowdown/prompt'

const system = answerFormatPrompt({ math: true })
```

See [Prompting](prompting.md).

## In a terminal

`@localix/flowdown/tui` reads the same three ways to write a formula and needs no KaTeX: it writes the
formula in Unicode, `x^2` as `x²` and `\frac{a}{b}` as `a/b`. It is on by default there
(`renderToAnsi(reply, { math: false })` turns it off). See
[targets](targets.md#a-terminal).

## Without React

`@localix/flowdown/math` is an [extension](remark.md#your-own-syntax-in-markdown) of `<Markdown>`'s own
parser, not a unified plugin. In a unified pipeline of your own use `remark-math` and `rehype-katex`
with [`remarkFlowdown`](remark.md). `typesetMath(source, display)` typesets one expression with KaTeX,
from the same cache `<Markdown>` uses.
