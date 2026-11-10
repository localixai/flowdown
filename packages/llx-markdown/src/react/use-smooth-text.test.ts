import { describe, expect, test } from 'bun:test'
import { advance, showable, wordEnd, type Pace } from './use-smooth-text'

/** Run the pacer over `text` in 30 ms steps until it stands still. */
function run(text: string, settled: boolean, from = 0, catchUp = 240): number[] {
  const seen: number[] = []
  let pace: Pace = { shown: from, speed: 0 }
  for (let step = 0; step < 400; step++) {
    const next = advance(text, pace, 30, catchUp, settled)
    if (next.shown === pace.shown && next.speed === 0) break
    if (next.shown !== pace.shown) seen.push(next.shown)
    pace = next
  }
  return seen
}

const TEXT = 'The quick brown fox jumps over the lazy dog and keeps on running far away. '

describe('pacing a streamed text', () => {
  test('shows all of a finished text, in more than one step', () => {
    const seen = run(TEXT.repeat(4), true)
    expect(seen.at(-1)).toBe(TEXT.length * 4)
    expect(seen.length).toBeGreaterThan(4)
  })

  test('never goes back and never past what has arrived', () => {
    const text = TEXT.repeat(3)
    const seen = run(text, true)
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!)
    expect(Math.max(...seen)).toBe(text.length)
  })

  test('stops only between words', () => {
    const text = TEXT.repeat(3)
    for (const at of run(text, true)) expect(at === text.length || text[at - 1] === ' ').toBe(true)
  })

  test('holds back the word that is still being typed', () => {
    const text = 'Rolling back the depl'
    expect(showable(text, false)).toBe('Rolling back the '.length)
    expect(run(text, false).at(-1)).toBe('Rolling back the '.length)
    expect(run(text, true).at(-1)).toBe(text.length)
  })

  test('does not wait for a long token', () => {
    const url = `see https://example.com/${'a'.repeat(60)}`
    expect(showable(url, false)).toBe(url.length)
    expect(run(url, false).at(-1)).toBe(url.length)
  })

  test('a burst speeds the flow up gradually, not in one step', () => {
    const seen = run(TEXT.repeat(20), true)
    const steps = seen.map((at, i) => at - (seen[i - 1] ?? 0))
    expect(steps[0]!).toBeLessThan(TEXT.length)
    expect(Math.max(...steps)).toBeLessThan((TEXT.length * 20) / 3)
  })

  test('text without spaces stops at any character, and never inside a surrogate pair', () => {
    const cjk = '日本語のテキストは空白なしで書かれます。'.repeat(3)
    expect(run(cjk, true).at(-1)).toBe(cjk.length)
    const emoji = 'ok 👍👍👍👍👍👍👍👍👍👍👍👍👍👍👍👍 done'
    for (const at of run(emoji, true)) {
      const code = emoji.charCodeAt(at)
      expect(code >= 0xdc00 && code <= 0xdfff).toBe(false)
    }
  })

  test('wordEnd runs to the end of the word and over the spaces after it', () => {
    expect(wordEnd('hello  world', 2, 12)).toBe(7)
    expect(wordEnd('hello world', 5, 11)).toBe(6)
    expect(wordEnd('hello', 2, 5)).toBe(5)
  })
})
