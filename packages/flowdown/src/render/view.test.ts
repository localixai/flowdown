/** What a token costs the plain-element view (`@localix-ai/flowdown/static`, `/dom`, `/element`). */
import { expect, test } from 'bun:test'
import { prefixes } from '../../test/chunks'
import { escapeHtml, toHtml } from './vnode'
import { createView } from './view'

const code = (lines: number): string =>
  Array.from({ length: lines }, (_, at) => `const v${at} = f(${at}) // ${at}`).join('\n')

test('a fence being written is highlighted a piece at a time, each complete piece once', () => {
  const calls: string[] = []
  const highlight = (source: string): string => {
    calls.push(source)
    return escapeHtml(source)
  }
  const markdown = `Text.\n\n\`\`\`js\n${code(40 * 3 + 7)}\n\`\`\`\n`
  const view = createView({ highlight })
  const closes = markdown.lastIndexOf('\n```')
  for (let at = 1; at <= closes; at += 3) view.render(markdown.slice(0, at), true)
  // A complete piece is its 40 lines and the line break that ends it: each is asked for once.
  const complete = calls.filter((call) => call.split('\n').length === 41 && call.endsWith('\n'))
  expect(complete.length).toBe(3)
  expect(new Set(complete).size).toBe(complete.length)
  expect(Math.max(...calls.map((call) => call.split('\n').length))).toBeLessThanOrEqual(41)
})

test('a table that grows does not read its complete pieces again', () => {
  const row = (at: number) => `| [step${at}](https://example.com/${at}) | ok | ${at} ms |`
  const text = (rows: number) =>
    `| step | status | time |\n| --- | --- | ---: |\n${Array.from({ length: rows }, (_, at) => row(at)).join('\n')}`
  const asked: string[] = []
  const view = createView({
    urlTransform: (url) => {
      asked.push(url)
      return url
    },
  })
  // The last row of a text still arriving is held back until its line ends, so at 33 rows the
  // pieces of rows 0 to 15 and 16 to 31 are complete.
  view.render(text(33), true)
  asked.length = 0
  // Rows 33 to 47 arrive token by token: only the piece they are in is read.
  const start = text(33).length
  for (const prefix of prefixes(text(48), 'token', 7))
    if (prefix.length > start) view.render(prefix, true)
  const above = asked.filter((url) => Number(url.split('/').pop()) < 32)
  expect(above).toEqual([])
  // And it draws what one parse of the whole table draws.
  expect(toHtml(view.render(text(48)))).toBe(toHtml(createView().render(text(48))))
})
