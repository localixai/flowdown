/**
 * What a reply cannot do to the page that draws it by its shape alone: no depth of nesting
 * overflows the stack, and no repetition takes time that grows faster than the text.
 *
 * Each input here once did one or the other: twenty thousand `>` threw a `RangeError`, and 313 KB
 * of `[a](` took thirteen seconds. The time checks compare a text with one four times as long,
 * so they hold on a slow machine as on a fast one.
 */
import { expect, test } from 'bun:test'
import { parse } from './engine'
import type { Node } from './engine/types'
import { renderToHtml } from './static'
import { renderToAnsi } from './tui'

const depthOf = (node: Node): number => {
  let deepest = 0
  const open: [Node, number][] = [[node, 0]]
  for (let next = open.pop(); next !== undefined; next = open.pop()) {
    const [at, depth] = next
    if (depth > deepest) deepest = depth
    for (const child of at.children ?? []) open.push([child, depth + 1])
  }
  return deepest
}

const TARGETS: [string, (text: string) => string][] = [
  ['html', (text) => renderToHtml(text)],
  ['terminal', (text) => renderToAnsi(text, { width: 80 })],
]

const DEEP: [string, string][] = [
  ['quotes', `${'>'.repeat(20_000)} x`],
  ['quotes with spaces', `${'> '.repeat(20_000)}x`],
  ['lists', Array.from({ length: 1500 }, (_, at) => `${' '.repeat(at * 2)}- x`).join('\n')],
  ['quotes and lists', `${'> - '.repeat(5000)}x`],
  ['underscores', `${'_'.repeat(80_000)}a${'_'.repeat(80_000)}`],
  ['stars', `${'*'.repeat(60_000)}a${'*'.repeat(60_000)}`],
  ['strikes', `${'~~'.repeat(30_000)}a${'~~'.repeat(30_000)}`],
  ['images in images', `${'!['.repeat(20_000)}a${'](b)'.repeat(20_000)}`],
  ['brackets', `${'['.repeat(60_000)}a${']'.repeat(60_000)}`],
]

for (const [name, text] of DEEP) {
  test(`deep ${name} are read to a tree of bounded depth, and drawn`, () => {
    // 100 blocks, 100 inlines, and the few nodes between a block and its text.
    expect(depthOf(parse(text))).toBeLessThan(210)
    for (const [, draw] of TARGETS) expect(typeof draw(text)).toBe('string')
  })
}

test('nesting within the limit is kept as written', () => {
  const quotes = parse(`${'>'.repeat(60)} x`)
  let node: Node | undefined = quotes
  let count = 0
  while (node?.children?.[0]?.type === 'blockquote') {
    node = node.children[0]
    count++
  }
  expect(count).toBe(60)
  // Past the limit, the rest of the line is the text of the last quote: nothing is lost.
  expect(renderToHtml(`${'>'.repeat(150)} x`)).toContain(`${'&gt;'.repeat(50)} x`)
  expect(renderToHtml(`${'*'.repeat(500)}a${'*'.repeat(500)}`)).toContain('a')
})

test('a link destination nests parentheses as deep as cmark reads them', () => {
  const at = (depth: number) => `[a](${'('.repeat(depth)}b${')'.repeat(depth)})`
  expect(renderToHtml(at(32))).toContain('<a href=')
  expect(renderToHtml(at(33))).not.toContain('<a href=')
})

const REPEATED: [string, (count: number) => string][] = [
  ['link openers', (count) => '[a]('.repeat(count)],
  ['entities in one word', (count) => '&a;&#1;&#x110000;&amp'.repeat(count)],
  ['one long word', (count) => 'é'.repeat(count * 20)],
  ['nested quotes', (count) => `${'>'.repeat(count)} x`],
  ['open emphasis', (count) => '*a '.repeat(count)],
  ['open code spans', (count) => '`a ``b '.repeat(count)],
  ['open tags', (count) => '<a '.repeat(count)],
  ['footnote references', (count) => `${'[^1]'.repeat(count)}\n\n[^1]: x`],
  [
    'table cells',
    (count) => `${'|a'.repeat(count)}|\n${'|-'.repeat(count)}|\n${'|b'.repeat(count)}|`,
  ],
]

for (const [name, make] of REPEATED) {
  for (const [target, draw] of TARGETS) {
    test(`${name}: four times the text is not sixteen times the time (${target})`, () => {
      const time = (text: string): number => {
        let best = Infinity
        for (let run = 0; run < 3; run++) {
          const from = performance.now()
          draw(text)
          best = Math.min(best, performance.now() - from)
        }
        return best
      }
      const small = make(5000)
      const large = make(20_000)
      time(small)
      // Linear is 4 and quadratic is 16; 9 leaves room for a noisy machine on either side. A
      // text drawn in a few milliseconds is fast enough whatever its ratio.
      const [before, after] = [time(small), time(large)]
      expect(after < 40 || after / Math.max(before, 0.5) < 9).toBe(true)
    })
  }
}
