import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { registerDom } from '../../test/dom'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

/** Mount `node`, run `body` against its host, unmount. */
async function mounted(
  node: ReactNode,
  body: (host: HTMLElement, rerender: (next: ReactNode) => Promise<void>) => Promise<void>,
) {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(node))
    await body(host, (next) => act(async () => root.render(next)))
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}

const key = async (target: Element, name: string) => {
  const { act } = await import('react')
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

describe('tabs', () => {
  test('a click selects a tab, shows its panel and keeps the others in the page', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    await mounted(
      <Markdown>{'> [!TABS]\n> #### First\n> Alpha\n> #### Second\n> Beta'}</Markdown>,
      async (host) => {
        const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        expect(tabs).toHaveLength(2)
        expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
        await act(async () => tabs[1]!.click())
        expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
        const panel = host.querySelector<HTMLElement>(`#${tabs[1]!.getAttribute('aria-controls')}`)
        expect(panel?.hidden).toBe(false)
        expect(panel?.textContent).toContain('Beta')
        expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[1]!.id)
        // The first panel is hidden, not gone: find-in-page and copy still reach it.
        expect(host.textContent).toContain('Alpha')
      },
    )
  })

  test('the arrow keys, Home and End move between tabs and select them', async () => {
    const { Markdown } = await import('../index')
    await mounted(
      <Markdown>{'> [!TABS]\n#### A\nOne.\n#### B\nTwo.\n#### C\nThree.'}</Markdown>,
      async (host) => {
        const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const selected = () =>
          tabs().findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
        await key(tabs()[0]!, 'ArrowRight')
        expect(selected()).toBe(1)
        expect(document.activeElement).toBe(tabs()[1]!)
        await key(tabs()[1]!, 'End')
        expect(selected()).toBe(2)
        await key(tabs()[2]!, 'ArrowRight')
        expect(selected()).toBe(0)
        await key(tabs()[0]!, 'ArrowLeft')
        expect(selected()).toBe(2)
        // One Tab stop: only the selected tab is in the page's tab order.
        expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0])
      },
    )
  })
})

describe('file tree', () => {
  const TREE = '```tree\nsrc/\n├── app.ts\n└── lib/\n    └── util.ts\n```'

  test('a folder folds on click and on the arrow keys, and its rows leave the tree', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    await mounted(<Markdown>{TREE}</Markdown>, async (host) => {
      const rows = () => [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
      const names = () => rows().map((row) => row.textContent)
      expect(names()).toEqual(['src', 'app.ts', 'lib', 'util.ts'])
      await act(async () => rows()[2]!.click())
      expect(names()).toEqual(['src', 'app.ts', 'lib'])
      expect(rows()[2]!.getAttribute('aria-expanded')).toBe('false')
      await key(rows()[2]!, 'ArrowRight')
      expect(names()).toContain('util.ts')
      await key(rows()[0]!, 'ArrowLeft')
      expect(names()).toEqual(['src'])
    })
  })

  test('the arrow keys walk the visible rows, and a child goes back to its folder', async () => {
    const { Markdown } = await import('../index')
    await mounted(<Markdown>{TREE}</Markdown>, async (host) => {
      const rows = () => [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
      const { act } = await import('react')
      await act(async () => rows()[0]!.focus())
      await key(rows()[0]!, 'ArrowDown')
      expect(document.activeElement?.textContent).toBe('app.ts')
      await key(rows()[1]!, 'End')
      expect(document.activeElement?.textContent).toBe('util.ts')
      await key(rows()[3]!, 'ArrowLeft')
      expect(document.activeElement?.textContent).toBe('lib')
    })
  })

  test('a clicked row takes the focus, so the keys carry on from it', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    await mounted(<Markdown>{TREE}</Markdown>, async (host) => {
      const rows = () => [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
      // Safari does not focus a clicked row by itself; the tree must.
      await act(async () => rows()[1]!.click())
      expect(document.activeElement).toBe(rows()[1])
      expect(rows()[1]!.tabIndex).toBe(0)
      await key(rows()[1]!, 'ArrowDown')
      expect(document.activeElement?.textContent).toBe('lib')
    })
  })

  test('a key the tree handles stays in the tree; any other reaches the page', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    const page: string[] = []
    const listen = (event: KeyboardEvent) => page.push(event.key)
    document.addEventListener('keydown', listen)
    try {
      await mounted(<Markdown>{TREE}</Markdown>, async (host) => {
        const rows = () => [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')]
        await act(async () => rows()[0]!.focus())
        for (const name of ['ArrowDown', 'ArrowUp', 'End', 'Home', 'Enter', ' ', 'Escape'])
          await key(rows()[0]!, name)
        expect(page).toEqual(['Escape'])
      })
    } finally {
      document.removeEventListener('keydown', listen)
    }
  })
})

describe('code blocks', () => {
  test('the copy button copies the code and says so', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void copied.push(text) },
    })
    await mounted(<Markdown>{'```sh\nbun add llx-markdown\n```'}</Markdown>, async (host) => {
      const button = host.querySelector<HTMLButtonElement>('.llx-code-copy')!
      expect(button.getAttribute('aria-label')).toBe('Copy code')
      await act(async () => button.click())
      expect(copied).toEqual(['bun add llx-markdown'])
      expect(button.getAttribute('aria-label')).toBe('Copied')
    })
  })
})

