# @localix-ai/math

TeX formulas as agents write them, for a page and for a terminal. One parser reads the TeX, two
outputs are written from it: **MathML** that every browser lays out itself, with a small math font
of its own, and **rows of a terminal**, fractions over their rule. Any prefix of a stream draws. No
dependencies.

```sh
npm install @localix-ai/math
```

```ts
import { toMathML, toRows, toText } from '@localix-ai/math'
import '@localix-ai/math/styles.css'

element.innerHTML = toMathML('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', { display: true })

toText('x^2 + y_i \\in \\mathbb{R}') // 'x² + yᵢ ∈ ℝ'
toRows('\\sum_{i=1}^{n} i')
// [' n',
//  ' ∑  i',
//  'i=1']
```

## Why

- **The browser lays it out.** MathML Core is in every engine (WebKit, Chromium, Firefox): no script
  places a glyph, a screen reader reads a formula as math, and the TeX rides along as an annotation,
  so a copy gives the source back.
- **Fast and small.** On the formulas agents write, about 30 µs a formula: nine times faster than
  KaTeX, with almost eight times less markup. The code is 13.8 KB gzipped (KaTeX: 75 KB). Figures
  from `bun run bench`, in `bench/results/latest.json`.
- **Made for streams.** It reads any text and never throws: `\frac{a}{` is a fraction with an empty
  slot, an unknown command is shown as written. Every construct read has a bound.
- **Looks the same everywhere.** `styles.css` brings STIX Two Math cut to what replies use (80 KB,
  and 37.5 KB of letters fetched only when a formula uses `\mathbb`, `\mathcal`, `\mathbf`). An
  engine's own math font may not grow a bracket (Chromium on Windows); this one does.
- **One reading, two screens.** A terminal gets the same formula from the same parser: Unicode on
  one line (`toText`), or rows (`toRows`) with fractions, limits, roots, tall brackets, matrices,
  and a brace under what it counts with its label.

## What it reads

Greek and the symbols (some 500), `\frac` `\dfrac` `\binom` `\sqrt[n]`, scripts and limits
(`\limits`, `\nolimits`), `\left … \middle … \right` and `\big`, accents (`\hat`, `\vec`,
`\widehat`, `\overline`, `\underbrace{…}_{…}`), `\overset` `\underset` `\stackrel`, `\xrightarrow`,
functions (`\sin`, `\lim`, `\operatorname`), typefaces (`\mathbf` `\mathbb` `\mathcal` `\mathfrak`
`\mathsf` `\mathtt` `\boldsymbol`), `\text`, `\color` (a name or a hex colour), `\boxed`,
`\phantom`, spaces, `\not`, `\pmod`, `\tag`, and the environments `matrix` `pmatrix` `bmatrix`
`Bmatrix` `vmatrix` `Vmatrix` `smallmatrix` `cases` `dcases` `rcases` `aligned` `align` `split`
`gather` `array` `subarray` `\substack`.

## Development

```sh
bun test            # the tests, in a random order
bun run typecheck
bun run size        # against budgets.json
bun run bench       # against KaTeX and Temml, held to budgets.json
bun run shots       # the corpus beside KaTeX, screenshotted (CI: every engine, three systems)
bun run font        # fonts/math.woff2 from STIX Two Math (needs Python's fontTools)
```

The math font is STIX Two Math, under the SIL Open Font License (`fonts/OFL.txt`).
