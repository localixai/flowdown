/** A display formula set on rows: what each construct is drawn as, and what holds for any text. */
import { describe, expect, test } from 'bun:test'
import { seeded } from '../../test/random'
import { formulaRows } from './formula'
import { renderToAnsi } from './index'
import { width } from './width'

const set = (source: string, columns = 80) => formulaRows(source, columns)?.join('\n') ?? null

describe('set on rows', () => {
  test('a fraction stands over its rule, its scripts small where Unicode has them', () => {
    expect(set(String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`)).toBe(
      ['          ________', '    -b ± √b² - 4ac', 'x = ──────────────', '          2a'].join('\n'),
    )
  })

  test('a sum has its limits above and below, an integral its scripts beside', () => {
    expect(set(String.raw`\bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i`)).toBe(
      ['    1  k', 'r̄ = ─  ∑  rᵢ', '    k i=1'].join('\n'),
    )
    expect(set(String.raw`\int_0^1 x^2 \, dx = \frac{1}{3}`)).toBe(
      ['            1', '∫₀¹ x² dx = ─', '            3'].join('\n'),
    )
    expect(set(String.raw`\lim_{x \to 0} \frac{\sin x}{x} = 1`)).toBe(
      ['      sin x', ' lim  ───── = 1', 'x → 0   x'].join('\n'),
    )
  })

  test('brackets grow with what they hold, and a script stands at their top', () => {
    expect(set(String.raw`\left( \frac{a}{b} \right)^2 = \frac{a^2}{b^2}`)).toBe(
      ['⎛a⎞²   a²', '⎜─⎟  = ──', '⎝b⎠    b²'].join('\n'),
    )
    // Without `\left` and `\right` too: a terminal has no other way to say what they enclose.
    expect(set(String.raw`(1 + \frac{1}{n})^n`)).toBe(['⎛    1⎞ⁿ', '⎜1 + ─⎟', '⎝    n⎠'].join('\n'))
  })

  test('matrices, cases and alignments', () => {
    expect(set(String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`)).toBe('⎛a  b⎞\n⎝c  d⎠')
    expect(set(String.raw`\begin{vmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{vmatrix}`)).toBe(
      ['│1  0  0│', '│0  1  0│', '│0  0  1│'].join('\n'),
    )
    expect(
      set(String.raw`|x| = \begin{cases} x & x \ge 0 \\ -x & x < 0 \\ 0 & \text{else} \end{cases}`),
    ).toBe(['      ⎧x   x ≥ 0', '|x| = ⎨-x  x < 0', '      ⎩0   else'].join('\n'))
    expect(set(String.raw`\begin{aligned} a &= b + c \\ &= d \end{aligned}`)).toBe(
      'a = b + c\n  = d',
    )
  })

  test('a root over something tall runs down its side', () => {
    expect(set(String.raw`\sqrt{\frac{x}{y}}`)).toBe([' ┌──', ' │ x', '√│ ─', ' │ y'].join('\n'))
    expect(set(String.raw`\sqrt[3]{\frac{1}{2}}`)).toBe(
      ['  ┌──', '  │ 1', '³√│ ─', '  │ 2'].join('\n'),
    )
  })

  test('a script with no small letters is set above or below its letter', () => {
    expect(set(String.raw`e^{i\pi} + 1 = 0`)).toBe([' iπ', 'e   + 1 = 0'].join('\n'))
  })
})

describe('written on one row instead', () => {
  test('a formula with nothing to set on rows', () => {
    expect(set(String.raw`x^2 + y^2 = z^2`)).toBeNull()
    expect(set('E = mc^2')).toBeNull()
    expect(set('a + b')).toBeNull()
  })

  test('a formula wider than the room', () => {
    const wide = String.raw`\frac{1}{2} + \frac{1}{3} + \frac{1}{4} + \frac{1}{5} + \frac{1}{6}`
    expect(set(wide, 80)).not.toBeNull()
    expect(set(wide, 12)).toBeNull()
    // And so the terminal still shows it, wrapped.
    expect(renderToAnsi(`$$${wide}$$`, { width: 16, color: false })).toContain('1/2 + 1/3')
  })

  test('inside a sentence, a formula stays on the sentence’s row', () => {
    expect(renderToAnsi(String.raw`It is $\frac{a}{b}$ here.`, { color: false })).toBe(
      'It is a/b here.',
    )
  })
})

describe('any text', () => {
  const PIECES =
    String.raw`\frac{ \sqrt[ \sum_ ^ _ { } { } ( ) [ ] \left( \right) \left. \right| \begin{pmatrix} \end{pmatrix} \begin{cases} \end{cases} \begin{aligned} & \\ x y 1 2 + = \alpha \text{a} \binom \lim \int \mathbb{R} \unknown{x} \\ } { $ % ~ é 漢`.split(
      ' ',
    )

  test('never throws, keeps to the width, and reads the same twice', () => {
    const r = seeded(7)
    for (let n = 0; n < 4000; n++) {
      const source = Array.from({ length: r.int(1, 30) }, () => r.pick(PIECES)).join(
        r.next() < 0.5 ? ' ' : '',
      )
      const columns = r.pick([80, 40, 20, 8])
      const rows = formulaRows(source, columns)
      expect(formulaRows(source, columns)).toEqual(rows)
      for (const row of rows ?? []) {
        expect(width(row)).toBeLessThanOrEqual(columns)
        expect(row).toBe(row.trimEnd())
        // No control character, and no space of the layout's own left in the text.
        expect([...row].some((char) => char < ' ' || char === '\u007f' || char === '\u00a0')).toBe(
          false,
        )
      }
    }
  })

  test('a deep or long formula is read in the time its length takes', () => {
    const deep = `${String.raw`\frac{`.repeat(2000)}x${'}{y}'.repeat(2000)}`
    const long = String.raw`\frac{a}{b} + `.repeat(2000)
    const start = performance.now()
    formulaRows(deep, 80)
    formulaRows(long, 80)
    expect(performance.now() - start).toBeLessThan(500)
  })
})