describe('streaming', () => {
  test('a new token re-renders only the block it lands in', async () => {
    const { Markdown } = await import('../index')
    let paragraphs = 0
    const components = {
      p: ({ children }: { children?: ReactNode }) => {
        paragraphs += 1
        return <p>{children}</p>
      },
    }
    const reply = 'First paragraph.\n\nSecond paragraph.\n\nThird is arriv'
    await mounted(
      <Markdown streaming components={components}>
        {reply}
      </Markdown>,
      async (host, rerender) => {
        expect(paragraphs).toBe(3)
        paragraphs = 0
        await rerender(<Markdown streaming components={components}>{`${reply}ing`}</Markdown>)
        expect(paragraphs).toBe(1)
        expect(host.textContent).toContain('Third is arriving')
      },
    )
  })

  test('the unfinished end reads as it will when finished, and the caret follows it', async () => {
    const { Markdown } = await import('../index')
    await mounted(<Markdown streaming>{'Some **bold te'}</Markdown>, async (host, rerender) => {
      const root = host.querySelector('.llx-markdown')!
      expect(root.querySelector('strong')?.textContent).toBe('bold te')
      expect(root.hasAttribute('data-caret')).toBe(true)
      await rerender(<Markdown>{'Some **bold text**.'}</Markdown>)
      expect(root.hasAttribute('data-caret')).toBe(false)
      expect(root.hasAttribute('data-streaming')).toBe(false)
    })
  })

  test('a form marker that arrived before its content is not shown as a quote', async () => {
    const { Markdown } = await import('../index')
    await mounted(
      <Markdown streaming>{'Plan:\n\n> [!STEPS]\n'}</Markdown>,
      async (host, rerender) => {
        expect(host.querySelector('blockquote')).toBeNull()
        expect(host.textContent).not.toContain('[!STEPS]')
        await rerender(<Markdown streaming>{'Plan:\n\n> [!STEPS]\n1. **Day 1**'}</Markdown>)
        expect(host.querySelector('.llx-steps')).not.toBeNull()
      },
    )
  })
})

