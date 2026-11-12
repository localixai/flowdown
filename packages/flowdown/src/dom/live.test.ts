/** What a reader does on a page drawn by `@localix-ai/flowdown/dom`: tabs, a file tree, a code block's buttons. */
import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from 'bun:test'
import { registerDom } from '../../test/dom'
import { defineMarkdownElement, type MarkdownElement } from '../element'
import { mount, type Mounted } from './index'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

let mounted: Mounted | null = null
const show = (markdown: string, options: Parameters<typeof mount>[1] = {}, streaming = false) => {
  mounted = mount(document.body.appendChild(document.createElement('div')), options)
  mounted.update(markdown, { streaming })
  return mounted
}
afterEach(() => {
  mounted?.destroy()
  mounted = null
  document.body.innerHTML = ''
})

const all = (selector: string) => [...mounted!.element.querySelectorAll<HTMLElement>(selector)]
const press = (element: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  element.dispatchEvent(event)
  return event
}

const TABS =
  '> [!TABS]\n#### macOS\nbrew install x\n#### Linux\napt install x\n#### Windows\nwinget install x\n\n---\n'

describe('tabs', () => {
  const selected = () => all('[role=tab]').map((tab) => tab.getAttribute('aria-selected'))
  const hidden = () => all('[role=tabpanel]').map((panel) => panel.hasAttribute('hidden'))

  test('the first is shown; a click shows another', () => {
    show(TABS)
    expect(selected()).toEqual(['true', 'false', 'false'])
    expect(hidden()).toEqual([false, true, true])
    all('[role=tab]')[1]!.click()
    expect(selected()).toEqual(['false', 'true', 'false'])
    expect(hidden()).toEqual([true, false, true])
    expect(all('[role=tab]').map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  test('the arrow keys, Home and End move, select and focus, around the ends', () => {
    show(TABS)
    const tabs = all('[role=tab]')
    tabs[0]!.focus()
    expect(press(tabs[0]!, 'ArrowRight').defaultPrevented).toBe(true)
    expect(selected()).toEqual(['false', 'true', 'false'])
    expect(document.activeElement).toBe(tabs[1]!)
    press(tabs[1]!, 'End')
    expect(document.activeElement).toBe(tabs[2]!)
    press(tabs[2]!, 'ArrowRight')
    expect(selected()).toEqual(['true', 'false', 'false'])
    press(tabs[0]!, 'ArrowLeft')
    expect(selected()).toEqual(['false', 'false', 'true'])
    press(tabs[2]!, 'Home')
    expect(document.activeElement).toBe(tabs[0]!)
    // A key the tabs do not use is left to the page.
    expect(press(tabs[0]!, 'a').defaultPrevented).toBe(false)
    expect(selected()).toEqual(['true', 'false', 'false'])
  })

  test('the tab a reader chose stays while the reply goes on arriving', () => {
    const open = '> [!TABS]\n#### macOS\nbrew install x\n#### Linux\napt install'
    show(open, {}, true)
    const tabs = all('[role=tab]')
    tabs[1]!.click()
    mounted!.update(`${open} x\n#### Windows\nwinget`, { streaming: true })
    expect(selected()).toEqual(['false', 'true', 'false'])
    expect(all('[role=tab]')[1]).toBe(tabs[1]!)
    mounted!.update(`${open} x\n#### Windows\nwinget install x\n\n---\n\nAfter.`)
    expect(selected()).toEqual(['false', 'true', 'false'])
    expect(hidden()).toEqual([true, false, true])
  })

  test('two documents on one page do not share ids', () => {
    show(TABS)
    const first = all('[role=tab]').map((tab) => tab.id)
    const other = mount(document.body.appendChild(document.createElement('div')))
    other.update(TABS)
    const second = [...other.element.querySelectorAll('[role=tab]')].map((tab) => tab.id)
    other.destroy()
    expect(new Set([...first, ...second]).size).toBe(6)
    for (const tab of all('[role=tab]'))
      expect(document.getElementById(tab.getAttribute('aria-controls')!)).not.toBeNull()
  })
})

const TREE = '```tree\nsrc/\n├── app.ts\n└── lib/\n    └── util.ts\nREADME.md\n```\n'

describe('a file tree', () => {
  const names = () => all('[role=treeitem]').map((row) => row.textContent)

  test('a folder folds and unfolds on a click', () => {
    show(TREE)
    expect(names()).toEqual(['src', 'app.ts', 'lib', 'util.ts', 'README.md'])
    all('[role=treeitem]')[0]!.click()
    expect(names()).toEqual(['src', 'README.md'])
    expect(all('[role=treeitem]')[0]!.getAttribute('aria-expanded')).toBe('false')
    all('[role=treeitem]')[0]!.click()
    expect(names()).toEqual(['src', 'app.ts', 'lib', 'util.ts', 'README.md'])
    expect(all('[role=treeitem]')[0]!.getAttribute('aria-expanded')).toBe('true')
  })

  test('the arrow keys walk the rows, and fold and unfold', () => {
    show(TREE)
    const focusedName = () => (document.activeElement as HTMLElement).textContent
    const rows = () => all('[role=treeitem]')
    rows()[0]!.focus()
    const down = press(rows()[0]!, 'ArrowDown')
    expect(down.defaultPrevented).toBe(true)
    expect(focusedName()).toBe('app.ts')
    press(document.activeElement!, 'ArrowDown')
    expect(focusedName()).toBe('lib')
    // On an open folder: left folds it, left again goes to its parent.
    press(document.activeElement!, 'ArrowLeft')
    expect(names()).toEqual(['src', 'app.ts', 'lib', 'README.md'])
    expect(focusedName()).toBe('lib')
    press(document.activeElement!, 'ArrowLeft')
    expect(focusedName()).toBe('src')
    // Right on a folded folder unfolds it; right again steps in.
    press(rows()[2]!, 'ArrowRight')
    expect(names()).toEqual(['src', 'app.ts', 'lib', 'util.ts', 'README.md'])
    press(document.activeElement!, 'End')
    expect(focusedName()).toBe('README.md')
    press(document.activeElement!, 'Home')
    expect(focusedName()).toBe('src')
    press(document.activeElement!, 'Enter')
    expect(names()).toEqual(['src', 'README.md'])
    press(document.activeElement!, ' ')
    expect(names().length).toBe(5)
    // One Tab stop for the tree: the row that has the focus.
    expect(rows().filter((row) => row.getAttribute('tabindex') === '0').length).toBe(1)
    expect(document.activeElement!.getAttribute('tabindex')).toBe('0')
  })

  test('a key the tree handles does not reach the page; one it leaves does', () => {
    show(TREE)
    const seen: string[] = []
    const listen = (event: Event) => seen.push((event as KeyboardEvent).key)
    document.body.addEventListener('keydown', listen)
    const row = all('[role=treeitem]')[0]!
    press(row, 'ArrowDown')
    press(row, 'Escape')
    document.body.removeEventListener('keydown', listen)
    expect(seen).toEqual(['Escape'])
  })
})

describe('a code block', () => {
  const CODE = 'Run it:\n\n```ts title="src/app.ts"\nconst a = 1\n```\n'

  test('copies its code, says so, and goes back to offering it', async () => {
    jest.useFakeTimers()
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    })
    try {
      show(CODE)
      const button = all('.fd-code-copy')[0]!
      expect(button.getAttribute('aria-label')).toBe('Copy code')
      button.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(written).toEqual(['const a = 1'])
      expect(all('.fd-code-copy')[0]).toBe(button)
      expect(button.getAttribute('aria-label')).toBe('Copied')
      expect(button.getAttribute('data-copied')).toBe('true')
      jest.advanceTimersByTime(1_700)
      expect(button.getAttribute('aria-label')).toBe('Copy code')
      expect(button.hasAttribute('data-copied')).toBe(false)
    } finally {
      jest.useRealTimers()
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  test('saves its code under the file its fence names', () => {
    const saved: Array<{ name: string; href: string }> = []
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, href: this.href })
    }
    try {
      show(CODE)
      all('.fd-code-download')[0]!.click()
    } finally {
      HTMLAnchorElement.prototype.click = click
    }
    expect(saved.map((file) => file.name)).toEqual(['app.ts'])
  })

  test('a fence still being written has the same buttons, and they copy what is there', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    })
    try {
      show('```ts\nconst a = 1\nconst b', {}, true)
      all('.fd-code-copy')[0]!.click()
      await Promise.resolve()
      mounted!.update('```ts\nconst a = 1\nconst b = 2\n', { streaming: true })
      all('.fd-code-copy')[0]!.click()
      await Promise.resolve()
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
    expect(written).toEqual(['const a = 1\nconst b', 'const a = 1\nconst b = 2'])
  })
})

