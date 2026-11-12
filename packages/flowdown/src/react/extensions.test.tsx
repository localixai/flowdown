/** The examples of docs/remark.md, run: a page's own syntax through `extensions`. */
import { expect, test } from 'bun:test'
import { render } from '../../test/render'
import type { Extension } from '../index'

/** `@name` as a link to the person. */
const mentions: Extension = {
  name: 'mentions',
  inline: [
    {
      chars: '@',
      parse(state) {
        const match = /^@([a-z\d-]+)/i.exec(state.text.slice(state.pos))
        if (!match) return false
        state.push({
          type: 'element',
          data: { hName: 'a', hProperties: { href: `/people/${match[1]}`, className: 'mention' } },
          children: [{ type: 'text', value: match[0] }],
        })
        state.pos += match[0].length
        return true
      },
    },
  ],
}

/** A ```chart fence as the page's own element, and every heading marked. */
const charts: Extension = {
  name: 'charts',
  fences: {
    chart: (node) => ({
      type: 'element',
      data: { hName: 'my-chart', hProperties: { dataSpec: node.value ?? '' } },
    }),
  },
  transform(root) {
    for (const node of root.children ?? [])
      if (node.type === 'heading')
        node.data = { ...node.data, hProperties: { dataDepth: node.depth } }
  },
}

const extensions = [mentions, charts]

test('an inline rule reads a syntax of the page', () => {
  const html = render('Ask @ada-l about it, not a@b.', { extensions })
  expect(html).toContain('<a href="/people/ada-l" class="mention">@ada-l</a>')
  expect(html).toContain('a<a href="/people/b"')
})

test('an inline rule that does not match leaves the text as it is', () => {
  expect(render('Meet @ 5.', { extensions })).toContain('<p>Meet @ 5.</p>')
})

test('a rule is not tried inside code', () => {
  expect(render('`@ada`', { extensions })).toContain('<code>@ada</code>')
})

test('a fence rule replaces the code block, and a page component draws the element', () => {
  expect(render('```chart\nbar 1 2 3\n```', { extensions })).toContain(
    '<my-chart data-spec="bar 1 2 3\n"></my-chart>',
  )
  const Chart = (props: { 'data-spec'?: string }) => <figure>{props['data-spec']?.trim()}</figure>
  const html = render('```chart\nbar 1 2 3\n```', {
    extensions,
    components: { 'my-chart': Chart as never },
  })
  expect(html).toContain('<figure>bar 1 2 3</figure>')
})

test('a transform rewrites the tree of every block', () => {
  const html = render('# One\n\nText.\n\n## Two', { extensions })
  expect(html).toContain('<h1 data-depth="1">One</h1>')
  expect(html).toContain('<h2 data-depth="2">Two</h2>')
})

test('a URL an extension writes passes the same check as a link', () => {
  const unsafe: Extension = {
    name: 'unsafe',
    transform(root) {
      root.children?.push({
        type: 'element',
        data: { hName: 'a', hProperties: { href: 'javascript:alert(1)' } },
        children: [{ type: 'text', value: 'x' }],
      })
    },
  }
  expect(render('Text.', { extensions: [unsafe] })).toContain('<a>x</a>')
})
