import { describe, expect, test } from 'bun:test'
import { CORPUS } from '../scripts/corpus'
import { toRows, toText } from './index'
import { cells } from './rows'

describe('toText', () => {
  test('writes scripts small where Unicode has them, after ^ and _ where it has not', () => {
    expect(toText('x^2 + y_i')).toBe('x² + yᵢ')
    expect(toText('e^{i\\pi}')).toBe('e^(iπ)')
    expect(toText('a_{\\text{max}}')).toBe('aₘₐₓ')
  })

  test('writes fractions with a slash, bracketing what is more than a term', () => {
    expect(toText('\\frac{1}{2}')).toBe('1/2')
    expect(toText('\\frac{a+b}{2}')).toBe('(a + b)/2')
    expect(toText('\\sqrt{x} + \\sqrt{a+b}')).toBe('√x + √(a + b)')
  })

  test('keeps typefaces and signs', () => {
    expect(toText('x \\in \\mathbb{R}')).toBe('x ∈ ℝ')
    expect(toText('-x')).toBe('−x')
    expect(toText('\\hat n')).toBe('n̂')
  })
})

describe('toRows', () => {
  test('sets a fraction over its rule', () => {
    expect(toRows('\\frac{a+b}{2}')).toEqual(['a + b', '─────', '  2'])
  })

  test('sets a sum’s limits above and below, tightly', () => {
    expect(toRows('\\sum_{i=1}^{n} i')).toEqual([' n', ' ∑  i', 'i=1'])
  })

  test('stands a matrix in brackets as tall as its rows', () => {
    expect(toRows('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')).toEqual(['⎛a  b⎞', '⎝c  d⎠'])
  })

  test('runs a brace under what it counts, its label under it', () => {
    expect(toRows('\\underbrace{a+b+c}_{3}')).toEqual(['a + b + c', '╰───┬───╯', '    3'])
  })

  test('writes on one line what has no rows, or does not fit', () => {
    expect(toRows('x^2 + y^2 = r^2')).toEqual(['x² + y² = r²'])
    expect(toRows('\\frac{a}{b}', 0)).toEqual(['a/b'])
  })

  test('keeps every row of every formula, and every prefix, within its columns', () => {
    for (const [, tex] of CORPUS) {
      for (let at = 0; at <= tex.length; at += 3) {
        for (const row of toRows(tex.slice(0, at), 60)) {
          if (cells(row) > 60 && toRows(tex.slice(0, at), 60).length > 1)
            throw new Error(`${tex.slice(0, at)}: ${row}`)
        }
      }
    }
  })
})
