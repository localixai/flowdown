import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { math } from '../math'
import { hasMathSyntax } from './syntax'
import { escapeLiteralDollars, isLiteralDollar } from './dollars'

describe('isLiteralDollar', () => {
  test('currency amounts and shell variables are dollar signs', () => {
    for (const text of ['$5 and', '$10,', '$1.5M today', '$HOME/bin', '$PATH,', '$PATH before']) {
      expect(isLiteralDollar(text, 0)).toBe(true)
    }
  })

  test('formulas, display math and escaped dollars are not', () => {
    for (const text of ['$E = mc^2$', '$10^6$', '$2x$', '$AB$', '$AB = CD$', '$$', '$x_i$']) {
      expect(isLiteralDollar(text, 0)).toBe(false)
    }
    expect(isLiteralDollar('\\$5', 1)).toBe(false)
  })
})

describe('escapeLiteralDollars', () => {
  test('a price per unit is a price, not a formula', () => {
    expect(escapeLiteralDollars('$50/month or $500/year')).toBe('\\$50/month or \\$500/year')
    expect(escapeLiteralDollars('$5/GB')).toBe('\\$5/GB')
  })

  test('escapes literal dollars in prose, including at the very start', () => {
    expect(escapeLiteralDollars('$5 and $10')).toBe('\\$5 and \\$10')
    expect(escapeLiteralDollars('Formula $x$ costs $5')).toBe('Formula $x$ costs \\$5')
  })

  test('leaves code untouched and returns the same string when nothing changes', () => {
    const code = 'Run `echo $HOME` and\n```sh\nexport $PATH\n```'
    expect(escapeLiteralDollars(code)).toBe(code)
    const plain = 'No dollars here'
    expect(escapeLiteralDollars(plain)).toBe(plain)
  })

  test('a reply with one real formula no longer typesets its prices and variables', () => {
    // The shape of the reported reply: `$5 and $` paired into a formula, and `$HOME/bin and $PATH`
    // became italic math that swallowed the code span after it.
    const reply =
      'Formula $a*b$, price $5 and $10, variables $HOME/bin and $PATH, command `echo $USER`.'
    const html = render(reply, { math })
    expect(html.match(/class="katex"/g)).toHaveLength(1)
    expect(html).toContain('price $5 and $10, variables $HOME/bin and $PATH, command')
    expect(html).toContain('<code>echo $USER</code>')
  })
})

describe('single dollars pair by the pandoc rule', () => {
  const shell = 'for i in $(seq 1 12); do printf "line %s" $i; done'

  test('a shell line is text, not a formula', () => {
    const html = render(shell, { math })
    expect(html).not.toContain('katex')
    expect(html).toContain('$(seq 1 12); do printf &quot;line %s&quot; $i; done')
    expect(hasMathSyntax(shell)).toBe(false)
  })

  test('the opening dollar has no space after it, the closing one none before and no digit after', () => {
    const katex = (markdown: string) =>
      render(markdown, { math }).match(/class="katex"/g)?.length ?? 0
    expect(katex('$x$')).toBe(1)
    expect(katex('a $b$, c')).toBe(1)
    expect(katex('$ x $')).toBe(0)
    expect(katex('$x $')).toBe(0)
    expect(katex('$a$5')).toBe(0)
    expect(katex('costs $5 and $10')).toBe(0)
    expect(render('$ x $', { math })).toContain('$ x $')
    expect(render('$a$5', { math })).toContain('$a$5')
  })

  test('an escaped dollar closes nothing', () => {
    expect(render('$a + \\$b$', { math }).match(/class="katex"/g)).toHaveLength(1)
  })

  test('hasMathSyntax agrees with the parser', () => {
    for (const text of ['$x$', 'a $b$, c', '$$\nx\n$$', 'Formula $a*b$ costs $5']) {
      expect(hasMathSyntax(text)).toBe(true)
    }
    for (const text of [shell, '$ x $', '$a$5', 'costs $5 and $10', '$HOME/$PATH', '`$x$`']) {
      expect(hasMathSyntax(text)).toBe(false)
    }
  })

  test('escapeLiteralDollars escapes every dollar that pairs with nothing', () => {
    // So remark-math, which pairs any two, reads what <Markdown> reads.
    expect(escapeLiteralDollars(shell)).toBe(
      'for i in \\$(seq 1 12); do printf "line %s" \\$i; done',
    )
    expect(escapeLiteralDollars('$ x $')).toBe('\\$ x \\$')
    expect(escapeLiteralDollars('$a$5')).toBe('\\$a\\$5')
    expect(escapeLiteralDollars('a $b$, c')).toBe('a $b$, c')
    // A formula does not reach across a blank line.
    expect(escapeLiteralDollars('$a\n\nb$')).toBe('\\$a\n\nb\\$')
  })
})
