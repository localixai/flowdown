/**
 * One <Markdown> fed a reply token by token, as a chat page does, draws every frame exactly as a
 * fresh <Markdown> given that frame would: the blocks it remembers between tokens never leave a
 * stale piece behind. The replies are the seeded ones the benchmark streams.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { prefixes } from '../../test/chunks'
import { heavyDescribe } from '../../test/heavy'
import { registerDom } from '../../test/dom'
import { scenarios } from '../../test/replies'
import { Markdown } from './markdown'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

const replies = scenarios()
  .filter((scenario) => !scenario.history)
  .map((scenario) => ({ name: scenario.name, text: scenario.text.slice(0, 6_000) }))

/**
 * The markup with attributes in one order: an element React updated gets its new attributes at
 * the end, one it created has them in prop order, and the two are the same element. React also
 * numbers its generated ids per root. Nothing else may differ.
 */
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

/**
 * Each reply is some 300 frames, and every frame is drawn twice, once from scratch: the forms reply
 * takes over 3 s on a laptop and twice that on a two-core CI runner. The default 5 s is for a unit
 * test; this one's work is fixed by the replies, so its deadline is too.
 */
const REPLY_DEADLINE_MS = 30_000

heavyDescribe('a reply streamed into one <Markdown>', () => {
  for (const { name, text } of replies) {
    test(
      `${name}: every frame is a fresh render of it`,
      async () => {
        const streamed = await root()
        try {
          const frames = prefixes(text, 'frame')
          for (const [index, frame] of frames.entries()) {
            const node = (
              <Markdown streaming={index < frames.length - 1} headingIds>
                {frame}
              </Markdown>
            )
            const fresh = await root()
            const expected = await fresh.render(node)
            await fresh.close()
            expect(await streamed.render(node), `${name} @${frame.length}`).toBe(expected)
          }
        } finally {
          await streamed.close()
        }
      },
      REPLY_DEADLINE_MS,
    )
  }
})
