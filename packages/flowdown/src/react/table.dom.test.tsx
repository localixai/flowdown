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

async function tableBox(scroll: number, client: number) {
  const restore = laidOut(scroll, client)
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { Markdown } = await import('../index')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<Markdown>{'| a | b |\n| - | - |\n| 1 | 2 |'}</Markdown>))
    const box = host.querySelector<HTMLElement>('.fd-table')!
    return {
      role: box.getAttribute('role'),
      label: box.getAttribute('aria-label'),
      tab: box.tabIndex,
    }
  } finally {
    await act(async () => root.unmount())
    host.remove()
    restore()
  }
}

test('a table wider than its box is a region the keyboard can scroll', async () => {
  expect(await tableBox(900, 300)).toEqual({ role: 'region', label: 'Scrollable table', tab: 0 })
})

test('a table that fits is not a stop on the Tab key', async () => {
  const fits = await tableBox(300, 300)
  expect(fits.role).toBeNull()
  expect(fits.tab).toBe(-1)
})
