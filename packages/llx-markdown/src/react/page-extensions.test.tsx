/**
 * What a host page adds to the dialect: its own remark and rehype plugins, and its own drawing of
 * a diagram or a file tree. A chat app turns `@path` into a file chip, wraps each block in its
 * actions (copy, save) with the block's own Markdown, and shows diagrams in its own viewer.
 */
import { describe, expect, test } from 'bun:test'
import type { Element, Root as HastRoot } from 'hast'
import type { Emphasis, Root as MdastRoot, Text } from 'mdast'
import { renderToStaticMarkup } from 'react-dom/server'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'
import { Markdown, type MarkdownComponents } from '../index'

/** remark: every `@name` in text becomes emphasis, as a mention chip would. */
function remarkMentions() {
  return (tree: MdastRoot) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return
      const parts = node.value.split(/(@\w+)/)
      if (parts.length === 1) return
      parent.children.splice(
        index,
        1,
        ...parts.map((value) =>
          value.startsWith('@')
            ? ({ type: 'emphasis', children: [{ type: 'text', value }] } satisfies Emphasis)
            : ({ type: 'text', value } satisfies Text),
        ),
      )
      return index + parts.length
    })
  }
}

/** rehype: each top-level element carries the Markdown it was drawn from. */
function rehypeBlockSource() {
  return (tree: HastRoot, file: VFile) => {
    const { offset } = file.data.llx ?? { offset: 0 }
    const text = String(file.value)
    for (const node of tree.children) {
      if (node.type !== 'element' || !node.position) continue
      const start = (node.position.start.offset ?? 0) - offset
      const end = (node.position.end.offset ?? 0) - offset
      ;(node as Element).properties.dataMarkdown = text.slice(start, end)
    }
  }
}

const attributes = (html: string) =>
  [...html.matchAll(/data-markdown="([^"]*)"/g)].map((m) =>
    (m[1] ?? '')
      .replaceAll('&quot;', '"')
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
      .replaceAll('&amp;', '&'),
  )

describe('a page’s own plugins', () => {
  test('a remark plugin runs on every block', () => {
    const html = renderToStaticMarkup(
      <Markdown remarkPlugins={[remarkMentions]}>{'Ask @ana\n\nThen @bo'}</Markdown>,
    )
    expect(html).toContain('<em>@ana</em>')
    expect(html).toContain('<em>@bo</em>')
  })

  test('a rehype plugin can read the Markdown each block was drawn from', () => {
    const blocks = [
      '# Title',
      'Costs $5 and $x^2$ here.',
      '- [ ] one\n- [x] two',
      '> [!TIP]\n> Cache it.',
    ]
    const html = renderToStaticMarkup(
      <Markdown rehypePlugins={[rehypeBlockSource]} math={() => import('../math/index')}>
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

  test('a rehype plugin runs after the sanitizer, so what it adds is kept', () => {
    const html = renderToStaticMarkup(
      <Markdown rehypePlugins={[rehypeBlockSource]}>{'<b>bold</b> text'}</Markdown>,
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
