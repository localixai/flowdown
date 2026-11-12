/**
 * What the package draws, held to the byte: every document of `test/golden.ts`, through every way
 * a page can draw one, against the hashes in `test/golden/baseline.json`.
 *
 * A change that is meant to leave the output alone (a refactor, a faster path) passes as it is. A
 * change that is meant to alter it rewrites the baseline, `GOLDEN_UPDATE=1 bun test golden`, and
 * the diff of that file is in the pull request: which documents changed, and in which way.
 * `GOLDEN_SHOW=1` prints what a failing document draws now.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { renderToAnsi } from './tui'
import { renderToStaticMarkup } from 'react-dom/server'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { canonical, cuts, digest, FAMILIES, namedDocuments, SEEDS } from '../test/golden'
import { flowdownDialect } from './core/remark-answer-blocks'
import { parse } from './engine'
import { highlight } from './highlight'
import { html } from './html'
import { Markdown } from './index'
import { math } from './math'
import { remarkHeadingIds, remarkFlowdown } from './remark'

const sameIds = (markup: string) => markup.replace(/_R_[0-9a-z]+_/g, '_R_')

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFlowdown)
  .use(remarkHeadingIds)
  .use(remarkRehype)
  .use(rehypeStringify)

/** Each way a document is drawn. A way that throws is part of what is held: its message. */
export const WAYS: Record<string, (markdown: string) => string> = {
  tree: (markdown) => canonical(parse(markdown, { extensions: [flowdownDialect] })),
  react: (markdown) =>
    sameIds(
      renderToStaticMarkup(
        <Markdown html={html} headingIds>
          {markdown}
        </Markdown>,
      ),
    ),
  stream: (markdown) =>
    cuts(markdown)
      .map((prefix) =>
        sameIds(
          renderToStaticMarkup(
            <Markdown html={html} streaming>
              {prefix}
            </Markdown>,
          ),
        ),
      )
      .join('\u0000'),
  remark: (markdown) => String(pipeline.processSync(markdown)),
  // The rows of a terminal, styles and all, wide and narrow.
  tui: (markdown) => [80, 24].map((width) => renderToAnsi(markdown, { width })).join('\u0000'),
}

/** With formulas typeset and code highlighted: for the named documents, which have both. */
const RICH: Record<string, (markdown: string) => string> = {
  rich: (markdown) =>
    sameIds(
      renderToStaticMarkup(
        <Markdown html={html} math={math} highlight={highlight} headingIds>
          {markdown}
        </Markdown>,
      ),
    ),
  // A terminal with its code coloured: which kind of token is which colour.
  'tui-rich': (markdown) => renderToAnsi(markdown, { width: 80, highlight }),
}

const drawn = (way: (markdown: string) => string, markdown: string): string => {
  try {
    return way(markdown)
  } catch (error) {
    return `threw: ${(error as Error).message}`
  }
}

interface Baseline {
  named: Record<string, Record<string, string>>
  /** Per family and way: the digests of seeds 1 to n, one after the other. */
  seeded: Record<string, Record<string, string>>
}

const file = join(import.meta.dir, '../test/golden/baseline.json')
const update = Boolean(process.env.GOLDEN_UPDATE)
const baseline: Baseline = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as Baseline)
  : { named: {}, seeded: {} }
const next: Baseline = { named: {}, seeded: {} }

const show = (name: string, way: string, markdown: string, output: string) => {
  if (process.env.GOLDEN_SHOW)
    console.log(`${name} [${way}]\n${JSON.stringify(markdown)}\n${output}\n`)
}

test('named documents draw what they drew', () => {
  const changed: string[] = []
  for (const [name, markdown] of Object.entries(namedDocuments())) {
    next.named[name] = {}
    for (const [way, draw] of Object.entries({ ...WAYS, ...RICH })) {
      const output = drawn(draw, markdown)
      const now = digest(output)
      next.named[name][way] = now
      if (!update && baseline.named[name]?.[way] !== now) {
        changed.push(`${name} [${way}]`)
        show(name, way, markdown, output)
      }
    }
  }
  expect(changed).toEqual([])
})

for (const [family, document] of Object.entries(FAMILIES)) {
  test(`seeded documents draw what they drew: ${family}`, () => {
    const changed: string[] = []
    next.seeded[family] = {}
    const kept = Object.fromEntries(
      Object.keys(WAYS).map((way) => [way, (baseline.seeded[family]?.[way] ?? '').split(' ')]),
    )
    const digests: Record<string, string[]> = Object.fromEntries(
      Object.keys(WAYS).map((way) => [way, []]),
    )
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const markdown = document(seed)
      for (const [way, draw] of Object.entries(WAYS)) {
        const output = drawn(draw, markdown)
        const now = digest(output)
        digests[way]!.push(now)
        if (!update && kept[way]![seed - 1] !== now) {
          changed.push(`${family} ${seed} [${way}]`)
          show(`${family} ${seed}`, way, markdown, output)
        }
      }
    }
    for (const way of Object.keys(WAYS)) next.seeded[family][way] = digests[way]!.join(' ')
    expect(changed.slice(0, 40)).toEqual([])
  })
}

test('the baseline is written', () => {
  if (update) writeFileSync(file, `${JSON.stringify(next, null, 1)}\n`)
  expect(existsSync(file)).toBe(true)
})
