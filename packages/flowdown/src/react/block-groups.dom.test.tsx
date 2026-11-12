/**
 * A reply long enough to be drawn in several groups of blocks. Grouping is how a long reply stays
 * cheap to stream; nothing about the page may depend on where a group ends.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { registerDom } from '../../test/dom'
import { Markdown } from './markdown'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

/** Some 130 top-level blocks: headings that repeat, lists, a table, code, and a fence at the end. */
const reply = (() => {
  let text = ''
  for (let part = 0; part < 30; part++) {
    text += `## Section\n\nParagraph ${part} with *emphasis* and a [link](/p${part}).\n\n`
    if (part % 3 === 0) text += `- item ${part}\n- another\n\n`
    if (part % 7 === 0) text += `| a | b |\n|---|---|\n| ${part} | x |\n\n`
    if (part % 5 === 0) text += '```ts\nconst n = ' + part + '\n```\n\n'
    text += `### Details\n\nMore about ${part}.\n\n`
  }
  return text + '```py\nprint("the end")\n'
})()

/** The markup with attributes in one order and React's generated ids made equal. */
function canonical(host: HTMLElement): string {
  const copy = host.cloneNode(true) as HTMLElement
  for (const element of copy.querySelectorAll('*')) {
    const attributes = [...element.attributes].map((a) => [a.name, a.value] as const)
    for (const [name] of attributes) element.removeAttribute(name)
    for (const [name, value] of attributes.toSorted(([a], [b]) => a.localeCompare(b)))
      element.setAttribute(name, value)
  }
  return copy.innerHTML.replace(/_r_[\w]*_/g, '_id_')
}

async function root() {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const handle = createRoot(host)
  return {
    host,
    render: async (node: ReactNode) => {
      await act(async () => handle.render(node))
      return canonical(host)
    },
    close: async () => {
      await act(async () => handle.unmount())
      host.remove()
    },
  }
}

/** Every place a line ends, and a few inside lines: where a chunk of a stream may stop. */
const frames = (() => {
  const cuts: string[] = []
  for (let at = 0; at < reply.length; at += 37) cuts.push(reply.slice(0, at))
  cuts.push(reply)
  return cuts
})()

describe('a reply drawn in several groups of blocks', () => {
  test('every frame of the stream is a fresh render of it', async () => {
    const streamed = await root()
    try {
      for (const [index, frame] of frames.entries()) {
        const node = (
          <Markdown streaming={index < frames.length - 1} headingIds>
            {frame}
          </Markdown>
        )
        const fresh = await root()
        const expected = await fresh.render(node)
        await fresh.close()
        expect(await streamed.render(node), `@${frame.length}`).toBe(expected)
      }
    } finally {
      await streamed.close()
    }
  }, 60_000)

  test('headings that repeat get one anchor each, across the groups', async () => {
    const page = await root()
    try {
      await page.render(<Markdown headingIds>{reply}</Markdown>)
      const ids = [...page.host.querySelectorAll('h2, h3')].map((heading) => heading.id)
      expect(ids).toHaveLength(60)
      expect(new Set(ids).size).toBe(60)
      expect(ids.slice(0, 4)).toEqual(['section', 'details', 'section-1', 'details-1'])
    } finally {
      await page.close()
    }
  })

  test('a block drawn early is left as it is while the reply grows below it', async () => {
    const page = await root()
    try {
      const half = reply.slice(0, reply.length >> 1)
      await page.render(<Markdown streaming>{half}</Markdown>)
      const early = [...page.host.querySelectorAll('h2, p, table, pre')].slice(0, 40)
      await page.render(<Markdown streaming>{reply}</Markdown>)
      await page.render(<Markdown>{reply}</Markdown>)
      const after = [...page.host.querySelectorAll('h2, p, table, pre')].slice(0, 40)
      // The same elements, not equal ones: nothing above the growing end was drawn again.
      for (const [index, element] of early.entries()) expect(after[index]).toBe(element)
    } finally {
      await page.close()
    }
  })

  test('two replies that stream at once are each drawn as if alone', async () => {
    const other = reply.replace(/Section/g, 'Chapter').replace(/```py/, '~~~rb')
    const first = await root()
    const second = await root()
    try {
      for (let at = 0; at < reply.length; at += 211) {
        const one = <Markdown streaming>{reply.slice(0, at)}</Markdown>
        const two = <Markdown streaming>{other.slice(0, at)}</Markdown>
        const gotOne = await first.render(one)
        const gotTwo = await second.render(two)
        for (const [got, node, name] of [
          [gotOne, one, 'first'],
          [gotTwo, two, 'second'],
        ] as const) {
          const alone = await root()
          expect(got, `${name} @${at}`).toBe(await alone.render(node))
          await alone.close()
        }
      }
    } finally {
      await first.close()
      await second.close()
    }
  }, 60_000)
})
