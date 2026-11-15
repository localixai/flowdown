/**
 * A document with link reference definitions, read block by block: each block finds the
 * definitions of the others, a block is drawn again only when what it refers to changed, and a
 * reply that streams through one document is, at every prefix, what a fresh one makes of it.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { linkedDocument } from '../../test/lines'
import { createBlockSplitter, splitBlocks } from '../core/blocks'
import { closePartialMarkdown } from '../core/heal'
import { definitions, parse, toText } from '../engine'
import type { Node } from '../engine/types'
import { createTerminalView, lineText } from '../tui'
import { createDocument } from './index'

const DOCUMENT = [
  'See [the docs][docs] and [the guide].',
  'Nothing is referred to here.',
  'An [inline](https://example.com/inline) link, and [the docs][docs] again.',
  '[docs]: https://example.com/docs "The docs"\n[the guide]: https://example.com/guide',
].join('\n\n')

/** The addresses of a tree's links, in order. */
const links = (root: Node): string[] => {
  const found: string[] = []
  const walk = (node: Node): void => {
    if (node.type === 'link' && node.url !== undefined) found.push(node.url)
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return found
}

describe('link definitions across blocks', () => {
  test('without `refs` a document that has them is one block, with it as many as any other', () => {
    expect(createDocument().update(DOCUMENT).blocks).toHaveLength(1)
    expect(splitBlocks(DOCUMENT)).toHaveLength(1)
    // The definitions leave nothing drawn: they are with the block above them.
    const { blocks } = createDocument({ refs: true }).update(DOCUMENT)
    expect(blocks.map((block) => block.source.trim().split('\n')[0])).toEqual([
      'See [the docs][docs] and [the guide].',
      'Nothing is referred to here.',
      'An [inline](https://example.com/inline) link, and [the docs][docs] again.',
    ])
    expect(blocks.map((block) => block.source).join('')).toBe(DOCUMENT)
  })

  test('a block parsed with its `refs` finds a definition written in another', () => {
    const { blocks } = createDocument({ refs: true }).update(DOCUMENT)
    const found = blocks.flatMap((block) => links(parse(block.source, { refs: block.refs })))
    expect(found).toEqual(links(parse(DOCUMENT)))
    expect(found).toContain('https://example.com/guide')
    // Text with no `[` asks for nothing, and is handed nothing.
    expect(blocks[1]!.refs).toBeUndefined()
  })

  test('the first definition of a label counts, whichever block holds it', () => {
    const text = '[a]: /first\n\nSee [a].\n\n> [a]: /second\n> [b]: /quoted\n\nAnd [b].'
    const { blocks } = createDocument({ refs: true }).update(text)
    const found = blocks.flatMap((block) => links(parse(block.source, { refs: block.refs })))
    expect(found).toEqual(['/first', '/quoted'])
    expect(found).toEqual(links(parse(text)))
  })

  test('a definition that arrives redraws the blocks that asked for it, and no other', () => {
    const doc = createDocument({ refs: true })
    const draw = (text: string) => {
      const { blocks } = doc.update(text)
      for (const block of blocks) parse(block.source, { refs: block.refs })
      return blocks
    }
    const text = 'Uses [one].\n\nUses [two].\n\nUses [an inline](/link) only.\n\nThe end.'
    const before = draw(text)
    const comment = draw(`${text}\n\n[//]: # (a comment)`)
    // Nobody asked for `//`: every block above is the object it was.
    expect(comment.slice(0, 3)).toEqual(before.slice(0, 3))
    for (const index of [0, 1, 2]) expect(comment[index]).toBe(before[index]!)
    const defined = draw(`${text}\n\n[//]: # (a comment)\n[two]: /two`)
    expect(defined[0]).toBe(before[0]!)
    expect(defined[1]).not.toBe(before[1]!)
    expect(defined[2]).toBe(before[2]!)
    expect(links(parse(defined[1]!.source, { refs: defined[1]!.refs }))).toEqual(['/two'])
    // The same definition, its block longer: nothing above is drawn again.
    const longer = draw(`${text}\n\n[//]: # (a comment)\n[two]: /two\n[three]: /three`)
    for (const index of [0, 1, 2]) expect(longer[index]).toBe(defined[index]!)
    // Its address changed: the block that uses it is another object again.
    const moved = draw(`${text}\n\n[//]: # (a comment)\n[two]: /elsewhere`)
    expect(moved[0]).toBe(before[0]!)
    expect(moved[1]).not.toBe(defined[1]!)
  })

  test('a block that grows keeps its `refs`, until what it refers to changes', () => {
    const doc = createDocument({ refs: true })
    const last = (text: string) => {
      const { blocks } = doc.update(text, { streaming: true })
      const block = blocks.at(-1)!
      parse(block.source, { refs: block.refs })
      return block
    }
    // A table that gains a row with each update: a new block every time, the same `refs`, so a
    // renderer that draws it in pieces draws the last piece only.
    const head = 'Above.\n\n| a | b |\n| - | - |\n'
    const first = last(`${head}| 1 | [one] |\n`)
    const second = last(`${head}| 1 | [one] |\n| 2 | [two] |\n`)
    expect(second).not.toBe(first)
    expect(second.refs).toBe(first.refs!)
    // A definition it asked for arrives in a block below: it is told anew.
    const defined = doc.update(`${head}| 1 | [one] |\n| 2 | [two] |\n\nBelow.\n\n[two]: /two`)
    const table = defined.blocks[1]!
    expect(table.source.startsWith('| a | b |')).toBe(true)
    expect(table.refs).not.toBe(first.refs!)
    expect(links(parse(table.source, { refs: table.refs }))).toEqual(['/two'])
  })

  test('the definitions of a text are read without parsing what it says', () => {
    const found = definitions(
      '[A  b]: <one> "t"\n\n> [c]: two\n\n```\n[d]: no\n```\n\n$$\n\n[e]: /e\n\n$$',
    )
    expect([...found]).toEqual([
      ['A B', { url: 'one', title: 't' }],
      ['C', { url: 'two', title: '' }],
      ['E', { url: '/e', title: '' }],
    ])
    // Where `$$` fences a formula, what is written inside one is the formula.
    expect([...definitions('$$\n\n[e]: /e\n\n$$', { mathFences: true }).keys()]).toEqual([])
  })
})

describe('a reply with link definitions streamed through one document', () => {
  const count = Number(process.env.FUZZ ?? 150)

  test('the remembered split is a fresh split, at every prefix', () => {
    for (let seed = 1; seed <= count; seed += 1) {
      const text = linkedDocument(seed)
      const splitter = createBlockSplitter({ refs: true })
      for (const prefix of prefixes(text, 'token', seed)) {
        const healed = closePartialMarkdown(prefix)
        expect(splitter.split(healed), JSON.stringify(healed)).toEqual(
          splitBlocks(healed, { refs: true }),
        )
      }
    }
  })

  test('a definition at the top does not make every update read the whole reply', () => {
    // Counted, not timed: the characters the split scans over a whole stream.
    const scanned = (paragraphs: number, refs: boolean): number => {
      const text =
        '[docs]: https://example.com/docs\n\n' +
        'A paragraph that refers to [the docs][docs].\n\n'.repeat(paragraphs)
      const splitter = createBlockSplitter({ refs })
      for (const prefix of prefixes(text, 'frame')) splitter.split(prefix)
      return splitter.lexed / text.length
    }
    // A few times the text, however long it is; kept whole, hundreds of times, and more as it grows.
    expect(scanned(200, true)).toBeLessThan(4)
    expect(scanned(800, true)).toBeLessThan(4)
    expect(scanned(200, false)).toBeGreaterThan(200)
    expect(scanned(800, false)).toBeGreaterThan(800)
  })

  test('what is drawn is what a fresh document draws, at every prefix', () => {
    const rows = (lines: ReturnType<ReturnType<typeof createTerminalView>['render']>) =>
      lines.map(lineText).join('\n')
    for (let seed = 1; seed <= count; seed += 1) {
      const text = linkedDocument(seed)
      const view = createTerminalView()
      for (const prefix of [...prefixes(text, 'token', seed), text]) {
        const streamed = rows(view.render(prefix, { streaming: true }))
        const fresh = rows(createTerminalView().render(prefix, { streaming: true }))
        expect(streamed, JSON.stringify(prefix)).toBe(fresh)
      }
      expect(rows(view.render(text))).toBe(rows(createTerminalView().render(text)))
    }
  })
})

// `toText` is the plain text of a tree: a reference that resolved reads as its text either way.
test('a reference with no definition anywhere stays text', () => {
  const { blocks } = createDocument({ refs: true }).update('See [nothing][none].\n\n[other]: /o')
  expect(toText(parse(blocks[0]!.source, { refs: blocks[0]!.refs }))).toContain('[nothing][none]')
})
