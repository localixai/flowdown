/**
 * A document compares the reply with the last one once a token and hands what it checked down to
 * every part that remembers the last text: the scan for an open fence, the splitter, a growing
 * fence, its cutter and colourer, a long list or quote. What it hands down may only ever spare a
 * comparison of text that did not change. So a page that streams, is edited above its end, is cut
 * back, is regenerated or stops streaming in between must draw, at every step, what a page that
 * drew only that text draws.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { CORPUS } from '../../test/corpus'
import { registerDom } from '../../test/dom'
import { seeded } from '../../test/random'
import { createBlockSplitter, splitBlocks } from '../core/blocks'
import { createFenceScanner } from '../core/fence-scan'
import { createDocument } from '../document'
import {
  createCutter,
  createFenceMemory,
  createLineColourer,
  growingFence,
} from '../document/fence'
import { createListReader } from '../document/list'
import { createQuoteReader } from '../document/quote'
import { parse as parseMarkdown } from '../engine'
import { highlight } from '../highlight'
import { Markdown } from './markdown'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

async function mount() {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const handle = createRoot(host)
  return {
    host,
    render: (node: ReactNode) => act(async () => handle.render(node)),
    close: async () => {
      await act(async () => handle.unmount())
      host.remove()
    },
  }
}

/** `useId` values depend on where a component sits in the tree, which blocks change. */
const sameIds = (markup: string) => markup.replace(/_[rR]_[0-9a-z]+_/g, '_r_')

const lines = (count: number, line: (i: number) => string) =>
  Array.from({ length: count }, (_, i) => line(i)).join('\n')

const REPLIES: Record<string, string> = {
  fence: `Here:\n\n\`\`\`ts\n${lines(120, (i) => `const v${i} = load(${i}) // ${i}`)}\n\`\`\`\n\nDone.`,
  list: lines(60, (i) => `- item ${i} with **bold** and \`code\``),
  quote: lines(60, (i) => `> line ${i} of a long quote`),
  mixed: Object.values(CORPUS).slice(0, 4).join('\n\n'),
}

/** The texts a page is handed: a stream, with an edit, a cut or a new ending now and then. */
function steps(text: string, seed: number): Array<{ text: string; streaming: boolean }> {
  const random = seeded(seed)
  const out: Array<{ text: string; streaming: boolean }> = []
  let at = 0
  let current = ''
  while (at < text.length) {
    at = Math.min(text.length, at + random.int(1, 40))
    current = text.slice(0, at)
    const roll = random.next()
    if (roll < 0.06 && current.length > 10) {
      // A character above the end changes, and the reply goes on from there.
      const place = random.int(0, current.length - 2)
      current = `${current.slice(0, place)}${random.pick(['x', '\n', '`', '-'])}${current.slice(place + 1)}`
    } else if (roll < 0.1) {
      // Cut back, as a reply regenerated from part of the way.
      current = current.slice(0, random.int(0, current.length))
      at = current.length
    }
    out.push({ text: current, streaming: random.next() > 0.08 })
  }
  out.push({ text, streaming: false })
  return out
}

describe('what a document checked once a token', () => {
  for (const [name, reply] of Object.entries(REPLIES)) {
    test(`${name}: a page that lives through edits draws what a new page draws`, async () => {
      const page = await mount()
      const fresh = await mount()
      const all = [1, 2, 3].flatMap((seed) => steps(reply, seed * 7919 + name.length))
      for (const [index, step] of all.entries()) {
        const node = (
          <Markdown streaming={step.streaming} highlight={highlight}>
            {step.text}
          </Markdown>
        )
        await page.render(node)
        // A page that has drawn nothing else: a new root, keyed by the step.
        await fresh.render(<div key={index}>{node}</div>)
        expect(sameIds(page.host.innerHTML)).toBe(sameIds(fresh.host.firstElementChild!.innerHTML))
      }
      await page.close()
      await fresh.close()
      // Two pages drawn at each of some thousand steps: seconds on a shared runner.
    }, 30_000)

    test(`${name}: a document that lives through edits cuts what a new one cuts`, () => {
      const kept = createDocument({ refs: true })
      for (const step of [1, 2, 3].flatMap((seed) => steps(reply, seed * 104729 + name.length))) {
        const options = { streaming: step.streaming }
        const once = createDocument({ refs: true }).update(step.text, options)
        const state = kept.update(step.text, options)
        expect(state.blocks.map((b) => [b.offset, b.source])).toEqual(
          once.blocks.map((b) => [b.offset, b.source]),
        )
        expect([state.closer, state.growing]).toEqual([once.closer, once.growing])
      }
    })
  }
})

