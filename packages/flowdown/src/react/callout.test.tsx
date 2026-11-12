import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Callout } from './callout'
import { Markdown } from './markdown'

describe('a page that wraps the callout', () => {
  test('keeps its class and attributes on a callout, as on a quote', () => {
    const components = {
      blockquote: (props: Parameters<typeof Callout>[0]) => (
        <Callout {...props} className="mine" data-testid="note" />
      ),
    }
    const callout = renderToStaticMarkup(
      <Markdown components={components}>{'> [!TIP]\n> Cache the build.'}</Markdown>,
    )
    expect(callout).toContain('class="fd-callout mine"')
    expect(callout).toContain('data-testid="note"')
    expect(callout).toContain('role="note"')

    const quote = renderToStaticMarkup(<Markdown components={components}>{'> A quote.'}</Markdown>)
    expect(quote).toContain('<blockquote class="mine" data-testid="note">')
  })
})
