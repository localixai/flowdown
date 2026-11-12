/**
 * Formulas in a terminal.
 *
 * 1. What a formula is written as: exact, for the LaTeX a reply holds.
 * 2. Where it is drawn: inside a sentence, on rows of its own, and not at all where a `$` is money.
 * 3. Any text is read: nothing throws, hangs or reaches the terminal as a control character.
 * 4. A formula still being typed is not shown as half of its LaTeX.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { seeded } from '../../test/random'
import { mathRows, mathText } from './math'
import {
  createTerminalView,
  lineText,
  renderToAnsi,
  renderToLines,
  textWidth,
  toAnsi,
  type Line,
} from './index'

const ESC = String.fromCharCode(0x1b)
const NO_BREAK = String.fromCharCode(0xa0)
const text = (markdown: string, width = 60): string =>
  renderToAnsi(markdown, { width, color: false })

describe('what a formula is written as', () => {
  const WRITTEN: Array<[string, string]> = [
    ['r = n / t', 'r = n / t'],
    [String.raw`\bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i`, 'r̄ = 1/k ∑ᵢ₌₁ᵏ rᵢ'],
    ['E = mc^2', 'E = mc²'],
    [String.raw`e^{i\pi} + 1 = 0`, 'e^(iπ) + 1 = 0'],
    [String.raw`\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}`, '∫₀^∞ e^(-x²) dx = √π/2'],
    [String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, 'x = (-b ± √(b² - 4ac))/2a'],
    [String.raw`\lim_{x \to 0} \frac{\sin x}{x} = 1`, 'lim_(x → 0) (sin x)/x = 1'],
    [String.raw`a_{ij} \in \mathbb{R}^{n \times m}`, 'aᵢⱼ ∈ ℝ^(n × m)'],
    [String.raw`\hat{y} = \vec{w} \cdot \vec{x} + b`, 'ŷ = w⃗ · x⃗ + b'],
    [String.raw`\sqrt[3]{x+1} \le \left( \alpha + \beta \right)`, '³√(x+1) ≤ (α + β)'],
    [String.raw`A^T A \ne I, \quad 90^\circ`, 'Aᵀ A ≠ I, 90°'],
    [String.raw`\frac{\partial f}{\partial x} \approx \nabla f`, '∂f/∂x ≈ ∇ f'],
    [String.raw`P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}`, 'P(A ∣ B) = (P(B ∣ A) P(A))/P(B)'],
    [
      String.raw`\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (x_i - \mu)^2}`,
      'σ = √(1/N ∑ᵢ₌₁ᴺ (xᵢ - μ)²)',
    ],
    [String.raw`O(n \log n), \; \binom{n}{k}, \; 10^{-3}`, 'O(n log n), C(n, k), 10⁻³'],
    [
      String.raw`x \not\in S \implies \forall y: y \geq 0`,
      `x ∈${String.fromCharCode(0x338)} S ⇒ ∀ y: y ≥ 0`,
    ],
    [String.raw`\left\{ x \mid x > 0 \right\} \cup [0, 1)`, '{ x ∣ x > 0 } ∪ [0, 1)'],
    [String.raw`\text{rate} = \mathrm{d}x / \mathrm{d}t \tag{1}`, 'rate = dx / dt (1)'],
    [String.raw`50\% \text{ of } \$10`, '50% of $10'],
    [String.raw`T_{eff} + x_{max}`, 'T_(eff) + xₘₐₓ'],
  ]

  test('the LaTeX a reply holds', () => {
    // Written composed (NFC), as a terminal's font has the letter: `ŷ` is one character.
    for (const [source, written] of WRITTEN)
      expect([source, mathText(source)]).toEqual([source, written.normalize('NFC')])
  })

  test('a formula that breaks its lines is one row for each', () => {
    expect(
      mathRows(String.raw`f(x) = \begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}`),
    ).toEqual(['f(x) = { 1, x > 0', '0, otherwise'])
    expect(mathRows(String.raw`\begin{aligned} a &= b + c \\ &= d \end{aligned}`)).toEqual([
      'a = b + c',
      '= d',
    ])
    expect(mathRows(String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`)).toEqual([
      'a b',
      'c d',
    ])
    // A line ending of the source is not one of the formula.
    expect(mathRows('a +\nb\n\n= c')).toEqual(['a + b = c'])
  })

  test('a command it does not know stays as written', () => {
    expect(mathText(String.raw`\foo{x}{y} + \unknown_1 \@`)).toBe('\\foo{x}{y} + \\unknown₁ \\@')
  })

  test('nothing to write is nothing', () => {
    for (const source of ['', '   ', String.raw`\!`, '{}', String.raw`\left. \right.`])
      expect([source, mathRows(source)]).toEqual([source, []])
  })

  test('what it writes is as wide as it looks: one column a symbol', () => {
    expect(textWidth(mathText(String.raw`\bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i`))).toBe(16)
    expect(textWidth(mathText(String.raw`\hat{y} \vec{w} \alpha \to \infty \in \mathbb{R}`))).toBe(
      13,
    )
  })
})

describe('where a formula is drawn', () => {
  test('inside a sentence, in its style', () => {
    const rows = renderToLines('Throughput follows $r = n / t$, over $k$ samples.', { width: 60 })
    expect(rows.map(lineText)).toEqual(['Throughput follows r = n / t, over k samples.'])
    expect(rows[0]!.filter((span) => span.style.italic).map((span) => span.text)).toEqual([
      'r = n / t',
      'k',
    ])
    expect(renderToAnsi('a $x^2$ b', { width: 20 })).toBe(`a ${ESC}[3mx²${ESC}[0m b`)
  })

  test('on rows of its own, set in: a `$$` block, a `math` fence, `$$ … $$` on one line', () => {
    const formula = String.raw`\bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i`
    const drawn = 'The mean is\n\n  r̄ = 1/k ∑ᵢ₌₁ᵏ rᵢ\n\nDone.'
    expect(text(`The mean is\n\n$$\n${formula}\n$$\n\nDone.`)).toBe(drawn)
    expect(text(`The mean is\n\n\`\`\`math\n${formula}\n\`\`\`\n\nDone.`)).toBe(drawn)
    expect(text(`The mean is\n\n$$ ${formula} $$\n\nDone.`)).toBe(drawn)
    expect(text(`The mean is\n\n$$${formula}$$\n\nDone.`)).toBe(drawn)
  })

  test('each line of a formula under the one before', () => {
    expect(
      text(String.raw`$$
f(x) = \begin{cases} 1 & x > 0 \\ 0 & \text{otherwise} \end{cases}
$$`),
    ).toBe('  f(x) = { 1, x > 0\n  0, otherwise')
  })

  test('inside a callout, a list and a table', () => {
    expect(text('> [!NOTE]\n> Inside: $a_i^2$ and\n>\n> $$\n> E = mc^2\n> $$\n')).toBe(
      '▌ Note\n▌ Inside: aᵢ² and\n▌\n▌   E = mc²',
    )
    expect(text('- cost $O(n^2)$\n- space $O(n)$\n')).toBe('• cost O(n²)\n• space O(n)')
    expect(text('| f | g |\n| - | - |\n| $x^2$ | $\\alpha$ |\n')).toBe(
      '│ f  │ g │\n├────┼───┤\n│ x² │ α │',
    )
  })

  test('money, a shell line and code are not formulas', () => {
    const plain = [
      'It costs $5 and $10.',
      'Run `echo $HOME` or `$x^2$`.',
      'for i in $(seq 1 12); do echo $i; done',
      'A $ alone, and $ x $ spaced.',
    ]
    for (const markdown of plain) expect(text(markdown, 80)).toBe(markdown.replaceAll('`', ''))
    expect(text('```sh\necho $a^2$\n```')).toBe('echo $a^2$')
    // Beside a real formula too: a price does not open one that the formula's dollar closes.
    expect(text('It costs $5 or $10 for $n$ rows, in $HOME/bin and $PATH.', 80)).toBe(
      'It costs $5 or $10 for n rows, in $HOME/bin and $PATH.',
    )
    const view = createTerminalView({ width: 80 })
    expect(toAnsi(view.render('From $5 to $10 for $n^2$ rows.', { streaming: true }), false)).toBe(
      'From $5 to $10 for n² rows.',
    )
  })

  test('`math: false` leaves a formula as the text it was written as', () => {
    const markdown = 'So $x^2$ and\n\n$$\ny_1\n$$'
    expect(renderToAnsi(markdown, { width: 40, color: false, math: false })).toBe(
      'So $x^2$ and\n\n$$ y_1 $$',
    )
    const view = createTerminalView({ width: 40, math: false })
    expect(toAnsi(view.render(markdown), false)).toBe('So $x^2$ and\n\n$$ y_1 $$')
  })

  test('a formula keeps to one row where a row holds it, and its spaces are spaces', () => {
    const markdown = 'Twelve chars $a + b = c + d$ and the rest of it.'
    expect(text(markdown, 24).split('\n')).toEqual([
      'Twelve chars',
      'a + b = c + d and the',
      'rest of it.',
    ])
    expect(text(markdown, 24).includes(NO_BREAK)).toBe(false)
    // One no row holds is broken at its spaces, and no row runs past the edge.
    const long = `$${Array.from({ length: 30 }, (_, at) => `x_${at % 10}`).join(' + ')}$`
    for (const width of [8, 20, 37]) {
      const rows = renderToLines(`${long}\n\n$$\n${long.slice(1, -1)}\n$$`, { width })
      expect(Math.max(...rows.map((row) => textWidth(lineText(row))))).toBeLessThanOrEqual(width)
      expect(rows.map(lineText).join(' ').replace(/\s+/g, ' ')).toContain('x₀ + x₁ + x₂')
    }
  })
})

describe('any text is read', () => {
  const PARTS =
    String.raw`\frac \sqrt \sqrt[ \sum \bar \hat \left \right \begin{cases} \end{cases} \begin{ \text \mathbb \not \\ \, \{ \} \ \foo \binom \tag \pmod { } [ ] ( ) ^ _ & ~ $ x y 1 2 + - = , . α ∑`
      .split(' ')
      .concat([
        ' ',
        ' ',
        '\n',
        '\t',
        ESC,
        `${ESC}[31m`,
        String.fromCharCode(0x202e),
        String.fromCharCode(7),
        '漢',
        '👨‍👩‍👧',
        'é',
      ])

  test('seeded noise: no throw, no control character on the screen, no row past the edge', () => {
    const SEEDS = 600
    const failed: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = seeded(seed)
      let source = ''
      const size = random.int(1, 40)
      for (let at = 0; at < size; at++) source += random.pick(PARTS)
      try {
        // The converter alone, whatever the text; then through the renderer, as a reply's formula.
        mathRows(source)
        const width = [8, 20, 60][seed % 3]!
        const rows = renderToLines(`Text $${source}$ more.\n\n$$\n${source}\n$$\n`, { width })
        const screen = toAnsi(rows, false)
        if ([...screen].some((char) => char !== '\n' && char.codePointAt(0)! < 0x20))
          failed.push(`seed ${seed}: a control character`)
        if (rows.some((row) => textWidth(lineText(row)) > width))
          failed.push(`seed ${seed}: too wide`)
      } catch (error) {
        failed.push(`seed ${seed}: ${String(error)}`)
      }
    }
    expect(failed.slice(0, 5)).toEqual([])
  })

  test('nesting without end is read in the time its length takes', () => {
    const deep = [
      '{'.repeat(200_000),
      '^'.repeat(200_000),
      '_{'.repeat(100_000),
      String.raw`\frac`.repeat(60_000),
      String.raw`\sqrt[`.repeat(60_000),
      String.raw`\bar{`.repeat(60_000),
      String.raw`\not`.repeat(60_000),
      String.raw`\begin{cases}`.repeat(30_000),
      `${'('.repeat(100_000)}x`,
      String.raw`\frac{${'a'.repeat(100_000)}(}{b}`,
    ]
    const started = performance.now()
    for (const source of deep) expect(() => mathRows(source)).not.toThrow()
    // Linear: a second is a hundred times what these take.
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe('a formula still being typed', () => {
  const reply = String.raw`The mean is $\bar{r} = \frac{1}{k}$ here, and

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

It costs $5 today.
`

  test('half of its LaTeX is never on the screen', () => {
    const view = createTerminalView({ width: 50 })
    const seen: string[] = []
    for (const prefix of prefixes(reply, 'token', 1)) {
      const screen = toAnsi(view.render(prefix, { streaming: true }), false)
      // What is typed of the inline one is withheld until it closes: no backslash, no brace.
      if (prefix.length <= reply.indexOf('here') && /[\\{}]/.test(screen))
        seen.push(JSON.stringify(screen))
    }
    expect(seen.slice(0, 3)).toEqual([])
    expect(toAnsi(view.render(reply), false)).toBe(
      'The mean is r̄ = 1/k here, and\n\n  x = (-b ± √(b² - 4ac))/2a\n\nIt costs $5 today.',
    )
  })

  test('every step of a stream is what a fresh render draws', () => {
    for (const pattern of ['token', 'frame', 'line'] as const) {
      const view = createTerminalView({ width: 40 })
      let last: Line[] = []
      for (const prefix of prefixes(reply, pattern, 3)) {
        last = view.render(prefix, { streaming: true })
        expect(toAnsi(last)).toBe(toAnsi(renderToLines(prefix, { width: 40, streaming: true })))
      }
      expect(toAnsi(view.render(reply))).toBe(toAnsi(renderToLines(reply, { width: 40 })))
    }
  })
})
