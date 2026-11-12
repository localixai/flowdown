/**
 * A drawn diagram's toolbar (enlarge, source, copy, download) and the viewer it opens. Mermaid
 * cannot lay out in a test DOM, so the engine is a stub that returns a fixed picture.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { registerDom } from '../../test/dom'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="100%" style="max-width: 120px"><g><rect width="10" height="10"></rect></g></svg>'
const engine = {
  initialize() {},
  parse: async (text: string) => {
    if (text.startsWith('not a diagram')) throw new Error('Parse error on line 1')
    return true
  },
  render: async () => ({ svg: SVG }),
}

/**
 * A diagram drawn by a renderer of this file's own, not the page's: that one keeps the first
 * engine it loads for the rest of the run, and other files bring their own stubs.
 */
async function diagram(source: string, growing = false) {
  const [{ Diagram }, { GrowingFence, RenderContextValue }, { createMermaidRenderer }] =
    await Promise.all([import('./diagram'), import('../react/context'), import('./renderer')])
  const mermaid = createMermaidRenderer(async () => engine)
  return (
    <RenderContextValue.Provider value={{ highlight: null, mermaid }}>
      <GrowingFence.Provider value={growing}>
        <Diagram source={source} />
      </GrowingFence.Provider>
    </RenderContextValue.Provider>
  )
}

const SOURCE = 'flowchart LR\n  A --> B'

let cleanup: (() => Promise<void>) | null = null
afterEach(async () => {
  await cleanup?.()
  cleanup = null
})

async function act(work: () => unknown) {
  const react = await import('react')
  await react.act(async () => {
    await work()
  })
}

