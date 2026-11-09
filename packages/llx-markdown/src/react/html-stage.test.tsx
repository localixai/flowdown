/**
 * A reply that holds one HTML tag goes through the sanitizer, and everything else in it must
 * still render as it does without the tag: formulas, footnotes, the dialect.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { html } from '../html'
import { math } from '../math'
import { Markdown } from './markdown'

const render = (source: string, withHtml = true) =>
  renderToStaticMarkup(
    <Markdown html={withHtml ? html : false} math={math}>
      {source}
    </Markdown>,
  )

describe('a reply with raw HTML in it', () => {
  test('still typesets its formulas', () => {
    const page = render('Press <kbd>Enter</kbd>.\n\nThe area is $\\pi r^2$.\n\n$$\nE = mc^2\n$$')
    expect(page).toContain('<kbd>Enter</kbd>')
    expect(page.match(/class="katex"/g)?.length).toBe(2)
    expect(page).not.toContain('language-math')
  })

  test('keeps footnote links pointing at their notes', () => {
    const page = render('A claim<sup>1</sup> with a note.[^1]\n\n[^1]: The source.')
    const hrefs = [...page.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(ids.has(href), href).toBe(true)
  })
})
