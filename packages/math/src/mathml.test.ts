import { describe, expect, test } from 'bun:test'
import { CORPUS } from '../scripts/corpus'
import { toMathML } from './index'

/** The elements of `markup`, checked to nest: each closes in the order it opened. */
function balanced(markup: string): boolean {
  const open: string[] = []
  for (const [, slash, name, self] of markup.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
    if (self) continue
    if (slash) {
      if (open.pop() !== name) return false
    } else open.push(name!)
  }
  return open.length === 0
}

const inner = (tex: string, display = false) => {
  const markup = toMathML(tex, { display })
  return markup.slice(markup.indexOf('<semantics>') + 11, markup.indexOf('<annotation'))
}

describe('toMathML', () => {
  test('wraps a formula in <math>, the TeX kept as its annotation', () => {
    expect(toMathML('x^2')).toBe(
      '<math><semantics><msup><mi>x</mi><mn>2</mn></msup><annotation encoding="application/x-tex">x^2</annotation></semantics></math>',
    )
    expect(toMathML('x', { display: true })).toStartWith('<math display="block">')
  })

  test('writes fractions, roots and scripts as MathML Core has them', () => {
    expect(inner('\\frac{a}{b}')).toBe('<mfrac><mi>a</mi><mi>b</mi></mfrac>')
    expect(inner('\\dfrac12')).toBe('<mfrac displaystyle="true"><mn>1</mn><mn>2</mn></mfrac>')
    expect(inner('\\sqrt[3]{x}')).toBe('<mroot><mi>x</mi><mn>3</mn></mroot>')
    expect(inner('\\sqrt x')).toBe('<msqrt><mi>x</mi></msqrt>')
    expect(inner('a_i^2')).toBe('<msubsup><mi>a</mi><mi>i</mi><mn>2</mn></msubsup>')
    expect(inner('\\binom nk')).toContain('<mfrac linethickness="0">')
  })

  test('sets a sum’s limits above and below, an integral’s beside it', () => {
    expect(inner('\\sum_{i=1}^n')).toStartWith('<munderover><mo>∑</mo>')
    expect(inner('\\int_0^1')).toStartWith('<msubsup><mo>∫</mo>')
    expect(inner('\\int\\limits_0^1')).toStartWith('<munderover><mo movablelimits="false">∫</mo>')
    expect(inner('\\sum\\nolimits_i')).toStartWith('<msub><mo>∑</mo>')
    expect(inner('\\lim_{x\\to0}')).toContain('<munder><mo movablelimits="true" form="prefix"')
  })

  test('gives a function its space, and none before a bracket', () => {
    expect(inner('\\sin x')).toBe(
      '<mrow><mi>sin</mi><mo lspace="0" rspace="0.1667em">\u2061</mo><mi>x</mi></mrow>',
    )
    expect(inner('\\sin(x)')).toContain('rspace="0">\u2061</mo><mo stretchy="false">(</mo>')
    expect(inner('\\sin^2 x')).toStartWith(
      '<mrow><msup><mi>sin</mi><mn>2</mn></msup><mo lspace="0" rspace="0.1667em">',
    )
  })

  test('keeps a bracket its size unless \\left grows it', () => {
    expect(inner('(x)')).toBe(
      '<mrow><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo></mrow>',
    )
    expect(inner('\\left( x \\right)')).toBe(
      '<mrow><mo fence="true" form="prefix" stretchy="true" symmetric="true">(</mo><mi>x</mi><mo fence="true" form="postfix" stretchy="true" symmetric="true">)</mo></mrow>',
    )
    expect(inner('\\left. x \\right|')).toStartWith('<mrow><mi>x</mi>')
    expect(inner('\\big(')).toContain('minsize="1.2em" maxsize="1.2em"')
  })

  test('writes a typeface as Unicode’s math letters', () => {
    expect(inner('\\mathbb{R}')).toBe('<mi>ℝ</mi>')
    expect(inner('\\mathbf{x}')).toBe('<mi>𝐱</mi>')
    expect(inner('\\mathcal{L}')).toBe('<mi>ℒ</mi>')
    expect(inner('\\mathrm{d}')).toBe('<mi mathvariant="normal">d</mi>')
    expect(inner('\\Gamma')).toBe('<mi mathvariant="normal">Γ</mi>')
  })

  test('puts accents over their letters, and primes beside', () => {
    // A spacing accent with no room of its own sits over its letter in every engine; a wide one is
    // the combining mark the font grows.
    expect(inner('\\hat x')).toBe(
      '<mover accent="true"><mi>x</mi><mo stretchy="false" lspace="0" rspace="0">ˆ</mo></mover>',
    )
    expect(inner('\\widehat{AB}')).toContain(
      '<mo stretchy="true" lspace="0" rspace="0">\u0302</mo>',
    )
    expect(inner('\\vec v')).toContain(
      '<mo stretchy="false" lspace="0" rspace="0" scriptlevel="1">→</mo>',
    )
    expect(inner('\\|v\\|')).toContain('<mo stretchy="false" lspace="0" rspace="0">‖</mo>')
    expect(inner("f'")).toBe('<mrow><mi>f</mi><mo lspace="0" rspace="0">′</mo></mrow>')
    // A brace or a rule is a border of the expression's box, its label under it.
    expect(inner('\\underbrace{a+b}_{n}')).toBe(
      '<munder><mrow class="ml-underbrace"><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>n</mi></munder>',
    )
    expect(inner('\\overline{z}')).toBe('<mrow class="ml-overline"><mi>z</mi></mrow>')
  })

  test('draws matrices, cases and aligned equations as tables', () => {
    const matrix = inner('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')
    expect(matrix).toContain(
      '<mtable class="ml-matrix"><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr>',
    )
    expect(matrix).toStartWith(
      '<mrow><mo fence="true" form="prefix" stretchy="true" symmetric="true">(</mo>',
    )
    const cases = inner('\\begin{cases} 1 & x>0 \\\\ 0 & \\text{else} \\end{cases}')
    expect(cases).toContain('<mtable class="ml-cases">')
    expect(cases).toContain('<mtd style="text-align:left">')
    const aligned = inner('\\begin{aligned} a &= b \\\\ &= c \\end{aligned}')
    expect(aligned).toContain('<mtd style="text-align:right" displaystyle="true">')
    expect(aligned).toContain('<mi></mi><mo>=</mo>')
    // A trailing \\ draws no empty row.
    expect(inner('\\begin{matrix} a \\\\ \\end{matrix}').match(/<mtr>/g)).toHaveLength(1)
  })

  test('escapes what it writes, and drops a colour that is not one', () => {
    expect(inner('\\text{<b>&</b>}')).toBe('<mtext>&lt;b&gt;&amp;&lt;/b&gt;</mtext>')
    expect(toMathML('a<b')).toContain('<mo>&lt;</mo>')
    expect(inner('\\color{red}{x}')).toContain('style="color:red"')
    expect(inner('\\color{url(javascript:alert(1))}{x}')).not.toContain('style')
    expect(toMathML('"><script>')).not.toContain('<script')
  })

  test('shows a command it does not know as written', () => {
    expect(inner('\\foo x')).toBe('<mrow><merror><mtext>\\foo</mtext></merror><mi>x</mi></mrow>')
  })

  test('reads every prefix of every formula into MathML that nests', () => {
    for (const [, tex, display] of CORPUS) {
      for (let at = 0; at <= tex.length; at++) {
        const markup = toMathML(tex.slice(0, at), { display })
        if (!balanced(markup)) throw new Error(`unbalanced at ${at} of ${tex}: ${markup}`)
      }
    }
  })

  test('reads any text, and deep or long text within its bounds', () => {
    // A seeded walk over the characters TeX gives meaning to.
    let seed = 7
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31)
    const alphabet = [
      '\\frac',
      '\\sqrt',
      '{',
      '}',
      '^',
      '_',
      '&',
      '\\\\',
      '\\left(',
      '\\right)',
      '\\begin{matrix}',
      '\\end{matrix}',
      'x',
      '1',
      '+',
      '\\',
      '[',
      ']',
      '$',
      "'",
      '\\text{',
      '\\mathbb',
    ]
    for (let round = 0; round < 500; round++) {
      let tex = ''
      for (let length = next() % 40; length > 0; length--) tex += alphabet[next() % alphabet.length]
      expect(balanced(toMathML(tex))).toBe(true)
    }
    expect(balanced(toMathML('{'.repeat(10_000)))).toBe(true)
    expect(balanced(toMathML('\\frac{'.repeat(5_000)))).toBe(true)
    expect(balanced(toMathML('x^'.repeat(5_000)))).toBe(true)
    const long = 'x + '.repeat(50_000)
    expect(toMathML(long).length).toBeLessThan(400_000)
  })
})