/**
 * Each part, handed a check of a text other than the one it remembers (an update it did not see
 * came in between), must compare as if it had been handed nothing.
 */
describe('a check of another text is not taken', () => {
  // `seen` is what the part read; `between` an update it did not see; `now` grows `between`.
  const seen = 'Intro\n\n```ts\nconst a = 1\nconst b = 2\n'
  const between = 'Other\n\n```ts\nconst a = 9\nconst b = 2\n'
  const now = `${between}const c = 3\n`

  // The text in between has no fence: a part that took the check would go on inside the one it saw.
  const plain = 'Other words\n\nA paragraph of plain text, long enough.\n'
  const plainNow = `${plain}# A heading\n`
  const plainGrown = { previous: plain, same: plain.length }

  test('the scan for an open fence', () => {
    const scan = createFenceScanner()
    scan(seen)
    expect(scan(plainNow, plainGrown)).toEqual(createFenceScanner()(plainNow))
  })

  test('the splitter', () => {
    const splitter = createBlockSplitter()
    splitter.split(seen)
    expect(splitter.split(plainNow, plainGrown)).toEqual(splitBlocks(plainNow))
  })

  test('a growing fence, its cutter and its colourer', () => {
    const body = (text: string) => text.slice(text.indexOf('```'))
    const memory = createFenceMemory()
    growingFence(body(seen), '```', memory)
    const fence = growingFence(body(now), '```', memory, { previous: body(between), same: 40 })
    expect(fence).toEqual(growingFence(body(now), '```'))
    // The body it remembers is the one it read, not the one in between.
    const code = (text: string) => growingFence(body(text), '```')!.body
    const cut = createCutter()
    cut(lines(50, (i) => `seen ${i}`))
    const other = lines(50, (i) => `other ${i}`)
    // Cut afresh: a new run, of the pieces a new cutter cuts.
    const again = cut(`${other}\nmore`, { previous: other, same: other.length })
    expect([again.parts, again.run]).toEqual([createCutter()(`${other}\nmore`).parts, 1])
    const reader = highlight.lines!('ts')!
    const colour = createLineColourer()
    colour(code(seen), reader, 'ts')
    const { run, ...coloured } = colour(code(now), reader, 'ts', {
      previous: code(between),
      same: 30,
    })
    const { run: _first, ...afresh } = createLineColourer()(code(now), reader, 'ts')
    expect([coloured, run]).toEqual([afresh, 1])
  })

  test('a long list and a long quote', () => {
    const parse = (text: string) => parseMarkdown(text)
    const list = (word: string) => lines(40, (i) => `- ${word} ${i}`)
    const lists = createListReader()
    lists.read(list('seen'), '', parse, null)
    const listNow = `${list('other')}\n- last`
    expect(
      lists.read(listNow, '', parse, null, { previous: list('other'), same: list('other').length }),
    ).toEqual(createListReader().read(listNow, '', parse, null))
    const quote = (word: string) => lines(40, (i) => `> ${word} ${i}\n>`)
    const quotes = createQuoteReader()
    quotes.read(quote('seen'), '', parse, null)
    const quoteNow = `${quote('other')}\n> last`
    expect(
      quotes.read(quoteNow, '', parse, null, {
        previous: quote('other'),
        same: quote('other').length,
      }),
    ).toEqual(createQuoteReader().read(quoteNow, '', parse, null))
  })
})

test('a marker typed where the last text had none is found', () => {
  // The splitter remembers where the last text had no `[!`; an edit there makes a form.
  const before = `Intro\n\n${lines(30, (i) => `Line ${i} of prose.`)}\n\n> [?PROS]\n\n- one\n- two\n`
  const after = before.replace('[?PROS]', '[!PROS]')
  const splitter = createBlockSplitter()
  splitter.split(before)
  const blocks = splitter.split(after)
  expect(blocks).toEqual(splitBlocks(after))
  // The form and its list are one block.
  expect(blocks.at(-1)!.source).toStartWith('> [!PROS]')
  // So with a growing text that the caller checked up to the edit.
  const grows = createBlockSplitter()
  grows.split(before)
  const place = before.indexOf('[?')
  expect(grows.split(`${after}- three\n`, { previous: before, same: place })).toEqual(
    splitBlocks(`${after}- three\n`),
  )
})