describe('the page itself', () => {
  test('icons are SVG elements, not HTML ones named svg', () => {
    show('> [!NOTE]\n> Text.\n')
    const icon = mounted!.element.querySelector('svg')!
    expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(icon.firstElementChild!.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(icon.getAttribute('stroke-width')).toBe('1.75')
  })

  test('a task list shows its boxes ticked or not, and they cannot be changed', () => {
    show('- [x] done\n- [ ] not yet\n')
    const boxes = all('input[type=checkbox]') as HTMLInputElement[]
    expect(boxes.map((box) => box.checked)).toEqual([true, false])
    expect(boxes.every((box) => box.disabled)).toBe(true)
    mounted!.update('- [ ] done\n- [x] not yet\n')
    expect((all('input[type=checkbox]') as HTMLInputElement[]).map((box) => box.checked)).toEqual([
      false,
      true,
    ])
  })

  test('a table wider than its box becomes a group the keyboard can scroll', () => {
    const widths = { scroll: 900, client: 400 }
    const scroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')
    const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')
    Object.defineProperty(Element.prototype, 'scrollWidth', {
      configurable: true,
      get: () => widths.scroll,
    })
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      get: () => widths.client,
    })
    try {
      show('| a | b |\n|---|---|\n| 1 | 2 |\n')
      const box = all('.fd-table')[0]!
      expect(box.getAttribute('role')).toBe('group')
      expect(box.getAttribute('tabindex')).toBe('0')
      expect(box.getAttribute('aria-label')).toBe('Scrollable table')
      // Drawing again leaves what was measured: the drawing does not say otherwise.
      mounted!.update('| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n')
      expect(all('.fd-table')[0]).toBe(box)
      expect(box.getAttribute('role')).toBe('group')
      expect(all('tbody tr').length).toBe(2)
      // A code block's `<pre>` scrolls the same way, and is named for what it is.
      mounted!.update('```sh\necho a very long line\n```\n')
      const pre = all('.fd-code pre')[0]!
      expect(pre.getAttribute('role')).toBe('group')
      expect(pre.getAttribute('tabindex')).toBe('0')
      expect(pre.getAttribute('aria-label')).toBe('Scrollable code')
    } finally {
      if (scroll) Object.defineProperty(Element.prototype, 'scrollWidth', scroll)
      if (client) Object.defineProperty(Element.prototype, 'clientWidth', client)
    }
    mounted!.destroy()
    show('| a | b |\n|---|---|\n| 1 | 2 |\n')
    expect(all('.fd-table')[0]!.hasAttribute('role')).toBe(false)
  })

  test('your own elements and labels are drawn', () => {
    show(
      'See [the docs](https://example.com).\n\n```mermaid\ngraph TD\n```\n\n```tree\nsrc/\n```\n\n> [!WARNING]\n> Careful.\n',
      {
        labels: { callouts: { warning: 'Внимание' } },
        components: {
          a: (props, children) => ({
            tag: 'a',
            props: { href: props.href, target: '_blank', rel: 'noopener' },
            children,
          }),
        },
        diagram: (source) => ({
          tag: 'pre',
          props: { className: 'my-diagram' },
          children: [source],
        }),
        tree: (source) => ({ tag: 'pre', props: { className: 'my-tree' }, children: [source] }),
      },
    )
    const link = all('a')[0]!
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.textContent).toBe('the docs')
    expect(all('.my-diagram')[0]!.textContent).toBe('graph TD')
    expect(all('.my-tree')[0]!.textContent).toBe('src/')
    expect(all('[role=tree]').length).toBe(0)
    expect(all('.fd-callout')[0]!.getAttribute('aria-label')).toBe('Внимание')
  })

  test('destroy takes the document off the page, and nothing is drawn after it', () => {
    const target = document.body.appendChild(document.createElement('div'))
    target.innerHTML = '<p>kept</p>'
    const own = mount(target)
    own.update('Text.')
    expect(target.children.length).toBe(2)
    expect(target.lastElementChild).toBe(own.element)
    own.destroy()
    own.update('More.')
    own.destroy()
    expect(target.innerHTML).toBe('<p>kept</p>')
  })
})

