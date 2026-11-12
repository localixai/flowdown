import { expect, test } from 'bun:test'
import { continues } from './continues'

test('a text that grew continues the last one', () => {
  expect(continues('abcdef', 'abc', 3)).toBe(true)
  expect(continues('abc', 'abc', 3)).toBe(true)
  expect(continues('abc', 'abc', 0)).toBe(true)
})

test('a text that changed, or is shorter than what was read, does not', () => {
  expect(continues('abXdef', 'abc', 3)).toBe(false)
  expect(continues('ab', 'abc', 3)).toBe(false)
  // Only what was read is compared: the last line may have been rewritten.
  expect(continues('abXdef', 'abc', 2)).toBe(true)
})

test('what is before `from` is not compared: the caller has checked it', () => {
  expect(continues('Xbcdef', 'abc', 3, 1)).toBe(true)
  expect(continues('XbYdef', 'abc', 3, 1)).toBe(false)
})

test('a place past the end of the last text is not one it reached', () => {
  expect(continues('abcdef', 'abc', 5)).toBe(false)
})

test('says what startsWith said, for every prefix of two texts that part ways', () => {
  const before = 'const a = "→ значение"\nlet b = 2\n'
  const after = 'const a = "→ значение"\nlet c = 3\nmore'
  for (let upTo = 0; upTo <= before.length; upTo++)
    for (let from = 0; from <= upTo; from++)
      expect(continues(after, before, upTo, from)).toBe(
        after.length >= upTo && after.startsWith(before.slice(from, upTo), from),
      )
})
