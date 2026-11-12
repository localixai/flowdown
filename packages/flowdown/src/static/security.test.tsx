/**
 * The HTML text and the DOM target under the attacks React's renderer is held to
 * (`react/security.test.tsx`): every payload, at every prefix a stream could stop at and inside
 * other content. Each page is read back for anything that could act, and the HTML text is also
 * held to be, byte for byte, what React writes for the same payload.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { comparable } from '../../test/compare'
import { registerDom } from '../../test/dom'
import { findings, PAYLOADS, WRAPS } from '../../test/security'
import { mount } from '../dom'
import { html } from '../html'
import { Markdown } from '../index'
import { math } from '../math'
import { renderToHtml } from './index'

const react = (markdown: string, streaming: boolean) =>
  comparable(
    renderToStaticMarkup(
      <Markdown html={html} math={math} streaming={streaming}>
        {markdown}
      </Markdown>,
    ),
  )

const own = (markdown: string, streaming: boolean) =>
  comparable(renderToHtml(markdown, { html, math, streaming }))

const attacks = (): Array<[markdown: string, streaming: boolean]> => {
  const all: Array<[string, boolean]> = []
  for (const payload of PAYLOADS) {
    for (let end = 1; end <= payload.length; end += 1) all.push([payload.slice(0, end), true])
    for (const around of WRAPS) all.push([around(payload), false])
  }
  all.push([PAYLOADS.join('\n\n'), false], [PAYLOADS.join(' '), false])
  return all
}

describe('the HTML text under attack', () => {
  test('nothing a reply writes can act on the page', () => {
    const failures: string[] = []
    for (const [markdown, streaming] of attacks()) {
      const found = findings(renderToHtml(markdown, { html, math, streaming }), { katex: true })
      if (found.length > 0) failures.push(`${JSON.stringify(markdown)} ${JSON.stringify(found)}`)
    }
    expect(failures.slice(0, 5)).toEqual([])
  })

  test('is what React writes', () => {
    const failures: string[] = []
    for (const [markdown, streaming] of attacks())
      if (own(markdown, streaming) !== react(markdown, streaming)) failures.push(markdown)
    expect(failures.slice(0, 5)).toEqual([])
  })

  test('a refused URL is dropped, not left as an empty attribute', () => {
    expect(renderToHtml('[x](javascript:alert(1))')).toContain('<a>x</a>')
    expect(renderToHtml('![x](javascript:alert(1))')).toContain('<img alt="x"/>')
    expect(renderToHtml('<a href="vbscript:x">z</a>', { html })).toContain('<a>z</a>')
    expect(renderToHtml('[x](https://ok.example)', { urlTransform: () => null })).toContain(
      '<a>x</a>',
    )
    expect(renderToHtml('[x](https://ok.example)')).toContain('<a href="https://ok.example">x</a>')
  })

  test('without the HTML pass, tags are left out', () => {
    for (const payload of PAYLOADS) {
      const page = renderToHtml(payload)
      expect(findings(page), payload).toEqual([])
    }
  })
})

describe('the DOM target under attack', () => {
  let teardown: () => Promise<void>
  beforeAll(() => {
    teardown = registerDom()
  })
  afterAll(() => teardown())

  test('nothing a reply writes can act on the page', () => {
    const target = document.body.appendChild(document.createElement('div'))
    // One page for every attack, each drawn over the one before: what an attack leaves behind
    // would be found under the next.
    const mounted = mount(target, { html, math })
    const failures: string[] = []
    for (const [markdown, streaming] of attacks()) {
      mounted.update(markdown, { streaming })
      const found = findings(mounted.element.outerHTML, { katex: true })
      // The page itself, not its markup: no element a reply named, no handler set as an attribute.
      for (const element of mounted.element.querySelectorAll('*'))
        for (const attribute of element.attributes)
          if (attribute.name.toLowerCase().startsWith('on'))
            found.push({ tag: element.localName, problem: `handler ${attribute.name}` })
      if (
        mounted.element.querySelector(
          'script, iframe, object, embed, style, link, meta, base, form',
        )
      )
        found.push({ tag: '*', problem: 'forbidden element on the page' })
      if (found.length > 0) failures.push(`${JSON.stringify(markdown)} ${JSON.stringify(found)}`)
    }
    mounted.destroy()
    expect(failures.slice(0, 5)).toEqual([])
  })
})
