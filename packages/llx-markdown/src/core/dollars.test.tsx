import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { math } from '../math'
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
