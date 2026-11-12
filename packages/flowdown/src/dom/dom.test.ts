/**
 * `flowdown/dom` held to three things, on the golden corpus:
 *
 * 1. A document on the page is the HTML `flowdown/static` writes for it, parsed.
 * 2. A page kept up to date token by token ends the same as one drawn at once: what the patcher
 *    leaves alone, changes and makes is right at every step.
 * 3. A block that did not change keeps its very nodes.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { prefixes, type Pattern } from '../../test/chunks'
import { registerDom } from '../../test/dom'
import { FAMILIES, namedDocuments } from '../../test/golden'
import { highlight } from '../highlight'
import { html } from '../html'
import { math } from '../math'
import { renderToHtml } from '../static'
import { mount, type MountOptions } from './index'

let teardown: () => Promise<void>
beforeAll(() => {
  teardown = registerDom()
})
afterAll(() => teardown())

/** Seeded documents per family here: every one is drawn at each of its prefixes. */
const SEEDS = Number(process.env.DOM_SEEDS ?? 60)

/** Each mount names its tabs with a number of its own; the static HTML has none. */
const sameIds = (markup: string) => markup.replace(/fd-(?:\d+-)?(\d+)-(tab|panel)-/g, 'fd-$1-$2-')

const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * A node as text, with an element's attributes in the order of their names: a page changed in
 * place gets a new attribute after the ones it had, and that order says nothing.
 */
function canonical(node: Node): string {
  if (node.nodeType === 3) return escaped((node as Text).data)
  if (node.nodeType !== 1) return ''
  const element = node as Element
  const attributes = [...element.attributes]
    .map((attribute) => ` ${attribute.name}="${escaped(attribute.value).replace(/"/g, '&quot;')}"`)
    .toSorted()
    .join('')
  let inside = ''
  for (const child of element.childNodes) inside += canonical(child)
  return `<${element.localName}${attributes}>${inside}</${element.localName}>`
}

const shown = (element: Element): string => sameIds(canonical(element))

const host = () => document.body.appendChild(document.createElement('div'))

const drawn = (markdown: string, options: MountOptions, streaming: boolean): string => {
  const target = host()
  const mounted = mount(target, options)
  mounted.update(markdown, { streaming })
  const markup = shown(mounted.element)
  mounted.destroy()
  target.remove()
  return markup
}

/**
 * HTML text as a parser reads it. A parser drops a line break that comes first in a `<pre>`
 * (which is why the writer puts two); happy-dom's keeps it, so it is taken out here.
 */
const parsed = (markup: string): string => {
  const template = document.createElement('template')
  template.innerHTML = markup.replace(/(<pre[^>]*>)\n/g, '$1')
  return shown(template.content.firstElementChild as Element)
}

const parting = (a: string, b: string): string => {
  let at = 0
  while (at < a.length && a[at] === b[at]) at += 1
  return `at ${at}\n  expected: ${JSON.stringify(a.slice(Math.max(0, at - 60), at + 80))}\n  actual:   ${JSON.stringify(b.slice(Math.max(0, at - 60), at + 80))}`
}

const OPTIONS: Record<string, MountOptions> = {
  plain: {},
  rich: { html, math, highlight, headingIds: true },
}

const documents = (): Array<[string, string]> => {
  const all = Object.entries(namedDocuments())
  for (const [family, document] of Object.entries(FAMILIES))
    for (let seed = 1; seed <= SEEDS; seed += 1) all.push([`${family} ${seed}`, document(seed)])
  return all
}

describe('a document on the page', () => {
  test('is the static HTML, parsed', () => {
    const failures: string[] = []
    for (const [name, markdown] of documents())
      for (const [way, options] of Object.entries(OPTIONS))
        for (const streaming of [false, true]) {
          const expected = parsed(renderToHtml(markdown, { ...options, streaming }))
          const actual = drawn(markdown, options, streaming)
          if (expected !== actual && failures.length < 5)
            failures.push(
              `${name} [${way}${streaming ? ', streaming' : ''}]\n${parting(expected, actual)}`,
            )
        }
    expect(failures).toEqual([])
  }, 120_000)
})

