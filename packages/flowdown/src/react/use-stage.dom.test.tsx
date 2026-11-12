import { afterAll, beforeAll, expect, test } from 'bun:test'
import { registerDom } from '../../test/dom'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

test('a stage whose chunk failed to load is asked for again, and the page gets it', async () => {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { useStage } = await import('./use-stage')
  let calls = 0
  // Offline for the first two tries, then the chunk is there.
  const load = () =>
    ++calls < 3 ? Promise.reject(new Error('offline')) : Promise.resolve({ name: 'math' })
  function Page() {
    const stage = useStage(load, true, { retryMs: 0 })
    return <p>{stage?.name ?? 'source'}</p>
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(<Page />))
  for (let i = 0; i < 5 && host.textContent !== 'math'; i++)
    await act(() => new Promise((done) => setTimeout(done, 0)))
  expect(host.textContent).toBe('math')
  expect(calls).toBe(3)
  await act(async () => root.unmount())
})

test('a chunk that never loads is asked for a few times, then the page stays readable', async () => {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { useStage } = await import('./use-stage')
  let calls = 0
  const load = () => {
    calls++
    return Promise.reject(new Error('gone'))
  }
  function Page() {
    const stage = useStage<{ name: string }>(load, true, { retryMs: 0 })
    return <p>{stage?.name ?? 'source'}</p>
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(<Page />))
  for (let i = 0; i < 10; i++) await act(() => new Promise((done) => setTimeout(done, 0)))
  expect(host.textContent).toBe('source')
  expect(calls).toBe(4)
  await act(async () => root.unmount())
})
