import { describe, expect, test } from 'bun:test'
import { CALLOUT_KINDS } from '../dialect'
import { render as renderDocument } from '../../test/render'

const render = (markdown: string, streaming = false) => renderDocument(markdown, { streaming })

describe('callouts', () => {
  test('every kind the prompt may name renders as a labelled note, marker removed', () => {
    for (const kind of CALLOUT_KINDS) {
      const html = render(`> [!${kind.toUpperCase()}]\n> Rotating the key logs clients out.`)
      expect(html).toContain(`<aside class="fd-callout" data-callout="${kind}" role="note"`)
      expect(html).toContain('Rotating the key logs clients out.')
      expect(html).not.toContain('[!')
      expect(html).not.toContain('<blockquote')
    }
  })

  test('text after the marker is the printed title', () => {
    const titled = render('> [!TIP] Faster builds\n> Cache the store.')
    expect(titled).toContain('aria-label="Faster builds"')
    expect(titled).toContain('<div class="fd-callout-title">Faster builds</div>')
    expect(titled).toContain('<p>Cache the store.</p>')
  })

  test('an untitled callout speaks its kind but prints no label over the text', () => {
    // A printed English "Note" over a reply in another language read as foreign chrome.
    const spaced = render('> [!NOTE]\n>\n> Body paragraph.')
    expect(spaced).toContain('aria-label="Note"')
    expect(spaced).not.toContain('fd-callout-title')
    expect(spaced).not.toContain('<p></p>')
    expect(spaced).toContain('<p>Body paragraph.</p>')
  })

  test('formatting on the marker line stays body content rather than a lost title', () => {
    const html = render('> [!WARNING] **Do not** force-push\n> to main.')
    expect(html).toContain('aria-label="Warning"')
    expect(html).not.toContain('fd-callout-title')
    expect(html).toContain('<strong>Do not</strong>')
  })

  test('an unknown kind is an ordinary quote with its text intact', () => {
    const html = render('> [!FOO]\n> Body')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('[!FOO]')
  })

  test('renders while streaming too, so settlement does not re-flow the message', () => {
    expect(render('> [!NOTE]\n> Still arriving', true)).toContain('data-callout="note"')
  })
})

describe('quote attribution', () => {
  test('a closing em-dash line becomes the footer, in either paragraph shape', () => {
    for (const markdown of [
      '> Simplicity is prerequisite for reliability.\n> — Edsger Dijkstra',
      '> Simplicity is prerequisite for reliability.\n>\n> — Edsger Dijkstra',
      '> Simplicity is prerequisite for reliability.\n> -- Edsger Dijkstra',
    ]) {
      const html = render(markdown)
      expect(html).toContain('<p>Simplicity is prerequisite for reliability.</p>')
      expect(html).toContain('<footer class="fd-quote-source">Edsger Dijkstra</footer>')
    }
  })

  test('keeps inline formatting of the source', () => {
    const html = render('> Quote.\n> — Knuth, *TAOCP*')
    expect(html).toContain('<footer class="fd-quote-source">Knuth, <em>TAOCP</em></footer>')
  })

  test('a dash inside a line, or a quote that is only a source line, is left alone', () => {
    expect(render('> Fast — and correct.')).not.toContain('<footer')
    expect(render('> — Anonymous')).not.toContain('<footer')
  })
})

describe('figures', () => {
  test('a lone titled image becomes a captioned figure', () => {
    const html = render('![Queue](https://example.com/q.png "Figure 1: the wake queue")')
    expect(html).toContain('<figure class="fd-figure">')
    expect(html).toContain('<figcaption>Figure 1: the wake queue</figcaption>')
  })

  test('an emphasis-only line under a lone image becomes its caption, not a stray paragraph', () => {
    // On the next line (one paragraph) and after a blank line (two paragraphs).
    for (const gap of ['\n', '\n\n']) {
      const html = render(`![Espresso](https://example.com/e.jpg)${gap}*Espresso shot*\n\nNext.`)
      expect(html).toContain('<figure class="fd-figure">')
      expect(html).toContain('<figcaption>Espresso shot</figcaption>')
      expect(html).not.toContain('<em>Espresso shot</em>')
      expect(html).toContain('<p>Next.</p>')
    }
  })

  test('an image and emphasis on one line are prose, not a captioned figure', () => {
    expect(render('![a](https://example.com/a.png) *b*')).not.toContain('<figure')
  })

  test('a lone untitled image is still a centred figure; an image inside prose stays inline', () => {
    const lone = render('![Queue](https://example.com/q.png)')
    expect(lone).toContain('<figure class="fd-figure">')
    expect(lone).not.toContain('<figcaption>')
    expect(render('See ![q](https://example.com/q.png "t") here')).not.toContain('<figure')
  })

  test('an italic line that is not directly under an image stays an ordinary paragraph', () => {
    const html = render('![Queue](https://example.com/q.png)\n\nSome text\n\n*just emphasis*')
    expect(html).toContain('<em>just emphasis</em>')
  })
})

describe('section numbers', () => {
  test('a number the author wrote is set apart from the title', () => {
    const html = render('## 1.2 Water temperature')
    expect(html).toContain('<span class="fd-section-number">1.2</span>Water temperature')
    expect(render('## 3. Results')).toContain('<span class="fd-section-number">3.</span>Results')
  })

  test('nothing is numbered that was not, and a bare number stays the heading', () => {
    expect(render('## Water temperature')).not.toContain('fd-section-number')
    expect(render('## 2024')).not.toContain('fd-section-number')
    expect(render('## 1.5x faster builds')).not.toContain('fd-section-number')
  })
})

describe('diagram fences', () => {
  test('without a Mermaid loader a diagram is its source, as code', () => {
    const html = render('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(html).toContain('<figure class="fd-diagram" data-state="source">')
    expect(html).toContain('<code class="language-mermaid">flowchart LR')
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('<pre><figure')
  })

  test('with one, it says it is drawing, and a fence still being written is not drawn', () => {
    const mermaid = () => new Promise<never>(() => {})
    const settled = renderDocument('```mermaid\nflowchart LR\n  A --> B\n```', { mermaid })
    expect(settled).toContain('Drawing diagram…')
    const growing = renderDocument('```mermaid\nflowchart LR\n  A --> B', {
      mermaid,
      streaming: true,
    })
    expect(growing).toContain('flowchart LR')
  })
})
