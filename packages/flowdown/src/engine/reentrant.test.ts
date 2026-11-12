import { describe, expect, test } from 'bun:test'
import { parse } from './index'
import type { Extension, Node } from './types'

/** `{{…}}`: the text between is Markdown of its own, parsed by a parse inside the parse. */
const nested: Extension = {
  name: 'nested',
  inline: [
    {
      chars: '{',
      parse(state) {
        if (!state.text.startsWith('{{', state.pos)) return false
        // The `}}` that closes this one: those between belong to the ones opened inside.
        let close = -1
        for (let at = state.pos + 2, open = 1; at < state.text.length - 1; at++) {
          const pair = state.text.slice(at, at + 2)
          if (pair === '{{') open++
          else if (pair === '}}' && --open === 0) {
            close = at
            break
          }
          if (pair === '{{' || pair === '}}') at++
        }
        if (close === -1) return false
        const inner = parse(state.text.slice(state.pos + 2, close), { extensions: [nested] })
        const paragraph = inner.children?.[0]
        state.push({ type: 'nested', children: paragraph?.children ?? [] })
        state.pos = close + 2
        return true
      },
    },
  ],
}

const types = (node: Node): unknown =>
  node.children ? [node.type, ...node.children.map(types)] : (node.value ?? node.type)

describe('a parse started from inside a rule', () => {
  test('leaves the parse around it where it was', () => {
    const tree = parse('Before *one* {{inner **bold** and `code`}} after *two* [link](/x).', {
      extensions: [nested],
    })
    expect(types(tree)).toEqual([
      'root',
      [
        'paragraph',
        'Before ',
        ['emphasis', 'one'],
        ' ',
        ['nested', 'inner ', ['strong', 'bold'], ' and ', 'code'],
        ' after ',
        ['emphasis', 'two'],
        ' ',
        ['link', 'link'],
        '.',
      ],
    ])
  })

  test('holds through emphasis left open around it and a second level', () => {
    const tree = parse('**open {{a {{b *c*}} d}} closed** and www.example.com', {
      extensions: [nested],
    })
    expect(types(tree)).toEqual([
      'root',
      [
        'paragraph',
        ['strong', 'open ', ['nested', 'a ', ['nested', 'b ', ['emphasis', 'c']], ' d'], ' closed'],
        ' and ',
        ['link', 'www.example.com'],
      ],
    ])
  })

  test('a rule that throws does not leave the parser mid-parse', () => {
    const failing: Extension = {
      name: 'failing',
      inline: [
        {
          chars: '{',
          parse() {
            throw new Error('rule failed')
          },
        },
      ],
    }
    expect(() => parse('a { b', { extensions: [failing] })).toThrow('rule failed')
    expect(types(parse('still *fine*'))).toEqual([
      'root',
      ['paragraph', 'still ', ['emphasis', 'fine']],
    ])
  })
})
