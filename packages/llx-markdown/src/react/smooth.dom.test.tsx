/**
 * `<Markdown smooth>`: a reply that arrives in bursts is shown at an even pace. The page never
 * shows less than it did, never text that has not arrived, and ends on the whole reply, drawn
 * exactly as the same text is without pacing.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { registerDom } from '../../test/dom'
import { Markdown } from './markdown'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

const REPLY =
  'Rolling back is **three steps**. First find the last good release, then deploy it again.\n\n' +
  '- check the health page\n- tell the channel\n\n```sh\nbun run deploy --ref v1.4.2\n```\n\nDone.'

/** A clock and a frame queue the test turns by hand. */
function manualFrames() {
  let time = 1000
  let queue: Array<(time: number) => void> = []
  const real = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame }
  const realNow = performance.now.bind(performance)
  globalThis.requestAnimationFrame = (run) => queue.push(run)
  globalThis.cancelAnimationFrame = (id) => void (queue[id - 1] = () => {})
  performance.now = () => time
  return {
    tick(ms = 32) {
      time += ms
      const due = queue
      queue = []
      for (const run of due) run(time)
    },
    pending: () => queue.length,
    restore() {
      globalThis.requestAnimationFrame = real.raf
      globalThis.cancelAnimationFrame = real.caf
      performance.now = realNow
    },
  }
}

async function mount() {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  return {
    host,
    act,
    show: (text: string, streaming: boolean, smooth = true) =>
      act(() =>
        root.render(
          <Markdown streaming={streaming} smooth={smooth}>
            {text}
          </Markdown>,
        ),
      ),
    unmount: () => act(() => root.unmount()),
  }
}

describe('a paced reply', () => {
  test('shows a burst over several frames, whole words, and ends on the whole reply', async () => {
    const frames = manualFrames()
    const page = await mount()
    try {
      await page.show('', true)
      await page.show(REPLY, true)
      const lengths: number[] = []
      for (let step = 0; step < 200 && frames.pending() > 0; step++) {
        await page.act(async () => frames.tick())
        lengths.push(page.host.textContent!.length)
      }
      // More than one step, and never less text than the step before.
      expect(new Set(lengths).size).toBeGreaterThan(3)
      for (let i = 1; i < lengths.length; i++)
        expect(lengths[i]!).toBeGreaterThanOrEqual(lengths[i - 1]!)

      await page.show(REPLY, false)
      for (let step = 0; step < 200 && frames.pending() > 0; step++)
        await page.act(async () => frames.tick())
      const paced = page.host.innerHTML
      expect(paced).not.toContain('data-streaming')

      const plain = await mount()
      await plain.show(REPLY, false, false)
      expect(paced).toBe(plain.host.innerHTML)
      await plain.unmount()
    } finally {
      await page.unmount()
      frames.restore()
    }
  })

  test('keeps the streaming look until everything is shown, after the reply ended', async () => {
    const frames = manualFrames()
    const page = await mount()
    try {
      await page.show('', true)
      await page.show(REPLY, true)
      await page.act(async () => frames.tick())
      await page.show(REPLY, false)
      const root = page.host.firstElementChild!
      expect(root.textContent!.length).toBeLessThan(REPLY.length / 2)
      expect(root.hasAttribute('data-streaming')).toBe(true)
    } finally {
      await page.unmount()
      frames.restore()
    }
  })

  test('does not replay text that was there before streaming began', async () => {
    const frames = manualFrames()
    const page = await mount()
    try {
      await page.show(REPLY, true)
      expect(page.host.textContent).toContain('Done.')
      expect(frames.pending()).toBe(0)
    } finally {
      await page.unmount()
      frames.restore()
    }
  })

  test('without `smooth`, the text is shown as it arrives', async () => {
    const frames = manualFrames()
    const page = await mount()
    try {
      await page.show('', true, false)
      await page.show(REPLY, true, false)
      expect(page.host.textContent).toContain('Done.')
      expect(frames.pending()).toBe(0)
    } finally {
      await page.unmount()
      frames.restore()
    }
  })
})
