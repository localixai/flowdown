/**
 * The HTML `flowdown/static` writes, against the HTML React writes for `<Markdown>`: the same
 * document through two renderers that share no serializer, compared to the byte. Every document of
 * the golden corpus, whole and cut mid-stream.
 *
 * `comparable` (`test/compare.ts`) names the three things the comparison leaves out.
 */
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { comparable } from '../../test/compare'
import { cuts, FAMILIES, namedDocuments, SEEDS } from '../../test/golden'
import { highlight } from '../highlight'
import { html } from '../html'
import { Markdown } from '../index'
import { math } from '../math'
import { renderToHtml } from './index'

type Pair = [react: (markdown: string) => string, own: (markdown: string) => string]

const WAYS: Record<string, Pair> = {
  whole: [
    (markdown) =>
      renderToStaticMarkup(
        <Markdown html={html} headingIds>
          {markdown}
        </Markdown>,
      ),
    (markdown) => renderToHtml(markdown, { html, headingIds: true }),
  ],
  'no html': [
    (markdown) => renderToStaticMarkup(<Markdown html={false}>{markdown}</Markdown>),
    (markdown) => renderToHtml(markdown),
  ],
  streaming: [
    (markdown) =>
      renderToStaticMarkup(
        <Markdown html={html} streaming>
          {markdown}
        </Markdown>,
      ),
    (markdown) => renderToHtml(markdown, { html, streaming: true }),
  ],
}

const RICH: Pair = [
  (markdown) =>
    renderToStaticMarkup(
      <Markdown html={html} math={math} highlight={highlight} headingIds streaming>
        {markdown}
      </Markdown>,
    ),
  (markdown) =>
    renderToHtml(markdown, { html, math, highlight, headingIds: true, streaming: true }),
]

/** The first place two texts part, with what is around it. */
const parting = (a: string, b: string): string => {
  let at = 0
  while (at < a.length && a[at] === b[at]) at += 1
  return `at ${at}\n  react: ${JSON.stringify(a.slice(Math.max(0, at - 60), at + 80))}\n  own:   ${JSON.stringify(b.slice(Math.max(0, at - 60), at + 80))}`
}

function compare(name: string, markdown: string, [react, own]: Pair, failures: string[]) {
  const texts = [markdown, ...cuts(markdown)]
  for (const text of texts) {
    const expected = comparable(react(text))
    const actual = comparable(own(text))
    if (expected !== actual) {
      if (failures.length < 5)
        failures.push(
          `${name}\n${JSON.stringify(text.slice(0, 200))}\n${parting(expected, actual)}`,
        )
      else failures.push(name)
      return
    }
  }
}

test('named documents: the HTML React writes', () => {
  const failures: string[] = []
  for (const [name, markdown] of Object.entries(namedDocuments())) {
    for (const [way, pair] of Object.entries(WAYS))
      compare(`${name} [${way}]`, markdown, pair, failures)
    compare(`${name} [rich]`, markdown, RICH, failures)
  }
  expect(failures).toEqual([])
})

for (const [family, document] of Object.entries(FAMILIES)) {
  test(`seeded documents: the HTML React writes: ${family}`, () => {
    const failures: string[] = []
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const markdown = document(seed)
      for (const [way, pair] of Object.entries(WAYS))
        compare(`${family} ${seed} [${way}]`, markdown, pair, failures)
    }
    expect(failures.slice(0, 5)).toEqual([])
    expect(failures.length).toBe(0)
  })
}

test('options: the HTML React writes', () => {
  const failures: string[] = []
  const labels = { copy: 'Скопировать', callout: { warning: 'Внимание' } }
  const urlTransform = (url: string) => (url.startsWith('https://') ? `${url}?via=flowdown` : '')
  const ways: Record<string, Pair> = {
    unstyled: [
      (markdown) =>
        renderToStaticMarkup(
          <Markdown html={html} unstyled className="prose">
            {markdown}
          </Markdown>,
        ),
      (markdown) => renderToHtml(markdown, { html, unstyled: true, className: 'prose' }),
    ],
    'class, no caret': [
      (markdown) =>
        renderToStaticMarkup(
          <Markdown html={html} className="prose" streaming caret={false}>
            {markdown}
          </Markdown>,
        ),
      (markdown) =>
        renderToHtml(markdown, { html, className: 'prose', streaming: true, caret: false }),
    ],
    labels: [
      (markdown) =>
        renderToStaticMarkup(
          <Markdown html={html} labels={labels}>
            {markdown}
          </Markdown>,
        ),
      (markdown) => renderToHtml(markdown, { html, labels }),
    ],
    urls: [
      (markdown) =>
        renderToStaticMarkup(
          <Markdown html={html} urlTransform={urlTransform}>
            {markdown}
          </Markdown>,
        ),
      (markdown) => renderToHtml(markdown, { html, urlTransform }),
    ],
  }
  for (const [name, markdown] of Object.entries(namedDocuments()))
    for (const [way, pair] of Object.entries(ways))
      compare(`${name} [${way}]`, markdown, pair, failures)
  expect(failures).toEqual([])
})
