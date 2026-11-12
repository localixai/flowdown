import { afterAll, beforeAll, expect, test } from 'bun:test'
import { registerDom } from '../../test/dom'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

/** Lay every element out `scroll` wide in a `client` wide box (happy-dom lays nothing out). */
function laidOut(scroll: number, client: number) {
  const proto = HTMLElement.prototype
  const kept = ['scrollWidth', 'clientWidth'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  )
  Object.defineProperty(proto, 'scrollWidth', { configurable: true, get: () => scroll })
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => client })
  return () => {
    for (const [key, descriptor] of kept) {
      if (descriptor) Object.defineProperty(proto, key, descriptor)
      else Reflect.deleteProperty(proto, key)
    }
  }
}

async function box(scroll: number, client: number, markdown: string, selector: string) {
  const restore = laidOut(scroll, client)
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { Markdown } = await import('../index')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<Markdown>{markdown}</Markdown>))
    const found = host.querySelector<HTMLElement>(selector)!
    return {
      role: found.getAttribute('role'),
      label: found.getAttribute('aria-label'),
      tab: found.tabIndex,
    }
  } finally {
    await act(async () => root.unmount())
    host.remove()
    restore()
  }
}

const tableBox = (scroll: number, client: number) =>
  box(scroll, client, '| a | b |\n| - | - |\n| 1 | 2 |', '.fd-table')
const codeBox = (scroll: number, client: number) =>
  box(scroll, client, '```sh\necho a very long line\n```', '.fd-code pre')

test('a table wider than its box is a group the keyboard can scroll', async () => {
  expect(await tableBox(900, 300)).toEqual({ role: 'group', label: 'Scrollable table', tab: 0 })
})

test('a table that fits is not a stop on the Tab key', async () => {
  const fits = await tableBox(300, 300)
  expect(fits.role).toBeNull()
  expect(fits.tab).toBe(-1)
})

test('a code block wider than its box is a group the keyboard can scroll', async () => {
  expect(await codeBox(900, 300)).toEqual({ role: 'group', label: 'Scrollable code', tab: 0 })
})

test('a code block that fits is not a stop on the Tab key', async () => {
  const fits = await codeBox(300, 300)
  expect(fits.role).toBeNull()
  expect(fits.tab).toBe(-1)
})
