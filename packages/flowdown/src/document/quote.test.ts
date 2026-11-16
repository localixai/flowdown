/**
 * A long quote read in pieces is the quote one parse of it reads, node for node and place for
 * place, at every step of a stream; a quote that cannot be cut so is read whole.
 */
import { expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { seeded, type Random } from '../../test/random'
import { mathSyntax } from '../core/math-syntax'
import { flowdownDialect } from '../core/remark-answer-blocks'
import { parse } from '../engine'
import type { Node } from '../engine/types'
import { createDocument } from './index'
import { createQuoteReader, QUOTE_BLOCKS } from './quote'

const extensions = [flowdownDialect, mathSyntax]
const read = (text: string): Node => parse(text, { extensions })

const WORDS = 'the cache request worker session token reply stream block parser layout'.split(' ')
const words = (r: Random, count = r.int(3, 12)) =>
  Array.from({ length: count }, () => r.pick(WORDS)).join(' ')

/** One block inside a quote, its lines without the quote's marks. */
function block(r: Random): string {
  switch (r.int(0, 9)) {
    case 0:
      return `${words(r)}\n${words(r)}`
    case 1:
      return `- ${words(r)}\n- ${words(r)}\n  - ${words(r)}`
    case 2:
      // A fence with a blank line in it: the blank line parts nothing.
      return `\`\`\`ts\nconst ${r.pick(WORDS)} = 1\n\nconst ${r.pick(WORDS)} = 2\n\`\`\``
    case 3:
      return `> ${words(r)}\n> ${words(r)}`
    case 4:
      return `### ${words(r, 3)}`
    case 5:
      return `| a | b |\n| - | - |\n| ${r.pick(WORDS)} | ${r.int(0, 9)} |`
    case 6:
      return `$$\nx^${r.int(2, 9)} + \\frac{1}{${r.int(2, 9)}}\n$$`
    case 7:
      return `**${words(r, 2)}** and \`${r.pick(WORDS)}()\` with [a link](https://example.com) and $${r.int(1, 99)}`
    case 8:
      return `1. ${words(r)}\n2. ${words(r)}`
    default:
      return words(r)
  }
}

/** A long quote: a callout or a plain one, now and then with what keeps it from being cut. */
function quote(seed: number): string {
  const r = seeded(seed)
  const blocks = Array.from({ length: r.int(QUOTE_BLOCKS - 2, QUOTE_BLOCKS * 4) }, () => block(r))
  if (r.next() < 0.5)
    blocks[0] = `[!${r.pick(['NOTE', 'TIP', 'WARNING'])}] ${words(r, 3)}\n${blocks[0]}`
  if (r.next() < 0.2) {
    const at = r.int(1, blocks.length - 1)
    blocks[at] = r.pick([
      `${blocks[at]}\nlazy`,
      `— Someone`,
      `<details>\n\ninside\n\n</details>`,
      `[!TIP] nested`,
      `[a]: /u`,
    ])
  }
  const marked = blocks
    .join('\n\n')
    .split('\n')
    .map((line) => (line === 'lazy' ? line : line ? `> ${line}` : '>'))
  return `${marked.join('\n')}\n`
}

test('a quote read in pieces is the quote one parse reads, at every step of a stream', () => {
  let cut = 0
  let steps = 0
  for (let seed = 1; seed <= 120; seed++) {
    const markdown = quote(seed)
    const doc = createDocument({ refs: true })
    const reader = createQuoteReader()
    for (const prefix of prefixes(markdown, seed % 2 ? 'token' : 'frame', seed)) {
      const { blocks, closer } = doc.update(prefix, { streaming: true, math: true })
      const last = blocks.at(-1)
      if (!last) continue
      const source = last.source + closer
      const pieced = reader.read(last.source, closer, read, 'scope')
      steps++
      if (pieced === null) continue
      cut++
      expect(JSON.stringify(pieced)).toBe(JSON.stringify(read(source)))
    }
  }
  expect(cut).toBeGreaterThan(steps / 4)
})

test('what keeps a quote from being cut', () => {
  const blocks = (count: number) =>
    Array.from({ length: count }, (_, at) => `> paragraph ${at}`).join('\n>\n')
  const reader = () => createQuoteReader()
  expect(reader().read(blocks(QUOTE_BLOCKS + 1), '', read, 0)).not.toBeNull()
  expect(
    reader().read(`> [!NOTE] Title\n>\n${blocks(QUOTE_BLOCKS + 1)}`, '', read, 0),
  ).not.toBeNull()
  expect(reader().read(blocks(QUOTE_BLOCKS), '', read, 0)).toBeNull()
  for (const breaking of ['lazy', '> — Someone', '> <div>', '> [!TIP] x', '> [a]: /u', '>\tx'])
    expect(
      reader().read(`${blocks(6)}\n>\n${breaking}\n>\n${blocks(6)}`, '', read, 0),
      JSON.stringify(breaking),
    ).toBeNull()
  // A form that takes what follows its marker is the whole quote's.
  expect(reader().read(`> [!STEPS] Do\n>\n${blocks(QUOTE_BLOCKS + 1)}`, '', read, 0)).toBeNull()
})