describe('<flow-down>', () => {
  test('shows the text written inside it, then the text it is given', () => {
    defineMarkdownElement()
    defineMarkdownElement()
    const element = document.createElement('flow-down') as MarkdownElement
    element.textContent = '# Hello\n\nA *reply*.'
    document.body.append(element)
    expect(element.querySelector('h1')!.textContent).toBe('Hello')
    expect(element.querySelector('em')!.textContent).toBe('reply')
    expect(element.children.length).toBe(1)
    expect(element.firstElementChild!.className).toBe('flowdown')
    const root = element.firstElementChild

    element.streaming = true
    element.markdown = 'Now **arriving'
    expect(element.firstElementChild).toBe(root)
    expect(element.querySelector('strong')!.textContent).toBe('arriving')
    expect(root!.getAttribute('data-streaming')).toBe('true')
    expect(element.getAttribute('streaming')).toBe('')

    element.removeAttribute('streaming')
    expect(element.streaming).toBe(false)
    expect(root!.hasAttribute('data-streaming')).toBe(false)
    expect(element.markdown).toBe('Now **arriving')
    expect(element.querySelector('strong')).toBeNull()

    element.remove()
    expect(element.children.length).toBe(0)
    // Put back, it shows what it was last given.
    document.body.append(element)
    expect(element.querySelector('p')!.textContent).toBe('Now **arriving')
  })

  test('a text set before the element is on the page is shown when it gets there', () => {
    defineMarkdownElement('my-reply', { headingIds: true })
    const element = document.createElement('my-reply') as MarkdownElement
    element.markdown = '## Setup'
    expect(element.children.length).toBe(0)
    document.body.append(element)
    expect(element.querySelector('h2')!.id).toBe('setup')
  })
})
