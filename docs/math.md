---
title: Math
description:
  Draw `$…$`, `$$…$$` and math fences as MathML the browser lays out itself, with no dependency and a
  font of its own, and leave the dollar signs that are prices or shell variables alone.
---

# Math

Math is off by default: `$…$` stays text and no math code is in the page. With it on, three ways of
writing a formula are drawn, the three GitHub reads: `$…$` in a line, `$$…$$` on lines of its own,
and a fence whose language is `math`. Pass the math stage to turn it on, and import the math font:

```tsx
import { Markdown } from '@localix-ai/flowdown'
import '@localix-ai/flowdown/math.css'

const loadMath = () => import('@localix-ai/flowdown/math')

export function Reply({ text }: { text: string }) {
  return <Markdown math={loadMath}>{text}</Markdown>
}
```

Nothing to install: formulas are written by [`@localix-ai/math`](#the-package-underneath), built
into flowdown (11 KB, no dependency). It writes MathML, which every browser lays out itself, so no
script places a glyph and a screen reader reads a formula as math. `math.css` holds the math font,
STIX Two Math cut to what replies use (80 KB, and 37.5 KB of letters fetched only when a formula
uses `\mathbb`, `\mathcal` or `\mathbf`). With it a formula looks the same in WebKit, Chromium and
Firefox; without it each engine uses its own math font, and Chromium on Windows cannot grow a
bracket.

## A loader or the stage itself

| `math`                              | What happens                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `null` (the default)                | `$…$` is text.                                                                                                                 |
| `() => import('@localix-ai/flowdown/math')` | The math code is fetched the first time a document holds a formula. Until it arrives, the formula reads as its source.     |
| `math` from `@localix-ai/flowdown/math`     | Typeset in the first render. Use this on a server, or on a prerendered page that hydrates, so both renders draw the same markup. |

The loader is called once per `<Markdown>`, when its document first needs math. If the load fails
(a chunk lost on a bad connection), it is tried again three times, a second and a half apart; the
document stays readable meanwhile, its formulas shown as source, and they are typeset the moment
the chunk arrives.

> [!TIP] Keep the loader stable
> Define the loader once, at module level, as above. Every `<Markdown>` that is handed the same
> function shares the loaded stage, so a thread of replies fetches it once. A new arrow function
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

A formula is never an error page. One cut off mid-stream draws as far as it goes, its open groups
closed (`\frac{a}{` is a fraction with an empty slot); a command the parser does not know is shown
as written, in red; the rest of the reply renders as usual. Copying a formula gives back its TeX:
it rides along in the MathML as an annotation.

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
| `$2 + 2 = 4$`, `$3 \cdot 4$`   | Math: a price-looking dollar opens a formula that closes with no other `$` inside and holds `= ^ _ \ { } < >`. |
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
  one arrives, so half a formula never flashes as raw TeX. The same rule
  decides: a `$` that cannot open (`5$ and`, `$ x`) hides nothing, and once a `$` arrives that
  does not close the open one (`$(seq 1 12) … $i`), the line shows as the text it is.
- Each expression is written once. The result is cached by its source (up to 1,000 expressions), and
  the next update reuses the same nodes. A reply with thirty formulas pays only for the one being
  written, and that one costs about 30 µs, nine times less than KaTeX (`packages/math/bench`).

## Tell the model

Turn math on in the prompt and in the renderer together. A model that is told about math it cannot
see rendered writes `$` where it should not; a renderer that typesets math the model was not told
about receives none.

```ts
import { answerFormatPrompt } from '@localix-ai/flowdown/prompt'

const system = answerFormatPrompt({ math: true })
```

See [Prompting](prompting.md).

## In a terminal

`@localix-ai/flowdown/tui` reads the same three ways to write a formula with the same parser a page
uses, and writes it in Unicode: `x^2` as `x²`, a display formula on rows of its own, its fractions
over their rule, a sum's limits above and below, a matrix in brackets as tall as its rows, a brace
under what it counts with its label under it. It is on by default there
(`renderToAnsi(reply, { math: false })` turns it off). See
[targets](targets.md#a-terminal).

## Without React

`@localix-ai/flowdown/math` is an [extension](remark.md#your-own-syntax-in-markdown) of `<Markdown>`'s own
parser, not a unified plugin. In a unified pipeline of your own use `remark-math` and `rehype-katex`
with [`remarkFlowdown`](remark.md). `typesetMath(source, display)` writes one expression as MathML,
from the same cache `<Markdown>` uses.

## The package underneath

Formulas are [`@localix-ai/math`](https://github.com/localixai/flowdown/tree/main/packages/math),
a package of its own with no dependency, for a page or a program that is not a Markdown renderer:

```ts
import { toMathML, toRows, toText } from '@localix-ai/math'
import '@localix-ai/math/styles.css'

toMathML('\\frac{a}{b}', { display: true }) // '<math display="block">…</math>'
toText('x^2 + y_i') // 'x² + yᵢ'
toRows('\\frac{a+b}{2}') // ['a + b', '─────', '  2']
```

On the formulas agents write it is nine times faster than KaTeX and writes almost eight times less markup;
its code is 13.5 KB gzipped against KaTeX's 75 KB (`bun run bench` in `packages/math`).