describe('a page kept up to date', () => {
  const PATTERNS: Pattern[] = ['token', 'frame', 'line']

  test('ends the same as one drawn at once, at every step', () => {
    const failures: string[] = []
    let steps = 0
    for (const [name, markdown] of documents()) {
      // One pattern a document, by its place: all three are walked across the corpus.
      const pattern = PATTERNS[steps % PATTERNS.length]!
      const options = steps % 2 === 0 ? OPTIONS.rich! : OPTIONS.plain!
      const target = host()
      const mounted = mount(target, options)
      const texts = prefixes(markdown, pattern, markdown.length)
      for (const [index, text] of texts.entries()) {
        mounted.update(text, { streaming: true })
        steps += 1
        // Every step is drawn; a long document is compared at some thirty of them and its last.
        const stride = Math.ceil(texts.length / 30)
        if (index % stride !== 0 && index !== texts.length - 1) continue
        const expected = drawn(text, options, true)
        const actual = shown(mounted.element)
        if (expected !== actual) {
          if (failures.length < 5)
            failures.push(
              `${name} [${pattern}] step ${index}\n${JSON.stringify(text.slice(-120))}\n${parting(expected, actual)}`,
            )
          break
        }
      }
      mounted.update(markdown)
      const expected = drawn(markdown, options, false)
      const actual = shown(mounted.element)
      if (expected !== actual && failures.length < 5)
        failures.push(`${name} [${pattern}] finished\n${parting(expected, actual)}`)
      mounted.destroy()
      target.remove()
    }
    expect(failures).toEqual([])
    expect(steps).toBeGreaterThan(1000)
  }, 120_000)

  test('shrinking and replacing the text is drawn as well as growing it', () => {
    const texts = Object.values(namedDocuments())
    const target = host()
    const mounted = mount(target, OPTIONS.rich)
    const failures: string[] = []
    // Each document after the other, then back: nothing of the one before may be left.
    for (const markdown of [...texts, ...texts.toReversed(), '', texts[0]!]) {
      mounted.update(markdown)
      const expected = drawn(markdown, OPTIONS.rich!, false)
      const actual = shown(mounted.element)
      if (expected !== actual && failures.length < 3)
        failures.push(`${JSON.stringify(markdown.slice(0, 80))}\n${parting(expected, actual)}`)
    }
    mounted.destroy()
    expect(failures).toEqual([])
  })

  test('a block that did not change keeps its nodes', () => {
    const target = host()
    const mounted = mount(target)
    const first = '# Title\n\nA first paragraph.\n\n```ts\nconst a = 1\n```\n\n'
    mounted.update(`${first}A second`, { streaming: true })
    const before = [...mounted.element.children]
    const root = mounted.element
    mounted.update(`${first}A second paragraph, still **arriving`, { streaming: true })
    mounted.update(`${first}A second paragraph, still **arriving**.\n\n- and a list`, {
      streaming: true,
    })
    expect(mounted.element).toBe(root)
    const after = [...mounted.element.children]
    expect(before.length).toBe(4)
    expect(after.length).toBe(5)
    // The heading, the paragraph, the code block: the same nodes. And the paragraph that grew
    // is the same node too, changed in place.
    for (const [index, node] of before.entries()) expect(after[index]).toBe(node)
    expect(after[3]!.innerHTML).toBe('A second paragraph, still <strong>arriving</strong>.')
    mounted.destroy()
    expect(target.children.length).toBe(0)
  })

  test('the same text again touches nothing', () => {
    const target = host()
    const mounted = mount(target, OPTIONS.rich)
    const markdown = namedDocuments().reply!
    mounted.update(markdown)
    const changes: MutationRecord[] = []
    const observer = new MutationObserver((records) => changes.push(...records))
    observer.observe(mounted.element, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    mounted.update(markdown)
    changes.push(...observer.takeRecords())
    observer.disconnect()
    expect(changes.length).toBe(0)
    mounted.destroy()
  })
})
