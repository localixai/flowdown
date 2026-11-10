/**
 * A table that is a block of its own is drawn as its header and pieces of rows, each parsed once.
 * What is drawn must be what one parse of the whole table draws, at every point of a stream.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { render } from '../../test/render'
import { seeded } from '../../test/random'
import { tableRows } from './table-rows'

/**
 * The same document through the renderer with an extension of the page's (one that does
 * nothing): the table is then read by one parse, which is what the row-by-row drawing must equal.
 */
const EXTENSIONS = [{ name: 'nothing' }]
const whole = (markdown: string, props: Parameters<typeof render>[1] = {}) =>
  render(markdown, { ...props, extensions: EXTENSIONS })

/** React hoists an image's preload hint to the top of whatever it renders: not part of the table. */
const drawn = (markup: string) => markup.replace(/<link rel="preload"[^>]*>/g, '')

const CELLS = [
  'ok',
  '**bold**',
  '`a|b`',
  '[link](https://example.com)',
  '',
  ' ',
  '~~gone~~',
  'a <b>tag</b>',
  '![i](https://example.com/i.png)',
  'https://example.com/auto',
  '*open',
  '`code',
  '&amp; entity',
  '- not a list',
  '> not a quote',
  '# not a heading',
  '1. x',
  '[^1]',
  '$5 and $6',
  '<br>',
]
const HEADS = [
  '| A | B | C |\n| --- | :-: | --: |',
  '| A | B | C |\n|---|---|---|',
  '|A|B|C|\n|:--|--|--|',
  '   | A | B | C |\n   | - | - | - |',
  '| **A** | `B` | C |\n| --- | --- | --- |',
]

function table(seed: number, rows: number): string {
  const r = seeded(seed)
  const lines = [r.pick(HEADS)]
  for (let row = 0; row < rows; row += 1) {
    const count = r.pick([3, 3, 3, 3, 2, 4, 1])
    const body = Array.from({ length: count }, () => r.pick(CELLS)).join(' | ')
    lines.push(r.pick(['| ', '|', '  | ']) + body + r.pick([' |', '|', ' |  ', '']))
  }
  return lines.join('\n')
}

describe('a table drawn row by row', () => {
  test('is read only when the block is certainly one table', () => {
    expect(tableRows('| a | b |\n| - | - |\n| 1 | 2 |')).toEqual({
      head: '| a | b |\n| - | - |\n',
      rows: ['| 1 | 2 |'],
    })
    for (const not of [
      '| a | b |\n| - | - |', // no rows yet: nothing to cut
      '| a | b |\n| - |\n| 1 | 2 |', // not a table: the delimiter has fewer cells
      '| a | b |\n| - | - |\n| 1 | 2 |\ntext', // a line that is not written as a row
      'a | b\n- | -\n1 | 2', // rows without their opening pipe
      '| a \\| b |\n| - | - |\n| 1 | 2 |', // an escaped pipe in the header
      '| a | b |\n| - | x |\n| 1 | 2 |',
      'Text\n| a | b |\n| - | - |\n| 1 | 2 |',
      '    | a | b |\n    | - | - |\n    | 1 | 2 |',
    ])
      expect(tableRows(not), not).toBeNull()
  })

  test('equals one parse of the whole table, for every shape of row', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const source = table(seed, 1 + (seed % 50))
      expect(tableRows(source), source).not.toBeNull()
      expect(drawn(render(source)), source).toBe(drawn(whole(source)))
    }
  })

  test('equals it at every point of a stream, with text around the table', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const source = `Results:\n\n${table(seed, 40)}\n\nDone.`
      for (const prefix of prefixes(source, 'frame'))
        expect(drawn(render(prefix, { streaming: true })), prefix).toBe(
          drawn(whole(prefix, { streaming: true })),
        )
    }
  })

  test('a page with its own table element or plugins gets the table whole', () => {
    const seen: number[] = []
    const Own = ({ children }: { children?: React.ReactNode }) => {
      seen.push(1)
      return <table data-own="">{children}</table>
    }
    const html = render(table(3, 40), { components: { table: Own } })
    expect(seen.length).toBe(1)
    expect(html.match(/<tbody>/g)?.length).toBe(1)
    expect(html).toContain('data-own')
  })
})
