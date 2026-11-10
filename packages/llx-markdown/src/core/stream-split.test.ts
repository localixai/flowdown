/**
 * The splitter a streaming reply goes through remembers the blocks it cut last time and lexes
 * only the end again. Its blocks must be exactly those of a fresh split, at every prefix of
 * every reply, and the work it does must grow with the reply's length, not with its square.
 * Everything here is deterministic: seeded replies, seeded chunks, counted characters.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { CORPUS } from '../../test/corpus'
import { heavyDescribe } from '../../test/heavy'
import { scaling, scenarios } from '../../test/replies'
import { createBlockSplitter, splitBlocks } from './blocks'
import { closePartialMarkdown } from './heal'

const replies = [
  ...Object.entries(CORPUS).map(([name, text]) => ({ name, text })),
  ...scenarios()
    .filter((s) => !s.history)
    .map((s) => ({ name: s.name, text: s.text.slice(0, 12_000) })),
]

heavyDescribe('a remembered split is a fresh split', () => {
  for (const { name, text } of replies) {
    test(`${name}, every prefix`, () => {
      const splitter = createBlockSplitter()
      for (const prefix of prefixes(text, 'token')) {
        expect(splitter.split(prefix)).toEqual(splitBlocks(prefix))
      }
    })

    test(`${name}, every prefix as the renderer sees it, healed`, () => {
      const splitter = createBlockSplitter()
      for (const prefix of prefixes(text, 'frame')) {
        const healed = closePartialMarkdown(prefix)
        expect(splitter.split(healed)).toEqual(splitBlocks(healed))
      }
    })
  }
})

describe('a remembered split is a fresh split', () => {
  test('a text that is not the last one grown is split afresh', () => {
    const splitter = createBlockSplitter()
    const [first, second] = [scenarios()[1]!.text, scenarios()[2]!.text]
    splitter.split(first)
    expect(splitter.split(second)).toEqual(splitBlocks(second))
    // A regenerated reply: the same start, then something else.
    const regenerated = `${first.slice(0, 4_000)}\n\nA different ending.`
    expect(splitter.split(regenerated)).toEqual(splitBlocks(regenerated))
    expect(splitter.split('')).toEqual(splitBlocks(''))
  })

  test('the blocks that did not change are the same objects, so a renderer can skip them', () => {
    const splitter = createBlockSplitter()
    const text = scenarios()[1]!.text
    const before = splitter.split(text.slice(0, 8_000))
    const after = splitter.split(text.slice(0, 8_040))
    const kept = after.filter((block) => before.includes(block))
    expect(kept.length).toBeGreaterThanOrEqual(before.length - 2)
  })
})

describe('the work of a stream grows with its length', () => {
  const lexed = (text: string) => {
    const splitter = createBlockSplitter()
    for (const prefix of prefixes(text, 'frame')) splitter.split(prefix)
    return splitter.lexed
  }

  test('an update to a reply four times longer costs about the same, not four times more', () => {
    const [small, large] = scaling()
    const perUpdate = (text: string) => lexed(text) / prefixes(text, 'frame').length
    // Linear: the cost of an update is the end of the reply, the same at any length (ratio ≈ 1).
    // Quadratic: it is the whole reply, four times more (ratio ≈ 4).
    expect(perUpdate(large.text) / perUpdate(small.text)).toBeLessThan(2)
  })

  test('each update lexes the end of the reply, not all of it', () => {
    const [, large] = scaling()
    const updates = prefixes(large.text, 'frame').length
    // Lexing every prefix whole would be about length × updates / 2.
    const whole = (large.text.length * updates) / 2
    expect(lexed(large.text)).toBeLessThan(whole / 10)
  })

  test('a reply with Windows line endings is remembered as well as one with \\n', () => {
    const [, large] = scaling()
    const crlf = large.text.replace(/\n/g, '\r\n')
    expect(lexed(crlf)).toBeLessThan(lexed(large.text) * 1.5)
  })
})

describe('Windows line endings', () => {
  test('split into the blocks of the same text with \\n', () => {
    for (const { name, text: given } of replies) {
      const text = given.replace(/\r\n/g, '\n')
      const crlf = text.replace(/\n/g, '\r\n')
      expect(
        splitBlocks(crlf).map((b) => b.source),
        name,
      ).toEqual(splitBlocks(text).map((b) => b.source))
    }
  })
})
