/**
 * What the differential fuzz (`bench/src/differential.ts`) found the parser reading wrongly,
 * where micromark and markdown-it agree with each other and with CommonMark or GitHub's parser.
 * Each case is the smallest text that showed it.
 */
import { expect, test } from 'bun:test'
import { parse, toHtml } from './index'

const html = (markdown: string) => toHtml(parse(markdown)).replace(/\n/g, '')

test('a blank line after indented code in a list item makes the list loose', () => {
  // The code's trailing blank line is not its own: the gap before `t` is the item's.
  expect(html('+     _\n\n  t')).toBe('<ul><li><pre><code>_</code></pre><p>t</p></li></ul>')
  expect(html('-     c\n\n  x')).toBe('<ul><li><pre><code>c</code></pre><p>x</p></li></ul>')
  // A blank line that ends the last item does not loosen the list.
  expect(html('- a\n- b\n\n')).toBe('<ul><li>a</li><li>b</li></ul>')
})

test('a link definition is a block of a list item: a blank line before it makes the list loose', () => {
  expect(html('- a\n\n  [r]: /u')).toBe('<ul><li><p>a</p></li></ul>')
  // CommonMark's example 317.
  expect(html('- a\n- b\n\n  [ref]: /url\n- d')).toBe(
    '<ul><li><p>a</p></li><li><p>b</p></li><li><p>d</p></li></ul>',
  )
  // And it still defines, and still draws nothing.
  expect(html('[x]\n\n[x]: /u')).toBe('<p><a href="/u">x</a></p>')
})

test('a list item that can interrupt a paragraph comes before a row of dashes', () => {
  expect(html('b\n- |')).toBe('<p>b</p><ul><li>|</li></ul>')
  expect(html('a | b\n- | -')).toBe('<p>a | b</p><ul><li>| -</li></ul>')
  // Without the space after the dash it is a table's row of dashes, as it was.
  expect(html('a | b\n-|-')).toContain('<table>')
})

test('a header that is a pipe alone heads no table', () => {
  expect(html('|\n-|')).toBe('<p>|-|</p>')
  expect(html('| |\n|-|')).toContain('<table>')
})
