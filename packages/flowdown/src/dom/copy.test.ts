/**
 * What a reader's copy of a document drawn by `@localix-ai/flowdown/dom` puts on the clipboard:
 * the reply's own elements, none of the page's styles, controls or icons.
 */
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import { registerDom } from '../../test/dom'
import { mount, type Mounted } from './index'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.destroy()
  mounted = null
  document.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
})

const REPLY = [
  'Some **bold words** with `code`, [a link](https://example.com/a) and [a file](./notes.md).',
  '',
  '```ts title="a.ts"',
  'const a = 1',
  '```',
  '',
  '- [x] done',
  '- [ ] to do',
].join('\n')

const show = (markdown: string) => {
  mounted = mount(document.body.appendChild(document.createElement('div')))
  mounted.update(markdown)
  return mounted.element
}

/** Selects `range` and copies it as a reader would; what went to the clipboard, if the copy was answered. */
const copy = (range: Range, at: Element) => {
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const data = new DataTransfer()
  const event = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true })
  at.dispatchEvent(event)
  return event.defaultPrevented
    ? { html: data.getData('text/html'), text: data.getData('text/plain') }
    : null
}

test('a part of a word in bold is copied as bold, inside its paragraph', () => {
  const root = show(REPLY)
  const words = root.querySelector('strong')!.firstChild!
  const range = document.createRange()
  range.setStart(words, 1)
  range.setEnd(words, 7)
  const copied = copy(range, root)
  expect(copied?.html).toBe('<meta charset="utf-8"><p><strong>old wo</strong></p>')
  expect(copied?.text).toBe('old wo')
})

test('the whole document is copied as its elements, with nothing of the page', () => {
  const root = show(REPLY)
  const range = document.createRange()
  range.selectNodeContents(root)
  const html = copy(range, root)!.html
  // No class, style or handler, and no button, icon or language label of a code block's bar.
  expect(html).not.toMatch(/\s(?:class|style|data-[\w-]+|on\w+|aria-[\w-]+)=/)
  expect(html).not.toMatch(/<(?:button|svg|input)\b/)
  expect(html).toContain('<code>const a = 1')
  // A web address is kept; one the paste cannot reach is not.
  expect(html).toContain('<a href="https://example.com/a">a link</a>')
  expect(html).toContain('<a>a file</a>')
  // A task's box is the mark of its state.
  expect(html).toContain('☑ done')
  expect(html).toContain('☐ to do')
})

test('a selection that runs out of the document is left to the browser', () => {
  const root = show(REPLY)
  const outside = document.body.appendChild(document.createElement('p'))
  outside.textContent = 'The page around the reply.'
  const range = document.createRange()
  range.setStart(root.querySelector('strong')!.firstChild!, 0)
  range.setEnd(outside.firstChild!, 4)
  expect(copy(range, root)).toBeNull()
})

test('once destroyed, the document answers no copy', () => {
  const root = show(REPLY)
  const host = root.parentElement!
  const range = document.createRange()
  range.selectNodeContents(root.querySelector('strong')!)
  mounted!.destroy()
  mounted = null
  host.appendChild(root)
  expect(copy(range, root)).toBeNull()
})
