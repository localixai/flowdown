/**
 * Seeded documents built from the lines where one parse reads across blocks: fences, lists, lazy
 * continuations, HTML, formulas, forms. Drawn block by block, each must be what one parse draws.
 */
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CODE_TAG_LINES, LINKED_LINES, linesDocument, linkedDocument } from '../../test/lines'
import { html } from '../html'
import { defaultUrlTransform } from '../engine/url'
import { buildComponents, draw, Markdown } from '../react/markdown'
import { flowdownDialect } from './remark-answer-blocks'
import { hasHtmlSyntax } from './syntax'

const drawn = buildComponents(undefined)
const sameIds = (markup: string) => markup.replace(/_R_[0-9a-z]+_/g, '_R_')

const whole = (source: string) =>
  sameIds(
    renderToStaticMarkup(
      <div className="flowdown">
        {draw(source, 0, null, {
          ...drawn,
          extensions: [flowdownDialect, ...(hasHtmlSyntax(source) ? [html] : [])],
          urlTransform: defaultUrlTransform,
          ownCode: false,
          ownTable: false,
          ownList: false,
        })}
      </div>,
    ),
  )
const split = (source: string) =>
  sameIds(renderToStaticMarkup(<Markdown html={html}>{source}</Markdown>))

/** A long sweep (`FUZZ=…`) takes longer than a test is given by default. */
const timeout = process.env.FUZZ ? 600_000 : undefined

const sweep = (document: (seed: number) => string) => {
  // `FUZZ=60000 bun test blocks-fuzz` for a longer sweep.
  const count = Number(process.env.FUZZ ?? 2000)
  const failures: string[] = []
  for (let seed = 1; seed <= count; seed += 1) {
    const doc = document(seed)
    const [one, other] = [split(doc), whole(doc)]
    if (one !== other) {
      failures.push(JSON.stringify(doc))
      if (process.env.FUZZ_SHOW) {
        let at = 0
        while (one[at] === other[at]) at++
        console.log(
          JSON.stringify(doc) +
            '\n split: ' +
            JSON.stringify(one.slice(Math.max(0, at - 50), at + 90)) +
            '\n whole: ' +
            JSON.stringify(other.slice(Math.max(0, at - 50), at + 90)),
        )
      }
    }
  }
  expect(failures).toEqual([])
}

test('seeded documents', () => sweep(linesDocument), timeout)

test('seeded documents with link definitions', () => sweep(linkedDocument), timeout)

test(
  'seeded documents with tags that are markup only in code',
  () => sweep((seed) => linesDocument(seed, CODE_TAG_LINES)),
  timeout,
)

test(
  'seeded documents with link definitions and empty items',
  () => sweep((seed) => linkedDocument(seed, [...LINKED_LINES, '-', '1.', '/>'])),
  timeout,
)
