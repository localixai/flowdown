import { expect, test } from 'bun:test'
import { extractHeadings } from 'llx-markdown'
import { buildPages } from './routes'
import { buildSearchIndex, search } from './search'

const pages = buildPages(
  { sections: [{ title: 'Docs', pages: ['streaming.md', 'styling.md'] }] },
  {
    'streaming.md':
      '# Streaming\n\nReplies arrive token by token.\n\n## The caret\n\nA blinking caret follows the text.\n',
    'styling.md':
      '# Styling\n\nSet the tokens.\n\n## Dark mode\n\nThe caret colour follows `--llx-fg`.\n',
  },
)
const index = buildSearchIndex(pages, extractHeadings)

test('a hit links to the heading it is under, title hits first', () => {
  const results = search(index, 'caret')
  expect(results[0]).toMatchObject({
    href: '/streaming/#the-caret',
    title: 'Streaming › The caret',
  })
  expect(results.map((result) => result.href)).toContain('/styling/#dark-mode')
})

test('every word must match, and an empty query finds nothing', () => {
  expect(search(index, 'caret token')).toHaveLength(0)
  expect(search(index, 'dark caret')[0]?.href).toBe('/styling/#dark-mode')
  expect(search(index, '  ')).toEqual([])
})