describe('raw HTML, loaded on demand', () => {
  test('by default the parser arrives with the first HTML, and the tags are never shown as text', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    await mounted(<Markdown>{'Press <kbd>Ctrl</kbd> to copy.'}</Markdown>, async (host) => {
      // Before the stage is there, the tags are left out rather than printed.
      expect(host.textContent).not.toContain('<kbd>')
      await act(async () => {
        await import('../html')
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(host.querySelector('kbd')?.textContent).toBe('Ctrl')
    })
  })
})

describe('math, loaded on demand', () => {
  test('the loader runs once a document holds a formula, and the formula is then typeset', async () => {
    const { Markdown } = await import('../index')
    const { act } = await import('react')
    let calls = 0
    const loader = async () => {
      calls += 1
      return import('../math')
    }
    await mounted(
      <Markdown math={loader}>{'No formulas here.'}</Markdown>,
      async (host, rerender) => {
        expect(calls).toBe(0)
        await rerender(<Markdown math={loader}>{'Area: $\\pi r^2$.'}</Markdown>)
        // Wait on the module the loader imports, not on a tick: a cold load takes longer than one.
        await act(async () => {
          await import('../math')
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        expect(calls).toBe(1)
        expect(host.querySelector('.katex')).not.toBeNull()
      },
    )
  })
})

describe('server markup', () => {
  test('hydrates without a mismatch, then shows the copy button where the page can copy', async () => {
    const { Markdown } = await import('../index')
    const { html } = await import('../html')
    const { act } = await import('react')
    const { renderToString } = await import('react-dom/server')
    const { hydrateRoot } = await import('react-dom/client')
    const doc = '> [!TABS]\n#### One\n```sh\nls\n```\n\n#### Two\nText <kbd>K</kbd>.\n'
    const page = <Markdown html={html}>{doc}</Markdown>
    // A server has no clipboard; the page it is hydrated in does.
    const clipboard = (value: unknown) =>
      Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
    clipboard(undefined)
    const host = document.createElement('div')
    host.innerHTML = renderToString(page)
    document.body.append(host)
    clipboard({ writeText: async () => {} })
    const errors: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(host, page, { onRecoverableError: (error) => errors.push(error) })
      })
      expect(errors).toEqual([])
      expect(host.querySelector('.llx-code-copy')).not.toBeNull()
    } finally {
      await act(async () => root?.unmount())
      host.remove()
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})

describe('loaders written inline, a new function on every render', () => {
  // Wait on the module a math loader imports, then a tick: a cold load takes longer than one.
  const settle = async () => {
    const { act } = await import('react')
    await act(async () => {
      await import('../math')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  test('math is loaded once and stays typeset while the page re-renders on every token', async () => {
    const { Markdown } = await import('../index')
    let loads = 0
    const page = (text: string) => (
      <Markdown
        streaming
        math={() => {
          loads++
          return import('../math')
        }}
      >
        {text}
      </Markdown>
    )
    await mounted(page('The area is $\\pi r^2$.'), async (host, rerender) => {
      await settle()
      expect(host.querySelector('.katex')).not.toBeNull()
      for (const tail of [' More', ' text', ' arrives']) {
        await rerender(page(`The area is $\\pi r^2$.${tail}`))
        expect(host.querySelector('.katex')).not.toBeNull()
      }
      await settle()
      expect(loads).toBe(1)
    })
  })

  test('a finished diagram is drawn once while the reply below it keeps growing', async () => {
    const { Markdown } = await import('../index')
    let draws = 0
    const engine = {
      initialize() {},
      parse: async () => true,
      render: async () => {
        draws++
        return { svg: '<svg viewBox="0 0 10 10"><g></g></svg>' }
      },
    }
    const page = (text: string) => (
      <Markdown streaming mermaid={async () => engine}>
        {text}
      </Markdown>
    )
    const diagram = '```mermaid\nflowchart LR\n  A --> B\n```\n\n'
    await mounted(page(`${diagram}Then`), async (host, rerender) => {
      await settle()
      expect(host.querySelector('svg')).not.toBeNull()
      for (const tail of [' more', ' text', ' arrives']) {
        await rerender(page(`${diagram}Then${tail}`))
        await settle()
      }
      expect(draws).toBe(1)
      expect(host.querySelector('svg')).not.toBeNull()
    })
  })
})