/** Lets the renderer's queue, a lazy chunk and React's updates finish. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)))

async function mount(node: ReactNode) {
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(() => root.render(node))
  await settle()
  cleanup = async () => {
    await act(() => root.unmount())
    host.remove()
  }
  return {
    host,
    rerender: (next: ReactNode) => act(() => root.render(next)),
    button: (name: string) => {
      const found = [...host.querySelectorAll('button')].find(
        (button) => button.getAttribute('aria-label') === name,
      )
      if (!found) throw new Error(`no button "${name}"`)
      return found
    },
  }
}

async function drawn(source = SOURCE) {
  const page = await mount(await diagram(source))
  expect(page.host.querySelector('.fd-diagram-canvas svg')).not.toBeNull()
  return page
}

describe('the toolbar', () => {
  test('a drawn diagram has enlarge, source, copy and download', async () => {
    const page = await drawn()
    const names = [...page.host.querySelectorAll('.fd-diagram-actions button')].map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(names).toEqual(['Enlarge diagram', 'Show source', 'Copy source', 'Download SVG'])
  })

  test('Show source swaps the picture for its source and back, keeping the focus', async () => {
    const page = await drawn()
    const toggle = page.button('Show source')
    toggle.focus()
    await act(() => toggle.click())
    expect(page.host.querySelector('.fd-diagram-canvas')).toBeNull()
    expect(page.host.querySelector('.fd-diagram pre code')?.textContent).toContain('flowchart LR')
    expect(toggle.getAttribute('aria-label')).toBe('Show diagram')
    expect(document.activeElement).toBe(toggle)
    await act(() => toggle.click())
    expect(page.host.querySelector('.fd-diagram-canvas svg')).not.toBeNull()
    expect(toggle.getAttribute('aria-label')).toBe('Show source')
  })

  test('Copy source puts the fence body on the clipboard and says so', async () => {
    const written: string[] = []
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    })
    try {
      const page = await drawn()
      await act(() => page.button('Copy source').click())
      expect(written).toEqual([SOURCE])
      expect(page.button('Copied').hasAttribute('data-copied')).toBe(true)
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  test('Copy source falls back to the copy command where the Clipboard API is refused', async () => {
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
    const copied: string[] = []
    const execCommand = (command: string) => {
      const area = document.querySelector('textarea')
      if (command === 'copy' && area) copied.push(area.value)
      return true
    }
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    try {
      const page = await drawn()
      await act(() => page.button('Copy source').click())
      expect(copied).toHaveLength(1)
      expect(copied[0]).toContain('flowchart LR')
      expect(page.host.querySelector('textarea')).toBeNull()
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
      Reflect.deleteProperty(document, 'execCommand')
    }
  })

  test('Download SVG saves the drawn picture as diagram.svg', async () => {
    const blobs: Blob[] = []
    const names: string[] = []
    const { createObjectURL, revokeObjectURL } = URL
    const click = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (blob: Blob) => {
      blobs.push(blob)
      return 'blob:diagram'
    }
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      names.push(this.download)
    }
    try {
      const page = await drawn()
      await act(() => page.button('Download SVG').click())
      expect(names).toEqual(['diagram.svg'])
      expect(blobs[0]?.type).toBe('image/svg+xml')
      const file = await blobs[0]!.text()
      expect(file.startsWith('<svg')).toBe(true)
      expect(file).toContain('xmlns="http://www.w3.org/2000/svg"')
      // Its own size, not the page's CSS width.
      expect(file).toContain('width="120"')
      expect(file).not.toContain('max-width')
    } finally {
      URL.createObjectURL = createObjectURL
      URL.revokeObjectURL = revokeObjectURL
      HTMLAnchorElement.prototype.click = click
    }
  })

  test('a fence still being written, or one that failed, has no toolbar', async () => {
    const growing = await mount(await diagram('flowchart LR\n  Grow --> B', true))
    expect(growing.host.querySelector('.fd-diagram pre')).not.toBeNull()
    expect(growing.host.querySelector('.fd-diagram-actions')).toBeNull()
    await cleanup?.()
    cleanup = null

    const failed = await mount(await diagram('not a diagram at all'))
    expect(failed.host.querySelector('.fd-diagram')?.getAttribute('data-state')).toBe('error')
    expect(failed.host.querySelector('.fd-diagram-actions')).toBeNull()
  })
})

describe('the viewer', () => {
  const canvas = () => document.querySelector<HTMLElement>('.fd-diagram-viewer-canvas')
  const key = (target: Element, name: string) =>
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })))

  async function opened() {
    const page = await drawn()
    const enlarge = page.button('Enlarge diagram')
    enlarge.focus()
    await act(() => enlarge.click())
    await settle()
    const dialog = document.querySelector('dialog')
    expect(dialog?.open).toBe(true)
    return { page, enlarge, dialog: dialog! }
  }

  test('Enlarge opens a modal dialog with the diagram; Close returns the focus', async () => {
    const { page, enlarge, dialog } = await opened()
    expect(dialog.getAttribute('aria-label')).toBe('Diagram')
    expect(canvas()?.querySelector('svg')).not.toBeNull()
    await act(() => page.button('Close').click())
    expect(document.querySelector('dialog')).toBeNull()
    expect(document.activeElement).toBe(enlarge)
  })

  test('Escape closes it and returns the focus', async () => {
    const { enlarge, dialog } = await opened()
    await key(dialog.querySelector('.fd-diagram-stage')!, 'Escape')
    expect(document.querySelector('dialog')).toBeNull()
    expect(document.activeElement).toBe(enlarge)
  })

  test('the zoom buttons, Fit and 100% change the transform', async () => {
    const { page } = await opened()
    expect(canvas()?.style.transform).toBe('translate(0px, 0px) scale(1)')
    await act(() => page.button('Zoom in').click())
    expect(canvas()?.style.transform).toContain('scale(1.25)')
    expect(page.host.querySelector('.fd-diagram-zoom')?.textContent).toBe('125%')
    await act(() => page.button('Zoom out').click())
    await act(() => page.button('Zoom out').click())
    expect(canvas()?.style.transform).toContain('scale(0.8)')
    await act(() => page.button('Actual size (80%)').click())
    expect(canvas()?.style.transform).toContain('scale(1)')
    await act(() => page.button('Zoom in').click())
    await act(() => page.button('Fit to window').click())
    expect(canvas()?.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  test('the keys zoom, pan and fit', async () => {
    const { dialog } = await opened()
    const stage = dialog.querySelector('.fd-diagram-stage')!
    await key(stage, '+')
    expect(canvas()?.style.transform).toContain('scale(1.25)')
    await key(stage, 'ArrowLeft')
    expect(canvas()?.style.transform).toContain('translate(48px, 0px)')
    await key(stage, '0')
    expect(canvas()?.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  test('a drag pans the picture', async () => {
    const { dialog } = await opened()
    const stage = dialog.querySelector('.fd-diagram-stage')!
    const pointer = (type: string, x: number, y: number) =>
      act(() =>
        stage.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: y }),
        ),
      )
    await pointer('pointerdown', 10, 10)
    expect(stage.hasAttribute('data-moving')).toBe(true)
    await pointer('pointermove', 40, 30)
    expect(canvas()?.style.transform).toBe('translate(30px, 20px) scale(1)')
    await pointer('pointerup', 40, 30)
    expect(stage.hasAttribute('data-moving')).toBe(false)
  })

  test('a diagram replaced by `components.diagram` has no toolbar of ours', async () => {
    const { Markdown } = await import('../index')
    const page = await mount(
      <Markdown components={{ diagram: ({ source }) => <p>{source}</p> }}>
        {`\`\`\`mermaid\n${SOURCE}\n\`\`\``}
      </Markdown>,
    )
    expect(page.host.querySelector('.fd-diagram')).toBeNull()
    expect(page.host.querySelector('button')).toBeNull()
  })
})
