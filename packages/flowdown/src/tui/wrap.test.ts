/**
 * A line wrapped again from its last rows, as a paragraph that grows is, is the line wrapped from
 * its start: row for row, at every step.
 */
import { expect, test } from 'bun:test'
import { seeded } from '../../test/random'
import { BOLD, CODE, DIM, lineText, PLAIN, type Line, type Style } from './style'
import { forgetWrapped, NO_BREAK, wrap } from './wrap'

const WORDS = [
  'the',
  'cache',
  'request',
  'a',
  'worker',
  'session-token',
  'é',
  '漢字',
  'x',
  'reply,',
  '(b)',
]
const STYLES: Style[] = [PLAIN, BOLD, CODE, DIM, { underline: true }]

const drawn = (rows: Line[]) =>
  rows.map((row) =>
    row.map((span) => `${span.text}\u0002${JSON.stringify(span.style)}`).join('\u0003'),
  )

test('a growing line wrapped from its last rows is the line wrapped whole', () => {
  let steps = 0
  for (let seed = 1; seed <= 120; seed++) {
    const r = seeded(seed)
    const columns = r.pick([80, 40, 17, 9, 3])
    const first: Line = r.next() < 0.5 ? [] : [{ text: '• ', style: DIM }]
    const rest: Line = first.length ? [{ text: '  ', style: PLAIN }] : []
    const spans: Line = []
    // A line that grows a few characters at a time, its spans now and then in another style.
    let text = ''
    for (let n = 0; n < 120; n++) {
      const piece =
        r.next() < 0.05
          ? 'w'.repeat(r.int(10, 60))
          : `${r.pick(WORDS)}${r.pick([' ', ' ', ' ', NO_BREAK, ''])}`
      for (let at = 0; at < piece.length; at += r.int(1, 4)) {
        text = piece.slice(at, at + 4)
        if (spans.length === 0 || r.next() < 0.08) spans.push({ text, style: r.pick(STYLES) })
        else spans[spans.length - 1] = { ...spans.at(-1)!, text: spans.at(-1)!.text + text }
        const line = spans.map((span) => ({ ...span }))
        const again = wrap(line, columns, first, rest)
        forgetWrapped()
        const whole = wrap(line, columns, first, rest)
        expect(drawn(again)).toEqual(drawn(whole))
        // The next step goes on from this one, as a stream does.
        wrap(line, columns, first, rest)
        steps++
      }
    }
  }
  expect(steps).toBeGreaterThan(8_000)
}, 60_000)

test('the rows of what did not change are the very rows of the last wrap', () => {
  forgetWrapped()
  const line = (count: number): Line => [
    { text: Array.from({ length: count }, (_, at) => `word${at}`).join(' '), style: PLAIN },
  ]
  const before = wrap(line(60), 30, [], [])
  const after = wrap(line(61), 30, [], [])
  expect(after.length).toBeGreaterThanOrEqual(before.length)
  for (let at = 0; at < before.length - 2; at++) expect(after[at]).toBe(before[at]!)
  expect(after.map(lineText).join(' ')).toBe(line(61)[0]!.text)
})
