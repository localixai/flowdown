/** A page's `components` draw every element of that name, also the ones the renderer writes itself. */
import { expect, test } from 'bun:test'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { render } from '../../test/render'
import type { MarkdownComponents, Node } from '../index'

test("a task's box is drawn by the page's `input`, with the item's offset", () => {
  const LIST = '- [ ] one\n- [x] two\n\n- [ ] loose\n\n  more'
  const Input = (props: ComponentPropsWithoutRef<'input'> & { 'data-task-key'?: number }) => (
    <button type="button" data-box={props['data-task-key']} aria-pressed={Boolean(props.checked)}>
      tick
    </button>
  )
  const html = render(LIST, { components: { input: Input as never } })
  expect(html).not.toContain('<input')
  expect(html).toContain('<button type="button" data-box="0" aria-pressed="false">tick')
  expect(html).toContain(`data-box="${LIST.indexOf('- [x]')}" aria-pressed="true"`)
  expect(html).toContain(`data-box="${LIST.indexOf('- [ ] loose')}"`)
})

test("footnotes are drawn with the page's elements", () => {
  const tag = (name: string) => (props: { children?: unknown }) => (
    <span data-el={name}>{props.children as never}</span>
  )
  const html = render('A[^a] and again[^a].\n\n[^a]: The note.', {
    components: {
      section: tag('section'),
      ol: tag('ol'),
      li: tag('li'),
      p: tag('p'),
      h2: tag('h2'),
      sup: tag('sup'),
    } as never,
  })
  for (const name of ['section', 'ol', 'li', 'h2'])
    expect(html, name).toContain(`<span data-el="${name}">`)
  // The note's own paragraph, and the number on its second way back.
  expect(html).toContain('<span data-el="p">The note.')
  expect(html).toContain('<span data-el="sup">2</span>')
  expect(html).not.toMatch(/<(section|ol|li|h2)[ >]/)
})

test('`unstyled` leaves the package class off, so its stylesheet does not reach the page', () => {
  expect(render('Text.')).toContain('<div class="llx-markdown">')
  expect(render('Text.', { unstyled: true })).toBe('<div><p>Text.</p></div>')
  expect(render('Text.', { unstyled: true, className: 'notes' })).toBe(
    '<div class="notes"><p>Text.</p></div>',
  )
})

test("a map with the page's own tag beside HTML tags is a `components` value", () => {
  const Wrapper = ({ node, children }: { node?: Node; children?: ReactNode }) => (
    <aside data-type={node?.type}>{children}</aside>
  )
  // Checked by the compiler: a custom tag spread into a map of intrinsic ones.
  const components: MarkdownComponents = {
    ...({ 'my-wrapper': Wrapper } as MarkdownComponents),
    em: ({ children }) => <i>{children}</i>,
    tree: ({ source }) => <pre>{source}</pre>,
  }
  expect(render('*x*', { components })).toContain('<i>x</i>')
})
