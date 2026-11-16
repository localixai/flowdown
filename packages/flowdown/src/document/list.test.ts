/**
 * A long list read in pieces is the list one parse of it reads, node for node and place for
 * place, at every step of a stream; a list that cannot be cut so is read whole.
 */
import { expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { seeded, type Random } from '../../test/random'
import { mathSyntax } from '../core/math-syntax'
import { flowdownDialect } from '../core/remark-answer-blocks'
import { parse } from '../engine'
import type { Node } from '../engine/types'
import { createDocument } from './index'
import { createListReader, LIST_ITEMS } from './list'

const extensions = [flowdownDialect, mathSyntax]
const read = (text: string): Node => parse(text, { extensions })

const WORDS = 'the cache request worker session token reply stream block parser layout'.split(' ')
const words = (r: Random, count = r.int(2, 9)) =>
  Array.from({ length: count }, () => r.pick(WORDS)).join(' ')

/** One item's text, its marker included, as an agent writes them. */
function item(r: Random, marker: string): string {
  const pad = ' '.repeat(marker.length + 1)
  switch (r.int(0, 11)) {
    case 0:
      return `${marker} [${r.pick([' ', 'x'])}] ${words(r)}`
    case 1:
      return `${marker} **${words(r, 2)}**: ${words(r)} \`${r.pick(WORDS)}()\``
    case 2:
      return `${marker} ${words(r)}\n${pad}- ${words(r)}\n${pad}- ${words(r)}`
    case 3:
      return `${marker} ${words(r)}:\n${pad}\`\`\`ts\n${pad}const ${r.pick(WORDS)} = ${r.int(0, 99)}\n${pad}\`\`\``
    case 4:
      return `${marker} [${words(r, 2)}](https://example.com/${r.pick(WORDS)}) and $x^${r.int(2, 9)}$ costs $${r.int(1, 99)}`
    case 5:
      return `${marker} ${words(r)}\n${pad}${words(r)}`
    case 6:
      return `${marker} <b>${words(r, 2)}</b> ${words(r)}`
    case 7:
      return `${marker} ${words(r)} _${r.pick(WORDS)}_ ~~${r.pick(WORDS)}~~`
    default:
      return `${marker} ${words(r)}`
  }
}

/** A long list, now and then with what keeps it from being cut. */
function list(seed: number): string {
  const r = seeded(seed)
  const ordered = r.next() < 0.4
  const delimiter = r.pick(['.', ')'])
  const bullet = r.pick(['-', '*', '+'])
  const start = r.int(1, 3)
  const items = Array.from({ length: r.int(LIST_ITEMS - 2, LIST_ITEMS * 4) }, (_, at) =>
    item(r, ordered ? `${start + at}${delimiter}` : bullet),
  )
  // One in a few has a lazy line, a blank line, another marker or a rule somewhere.
  if (r.next() < 0.25) {
    const at = r.int(1, items.length - 1)
    items[at] = r.pick([
      `${items[at]}\na lazy line`,
      `\n${items[at]}`,
      `${ordered ? '-' : '1.'} ${words(r)}`,
      '- - -',
    ])
  }
  return `${items.join('\n')}\n`
}

test('a list read in pieces is the list one parse reads, at every step of a stream', () => {
  let cut = 0
  let steps = 0
  for (let seed = 1; seed <= 120; seed++) {
    const markdown = list(seed)
    const doc = createDocument({ refs: true })
    const reader = createListReader()
    for (const prefix of prefixes(markdown, seed % 2 ? 'token' : 'frame', seed)) {
      const { blocks, closer } = doc.update(prefix, { streaming: true, math: true })
      const block = blocks.at(-1)
      if (!block) continue
      const source = block.source + closer
      const pieced = reader.read(block.source, closer, read, 'scope')
      steps++
      if (pieced === null) continue
      cut++
      expect(JSON.stringify(pieced)).toBe(JSON.stringify(read(source)))
    }
  }
  // The pieces are what most steps of a long list are read as.
  expect(cut).toBeGreaterThan(steps / 3)
})

test('what keeps a list from being cut', () => {
  const items = (count: number, marker = '-') =>
    Array.from({ length: count }, (_, at) => `${marker} item ${at}`).join('\n')
  const reader = () => createListReader()
  // Long enough, and nothing in the way.
  expect(reader().read(items(LIST_ITEMS + 1), '', read, 0)).not.toBeNull()
  // Short enough to read whole.
  expect(reader().read(items(LIST_ITEMS), '', read, 0)).toBeNull()
  // A blank line, a lazy line, another marker, a rule, a definition, a footnote.
  for (const breaking of ['', 'lazy', '+ other', '- - -', '[a]: /u', 'see[^1]'])
    expect(
      reader().read(`${items(10)}\n${breaking}\n${items(10)}`, '', read, 0),
      JSON.stringify(breaking),
    ).toBeNull()
})

test('a piece is read again only when its text, its place or its scope changed', () => {
  const asked: string[] = []
  const counted = (text: string) => {
    asked.push(text)
    return read(text)
  }
  const reader = createListReader()
  const lines = Array.from({ length: LIST_ITEMS * 3 }, (_, at) => `- item ${at}`)
  const text = (count: number) => `${lines.slice(0, count).join('\n')}\n`
  reader.read(text(LIST_ITEMS * 2 + 1), '', counted, 'a')
  asked.length = 0
  reader.read(text(LIST_ITEMS * 2 + 2), '', counted, 'a')
  // Two complete pieces kept, the last one read again.
  expect(asked).toEqual([`${lines.slice(LIST_ITEMS * 2, LIST_ITEMS * 2 + 2).join('\n')}\n`])
  asked.length = 0
  reader.read(text(LIST_ITEMS * 2 + 2), '', counted, 'b')
  expect(asked).toHaveLength(3)
})
