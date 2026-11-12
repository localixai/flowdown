/**
 * What a host page adds to the dialect: its own syntax and passes over the tree, and its own
 * drawing of a diagram or a file tree. A chat app turns `@path` into a file chip, wraps each block
 * in its actions (copy, save) with the block's own Markdown, and shows diagrams in its own viewer.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, type Extension, type MarkdownComponents } from '../index'

/** An inline rule: `@name` in text becomes emphasis, as a mention chip would. */
const mentions: Extension = {
  name: 'mentions',
  inline: [
    {
      chars: '@',
      parse(state) {
        const name = /^@\w+/.exec(state.text.slice(state.pos, state.pos + 64))
        if (!name) return false
        state.push({ type: 'emphasis', children: [{ type: 'text', value: name[0] }] })
        state.pos += name[0].length
        return true
      },
    },
  ],
}

/** A pass over the tree: each top-level block carries the Markdown it was drawn from. */
const blockSource: Extension = {
  name: 'block-source',
  transform(root, source) {
    for (const node of root.children ?? []) {
      if (!node.position) continue
      node.data = {
        ...node.data,
        hProperties: {
          ...(node.data?.hProperties as object | undefined),
          dataMarkdown: source.slice(node.position.start.offset, node.position.end.offset),
        },
      }
    }
  },
}
const MENTIONS = [mentions]
const BLOCK_SOURCE = [blockSource]

const attributes = (html: string) =>
  [...html.matchAll(/data-markdown="([^"]*)"/g)].map((m) =>
    (m[1] ?? '')
      .replaceAll('&quot;', '"')
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
      .replaceAll('&amp;', '&'),
  )

describe('a page’s own extensions', () => {
  test('an inline rule runs on every block', () => {
    const html = renderToStaticMarkup(
      <Markdown extensions={MENTIONS}>{'Ask @ana\n\nThen @bo'}</Markdown>,
    )
    expect(html).toContain('<em>@ana</em>')
    expect(html).toContain('<em>@bo</em>')
  })

  test('a pass can read the Markdown each block was drawn from', () => {
    const blocks = [
      '# Title',
      'Costs $5 and $x^2$ here.',
      '- [ ] one\n- [x] two',
      '> [!TIP]\n> Cache it.',
    ]
    const html = renderToStaticMarkup(
      <Markdown extensions={BLOCK_SOURCE} math={() => import('../math/index')}>
        {blocks.join('\n\n')}
      </Markdown>,
    )
    expect(attributes(html)).toEqual([
      '# Title',
      'Costs \\$5 and $x^2$ here.',
      '- [ ] one\n- [x] two',
      '> [!TIP]\n> Cache it.',
    ])
  })

  test('what a pass adds is kept when the block holds raw HTML', () => {
    const html = renderToStaticMarkup(
      <Markdown extensions={BLOCK_SOURCE}>{'<b>bold</b> text'}</Markdown>,
    )
    expect(attributes(html)).toEqual(['<b>bold</b> text'])
  })
})

describe('a page’s own diagram and tree', () => {
  const Diagram: MarkdownComponents['diagram'] = ({ source, growing }) => (
    <div data-diagram={growing ? 'growing' : 'done'}>{source}</div>
  )
  const Tree: MarkdownComponents['tree'] = ({ source }) => <ul data-tree>{source}</ul>

  test('draws every diagram and tree, never as code', () => {
    const html = renderToStaticMarkup(
      <Markdown components={{ diagram: Diagram, tree: Tree }}>
        {'```mermaid\ngraph TD\nA-->B\n```\n\n```tree\nsrc/\n└── a.ts\n```'}
      </Markdown>,
    )
    expect(html).toContain('<div data-diagram="done">graph TD\nA--&gt;B</div>')
    expect(html).toContain('<ul data-tree="true">src/\n└── a.ts</ul>')
    expect(html).not.toContain('<pre')
  })

  test('tells the diagram still being written from a finished one above it', () => {
    const html = renderToStaticMarkup(
      <Markdown streaming components={{ diagram: Diagram }}>
        {'```mermaid\ngraph TD\nA-->B\n```\n\nNext:\n\n```mermaid\ngraph LR\nC-'}
      </Markdown>,
    )
    expect(html).toContain('data-diagram="done">graph TD')
    expect(html).toContain('data-diagram="growing">graph LR\nC-</div>')
  })
})
