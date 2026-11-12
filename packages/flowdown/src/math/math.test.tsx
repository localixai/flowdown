import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { math, typesetMath } from './index'

const toHtml = (markdown: string) => render(markdown, { math })

describe('the math stage', () => {
  test('typesets inline and display math', () => {
    const html = toHtml('Inline $E = mc^2$ here.\n\n$$\n\\frac{a}{b}\n$$')
    expect(html).toContain('<span class="katex">')
    expect(html).toContain('<span class="katex-display">')
    expect(html).not.toContain('language-math')
  })

  test('a fence whose language is math is a display formula, as on GitHub', () => {
    const fence = '```math\n\\sqrt{3}\n```'
    expect(render(fence, { math })).toContain('katex-display')
    expect(render(`Before.\n\n${fence}\n\nAfter.`, { math })).toContain('katex-display')
    // Still streaming, it is not shown as code first.
    expect(render('```math\n\\sqrt{3', { math, streaming: true })).not.toContain('fd-code')
    // Without the stage it is the code block any renderer shows.
    expect(render(fence)).toContain('language-math')
  })

  test('a formula it has set before is reused, not typeset again', () => {
    // Identity is the observable: a cache hit hands back the very result of the first render.
    const first = typesetMath('x^2 + y^2 = z^2', false)
    expect(typesetMath('x^2 + y^2 = z^2', false)).toBe(first)
    expect(typesetMath('x^2 + y^2 = z^2', true)).not.toBe(first)
  })

  test('an expression KaTeX cannot parse renders its own error form instead of throwing', () => {
    const html = toHtml('Broken $\\frac{a}{$ here.')
    expect(html).toContain('katex-error')
  })

  test('without the stage, dollars are text', () => {
    expect(render('Inline $E = mc^2$ here.')).toContain('$E = mc^2$')
  })
})
