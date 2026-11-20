import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CORPUS } from '../../test/corpus'
import { defaultUrlTransform } from '../engine/url'
import { html } from '../html'
import { math } from '../math'
import { buildComponents, draw, Markdown } from '../react/markdown'
import { splitBlocks } from './blocks'
import { escapeLiteralDollars } from './dollars'
import { closePartialMarkdown } from './heal'
import { headingIdsByOffset } from './headings'
import { flowdownDialect } from './remark-answer-blocks'
import { hasHtmlSyntax } from './syntax'

const drawn = buildComponents(undefined)

/** `useId` values depend on where a component sits in the React tree, which blocks change. */
const sameIds = (markup: string) => markup.replace(/_R_[0-9a-z]+_/g, '_R_')

/** The document as ONE parse draws it: the reference a block-by-block render must match. */
function whole(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  const healed = streaming ? closePartialMarkdown(markdown) : markdown
  const source = withMath ? escapeLiteralDollars(healed) : healed
  return sameIds(
    renderToStaticMarkup(
      <div
        className="flowdown"
        data-streaming={streaming || undefined}
        data-caret={streaming || undefined}
      >
        {draw(source, 0, headingIds ? headingIdsByOffset(source) : null, {
          ...drawn,
          extensions: [
            flowdownDialect,
            ...(withMath ? [math] : []),
            ...(hasHtmlSyntax(source) ? [html] : []),
          ],
          urlTransform: defaultUrlTransform,
          ownCode: false,
          ownTable: false,
          ownList: false,
        })}
      </div>,
    ),
  )
}

function split(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  return sameIds(
    renderToStaticMarkup(
      <Markdown
        streaming={streaming}
        math={withMath ? math : null}
        html={html}
        headingIds={headingIds}
      >
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

  test('a rule before a heading of the tabs depth parts two tabs: one block holds them', () => {
    const doc =
      '> [!TABS]\n#### A\nOne.\n\n---\n\n#### B\nTwo.\n\n---\n#### C\nThree.\n\n---\n\nAfter.'
    const blocks = splitBlocks(doc)
    expect(blocks[0]!.source).toContain('#### C')
    expect(blocks.at(-1)!.source.trim()).toBe('After.')
  })

  test('a tag inside a fenced code block is code: one it leaves open joins nothing after it', () => {
    const after = '\n\n## Next\n\nOne.\n\n## Last\n\nTwo.\n'
    const fences = [
      // A render prop: the `>` of its arrow is not the end of the tag, which closes with `/>`.
      '```jsx\n<List\n  renderItem={(x) => (\n    <Item>{x}</Item>\n  )}\n/>\n```',
      // HTML that leaves an element to the parser to close, as `<li>` may.
      '```html\n<ul>\n  <li>one\n  <li>two\n</ul>\n```',
      // A snippet of a page, cut where the answer needs it.
      '```html\n<div class="card">\n  …\n```',
      '~~~html\n<section>\n~~~',
      // A comment opened in code, as a template might show.
      '```html\n<!-- the header goes here\n```',
    ]
    for (const fence of fences) {
      const blocks = splitBlocks(fence + after)
      expect(
        blocks.map((block) => block.source.trim()),
        fence,
      ).toEqual([fence, '## Next', 'One.', '## Last', 'Two.'])
    }
  })

  test('an HTML block that a fence stands inside still holds the fence and its closing tag', () => {
    const blocks = splitBlocks('<div>\n\n```html\n<p>code\n```\n\n</div>\n\nAfter.')
    expect(blocks.map((block) => block.source.trim())).toEqual([
      '<div>\n\n```html\n<p>code\n```\n\n</div>',
      'After.',
    ])
  })

  test('footnotes and link definitions keep the document whole', () => {
    expect(splitBlocks(CORPUS.footnotes!)).toHaveLength(1)
    expect(splitBlocks(CORPUS.definitions!)).toHaveLength(1)
    // Link definitions do not, for a caller that resolves them across blocks; footnotes still do.
    expect(splitBlocks(CORPUS.definitions!, { refs: true }).length).toBeGreaterThan(1)
    expect(splitBlocks(CORPUS.footnotes!, { refs: true })).toHaveLength(1)
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

/** Tags in code, and code in HTML: where the cut must tell markup from code. */
const CODE_AND_MARKUP: Record<string, string> = {
  'a render prop in a fence': [
    'Use it like this:',
    '',
    '```jsx',
    '<List',
    '  renderItem={(x) => (',
    '    <Item>{x}</Item>',
    '  )}',
    '/>',
    '```',
    '',
    '## Then',
    '',
    'Text **after** it.',
  ].join('\n'),
  'an element left open in a fence': '```html\n<ul>\n  <li>one\n</ul>\n```\n\nAfter.\n\n- a\n- b',
  'a fence inside an HTML block': '<div>\n\n```html\n<p>code\n```\n\n</div>\n\nAfter.',
  'an open HTML block, then a fence that closes it in code':
    '<details>\n<summary>More</summary>\n\n```html\n</details>\n```\n\nStill inside.\n\n</details>\n\nAfter.',
  // An item that opens with a blank line holds at most one: after it, the item is over, and the
  // indented line is code of its own, the fence under it a top-level one.
  'an empty item, a blank line, then indented code and a fence':
    '- \n\n    ```\n   ```\n```ts title="a.ts"\nconst a = 1',
  'an empty item, a blank line, then text indented to the item': '-\n\n  foo\n\nAfter.',
  // `$$` left odd keeps a blank line from cutting: the tabs and their heading are one piece, the
  // heading under a blank line, and the fence after them is still in the last tab.
  'tabs over a blank line, inside what may be a formula':
    'a $$ b\n> [!TABS]\n\n## Next\na $$ b\n```',
  // A closing tag with nothing open to close is dropped: it does not close the one opened after it.
  'a stray closing tag, then the tag opened again': '<div>text</div>\n</div>\n<div>\n\n## Next',
  // A fence still being written is drawn by a path of its own: it names its file as a finished one.
  'a titled fence still being written':
    'Intro.\n\n```ts title="src/a.ts"\nconst a = 1\nconst b = 2',
}

describe('tags in code and code in HTML, drawn block by block, are what one parse draws', () => {
  for (const [name, markdown] of Object.entries(CODE_AND_MARKUP)) {
    test(name, () => {
      expect(split(markdown)).toBe(whole(markdown))
      for (let end = 1; end <= markdown.length; end += 1) {
        const frame = markdown.slice(0, end)
        expect(split(frame, { streaming: true }), `${name} @${end}`).toBe(
          whole(frame, { streaming: true }),
        )
      }
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
