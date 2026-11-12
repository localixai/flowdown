/** The HTML writer of the plain-element factory: what it escapes, names and leaves out. */
import { expect, test } from 'bun:test'
import { expand, toHtml, vnode, type VNode } from './vnode'

const el = (tag: string, props: Record<string, unknown> | null, ...children: VNode[]) =>
  vnode.element(tag, props, children)

test('text and attribute values are escaped', () => {
  expect(toHtml(el('p', { title: `a"b<c>&'` }, `1 < 2 & "3" > '0'`))).toBe(
    '<p title="a&quot;b&lt;c&gt;&amp;&#x27;">1 &lt; 2 &amp; &quot;3&quot; &gt; &#x27;0&#x27;</p>',
  )
})

test('properties are written under their attribute names', () => {
  expect(toHtml(el('label', { className: 'a b', htmlFor: 'x', tabIndex: 0 }))).toBe(
    '<label class="a b" for="x" tabindex="0"></label>',
  )
})

test('what is not an attribute is left out', () => {
  const html = toHtml(
    el('div', {
      key: 'k',
      ref: () => {},
      node: { type: 'paragraph' },
      onClick: () => {},
      hidden: false,
      title: undefined,
      lang: null,
      'data-x': true,
      'aria-selected': false,
    }),
  )
  expect(html).toBe('<div data-x="true" aria-selected="false"></div>')
})

test('a handler, a script URL and a bad attribute name never reach the page', () => {
  const html = toHtml(
    el('a', {
      onclick: 'alert(1)',
      'on"x': '1',
      'x y': '1',
      '"><script>': '1',
      href: 'https://a.b/',
    }),
  )
  expect(html).toBe('<a href="https://a.b/"></a>')
})

test('boolean attributes are there or not', () => {
  expect(toHtml(el('input', { type: 'checkbox', disabled: true, checked: false }))).toBe(
    '<input type="checkbox" disabled=""/>',
  )
})

test('a style object is written as CSS', () => {
  expect(
    toHtml(el('i', { style: { '--depth': 2, marginLeft: 4, lineHeight: 1.5, color: 'red' } })),
  ).toBe('<i style="--depth:2;margin-left:4px;line-height:1.5;color:red"></i>')
})

test('void elements have no inside and no closing tag', () => {
  expect(
    toHtml(el('p', null, 'a', el('br', null), 'b', el('img', { src: 'x.png', alt: '' }))),
  ).toBe('<p>a<br/>b<img src="x.png" alt=""/></p>')
})

test('innerHTML goes in as it is, in place of children', () => {
  expect(toHtml(el('code', { innerHTML: '<span class="k">let</span>' }, 'ignored'))).toBe(
    '<code><span class="k">let</span></code>',
  )
})

test('a line break first in a <pre> is kept: the parser drops one', () => {
  expect(toHtml(el('pre', null, '\nfirst'))).toBe('<pre>\n\nfirst</pre>')
  expect(toHtml(el('pre', null, '\n', el('b', null, 'x')))).toBe('<pre>\n\n<b>x</b></pre>')
  expect(toHtml(el('pre', { innerHTML: '\nraw' }))).toBe('<pre>\n\nraw</pre>')
  expect(toHtml(el('pre', null, 'first\n'))).toBe('<pre>first\n</pre>')
  expect(toHtml(el('pre', null, el('code', null, '\nx')))).toBe('<pre><code>\nx</code></pre>')
  expect(toHtml(el('p', null, '\nx'))).toBe('<p>\nx</p>')
})

test('a component is called with its props and children', () => {
  const Box = (props: Record<string, unknown>, children: VNode[]): VNode =>
    el('div', { className: String(props.kind) }, ...children)
  const tree = vnode.element(Box, { kind: 'note' }, ['a', el('b', null, 'c')])
  expect(toHtml(tree)).toBe('<div class="note">a<b>c</b></div>')
  // Expanded, nothing is left to call: the tree is elements and text.
  expect(expand(tree)).toEqual([
    {
      tag: 'div',
      props: { className: 'note' },
      children: ['a', { tag: 'b', props: null, children: ['c'] }],
    },
  ])
  expect(toHtml(expand(tree))).toBe('<div class="note">a<b>c</b></div>')
})

test('lists of children flatten, and nothing draws nothing', () => {
  expect(toHtml(el('p', null, ['a', ['b', []]], [], 'c'))).toBe('<p>abc</p>')
  expect(toHtml([])).toBe('')
})

test('expanded children are flat and hold no empty text', () => {
  const tree = el('p', null, ['a', ['', ['b']]], '', [el('i', null, [[]], '')])
  expect(expand(tree)).toEqual([
    { tag: 'p', props: null, children: ['a', 'b', { tag: 'i', props: null, children: [] }] },
  ])
})
