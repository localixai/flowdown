import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { CORPUS } from '../../test/corpus'
import { math } from '../math'
import { buildComponents, Markdown } from '../react/markdown'
import { splitBlocks } from './blocks'
import { escapeLiteralDollars } from './dollars'
import { closePartialMarkdown } from './heal'
import { headingIdsByOffset, rehypeHeadingIds } from './headings'
import { rehypePluginsFor, remarkPluginsFor } from './pipeline'
import { hasHtmlSyntax } from './syntax'

const components = buildComponents(undefined)

/** `useId` values depend on where a component sits in the React tree, which blocks change. */
const sameIds = (html: string) => html.replace(/_R_[0-9a-z]+_/g, '_R_')

/** The document as ONE parse draws it: the reference a block-by-block render must match. */
function whole(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  const healed = streaming ? closePartialMarkdown(markdown) : markdown
  const source = withMath ? escapeLiteralDollars(healed) : healed
  const plugin = withMath ? math : null
  const ids = headingIds ? headingIdsByOffset(source) : null
  return sameIds(
    renderToStaticMarkup(
      <div
        className="llx-markdown"
        data-streaming={streaming || undefined}
        data-caret={streaming || undefined}
      >
        <ReactMarkdown
          remarkPlugins={remarkPluginsFor({ math: plugin })}
          rehypePlugins={rehypePluginsFor(
            { html: hasHtmlSyntax(source), math: plugin },
            ids ? [rehypeHeadingIds(ids)] : [],
          )}
          components={components}
        >
          {source}
        </ReactMarkdown>
      </div>,
    ),
  )
}

function split(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  return sameIds(
    renderToStaticMarkup(
      <Markdown streaming={streaming} math={withMath ? math : null} headingIds={headingIds}>
        {markdown}
      </Markdown>,
    ),
  )
}

describe('splitBlocks', () => {
  test('the blocks are the document, cut and in order, with where each starts', () => {
    for (const [name, markdown] of Object.entries(CORPUS)) {
      const blocks = splitBlocks(markdown)
      expect(blocks.map((block) => block.source).join(''), name).toBe(markdown)
      for (const block of blocks) {
        expect(markdown.slice(block.offset, block.offset + block.source.length)).toBe(block.source)
        expect(markdown.slice(0, block.offset).split('\n').length, name).toBe(block.line)
      }
    }
  })

  test('a form and what it governs are one block', () => {
    const blocks = splitBlocks('Intro.\n\n> [!STEPS]\n1. **A**\n2. **B**\n\nAfter.')
    expect(blocks.map((block) => block.source.trim())).toEqual([
      'Intro.',
      '> [!STEPS]\n1. **A**\n2. **B**',
      'After.',
    ])
  })

  test('tabs run to a shallower heading or a rule, pros sit with the cons after them', () => {
    const tabs = splitBlocks('> [!TABS]\n#### A\nOne.\n\n#### B\nTwo.\n\n## Next\n\nText.')
    expect(tabs[0]!.source).toContain('#### B')
    expect(tabs[1]!.source.trim()).toBe('## Next')
    const pair = splitBlocks('> [!PROS]\n- a\n\n> [!CONS]\n- b\n\nAfter.')
    expect(pair).toHaveLength(2)
  })

  test('footnotes and link definitions keep the document whole', () => {
    expect(splitBlocks(CORPUS.footnotes!)).toHaveLength(1)
    expect(splitBlocks(CORPUS.definitions!)).toHaveLength(1)
  })
})

describe('drawn block by block, a document is what one parse of it draws', () => {
  for (const [name, markdown] of Object.entries(CORPUS)) {
    test(name, () => {
      expect(split(markdown)).toBe(whole(markdown))
      expect(split(markdown, { headingIds: true })).toBe(whole(markdown, { headingIds: true }))
      if (name === 'math')
        expect(split(markdown, { withMath: true })).toBe(whole(markdown, { withMath: true }))
    })
  }
})

describe('fed a few characters at a time, every frame matches one parse of that frame', () => {
  for (const [name, markdown] of Object.entries(CORPUS)) {
    test(name, () => {
      // Every frame of a stream: each prefix, a few characters apart, and the very end.
      for (
        let end = 1;
        end <= markdown.length;
        end += end < markdown.length && end + 3 > markdown.length ? markdown.length - end : 3
      ) {
        const frame = markdown.slice(0, end)
        expect(split(frame, { streaming: true }), `${name} @${end}`).toBe(
          whole(frame, { streaming: true }),
        )
      }
    })
  }
})
