/**
 * Seeded documents built from the lines where one parse reads across blocks: fences, lists, lazy
 * continuations, HTML, formulas, forms. Drawn block by block, each must be what one parse draws.
 */
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { linesDocument } from '../../test/lines'
import { html } from '../html'
import { defaultUrlTransform } from '../engine/url'
import { buildComponents, draw, Markdown } from '../react/markdown'
import { llxDialect } from './remark-answer-blocks'
import { hasHtmlSyntax } from './syntax'

const drawn = buildComponents(undefined)
const sameIds = (markup: string) => markup.replace(/_R_[0-9a-z]+_/g, '_R_')

const whole = (source: string) =>
  sameIds(
    renderToStaticMarkup(
      <div className="llx-markdown">
        {draw(source, 0, null, {
          ...drawn,
          extensions: [llxDialect, ...(hasHtmlSyntax(source) ? [html] : [])],
          urlTransform: defaultUrlTransform,
          ownCode: false,
          ownTable: false,
        })}
      </div>,
    ),
  )
const split = (source: string) =>
  sameIds(renderToStaticMarkup(<Markdown html={html}>{source}</Markdown>))

test('seeded documents', () => {
  // `FUZZ=60000 bun test blocks-fuzz` for a longer sweep.
  const count = Number(process.env.FUZZ ?? 2000)
  const failures: string[] = []
  for (let seed = 1; seed <= count; seed += 1) {
    const doc = linesDocument(seed)
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
})
