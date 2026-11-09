import { describe, expect, test } from 'bun:test'
import { parseFrontMatter } from './frontmatter'

describe('parseFrontMatter', () => {
  test('reads flat keys, unquotes values and returns the Markdown after the block', () => {
    const { data, body } = parseFrontMatter(
      '---\ntitle: "Streaming"\ndescription: How a reply renders: block by block\n---\n\n# Streaming\n',
    )
    expect(data).toEqual({ title: 'Streaming', description: 'How a reply renders: block by block' })
    expect(body).toBe('# Streaming\n')
  })

  test('a page without front matter is all body', () => {
    expect(parseFrontMatter('# Title\n\n---\n\ntext')).toEqual({
      data: {},
      body: '# Title\n\n---\n\ntext',
    })
  })
})
