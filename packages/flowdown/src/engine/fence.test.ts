import { describe, expect, test } from 'bun:test'
import { parse } from './index'
import type { Node } from './types'

/** The code blocks of a document: language, text, and the lines they span. */
const codes = (markdown: string) =>
  (parse(markdown).children ?? [])
    .filter((node: Node) => node.type === 'code')
    .map((node: Node) => ({
      lang: node.lang,
      value: node.value,
      lines: [node.position?.start.line, node.position?.end.line],
    }))

// A fenced block at the top of the document takes its lines in one cut of the text, not line by
// line (`takeFencedLines`). These hold what the long way gives, where the two could part.
describe('a fenced code block at the top of the document', () => {
  test('its lines are kept as written: indentation, tabs, blank lines', () => {
    const body = 'a\n  two\n    four\n\tTab\n\n   \nlast'
    expect(codes(`\`\`\`js\n${body}\n\`\`\`\n`)).toEqual([
      { lang: 'js', value: `${body}\n`, lines: [1, 9] },
    ])
  })

  test('other line endings become line feeds', () => {
    const lf = codes('```\na\n\nb\n```\nafter\n')
    expect(lf).toEqual([{ lang: undefined, value: 'a\n\nb\n', lines: [1, 5] }])
    expect(codes('```\r\na\r\n\r\nb\r\n```\r\nafter\r\n')).toEqual(lf)
    expect(codes('```\ra\r\rb\r```\rafter\r')).toEqual(lf)
    expect(codes('```\na\r\n\rb\n```\nafter')).toEqual(lf)
  })

  test('a line that only looks like a closing fence is code', () => {
    // An info string, too few characters, the other character, four spaces of indent, a tab.
    const body = '```js\n``\n~~~\n    ```\n\t```\ntext ```'
    expect(codes(`\`\`\`\`\n${body}\n\`\`\`\`\n`)).toEqual([
      { lang: undefined, value: `${body}\n`, lines: [1, 8] },
    ])
  })

  test('up to three spaces before the closing fence close it, and a longer fence does', () => {
    for (const close of ['```', ' ```', '  ```', '   ```', '`````', '```   ', '```\t'])
      expect(codes(`\`\`\`\na\n${close}\nb\n`)).toEqual([
        { lang: undefined, value: 'a\n', lines: [1, 3] },
      ])
  })

  test('an unclosed fence runs to the end, with or without a final line ending', () => {
    expect(codes('```ts\na\nb')).toEqual([{ lang: 'ts', value: 'a\nb\n', lines: [1, 3] }])
    expect(codes('```ts\na\nb\n')).toEqual([{ lang: 'ts', value: 'a\nb\n', lines: [1, 3] }])
    expect(codes('```ts\n')).toEqual([{ lang: 'ts', value: '', lines: [1, 1] }])
    expect(codes('```ts')).toEqual([{ lang: 'ts', value: '', lines: [1, 1] }])
  })

  test('a NUL in the document is still replaced inside the code', () => {
    expect(codes('```\na\u0000b\nc\n```\n')[0]?.value).toBe('a�b\nc\n')
  })

  test('what follows the block is read as Markdown again', () => {
    const tree = parse('```\na\n```\n# Title\n\n~~~\nb\n~~~\ntext\n')
    expect((tree.children ?? []).map((node) => node.type)).toEqual([
      'code',
      'heading',
      'code',
      'paragraph',
    ])
    expect(tree.children?.[1]?.position?.start.line).toBe(4)
    expect(tree.children?.[3]?.position?.start).toEqual({ line: 9, column: 1, offset: 29 })
  })

  test('an indented fence and a fence inside a container strip their prefix', () => {
    expect(codes('  ```\n  a\n    b\n c\n  ```\n')[0]?.value).toBe('a\n  b\nc\n')
    const quote = parse('> ```\n> a\n>  b\n> ```\n').children?.[0]
    expect(quote?.children?.[0]?.value).toBe('a\n b\n')
    const item = parse('- ```\n  a\n   b\n  ```\n').children?.[0]?.children?.[0]
    expect(item?.children?.[0]?.value).toBe('a\n b\n')
  })
})
