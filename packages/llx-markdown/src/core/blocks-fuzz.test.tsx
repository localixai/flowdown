/**
 * Seeded documents built from the lines where one parse reads across blocks: fences, lists, lazy
 * continuations, HTML, formulas, forms. Drawn block by block, each must be what one parse draws.
 */
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { seeded } from '../../test/random'
import { html } from '../html'
import { defaultUrlTransform } from '../engine/url'
import { buildComponents, draw, Markdown } from '../react/markdown'
import { llxDialect } from './remark-answer-blocks'
import { hasHtmlSyntax } from './syntax'

const LINES = [
  '',
  '',
  '',
  'Text.',
  'More text here.',
  '# Title',
  '#### Tab',
  '## Next',
  '---',
  '***',
  'Setext',
  '===',
  '- item',
  '- ',
  '* star',
  '1. one',
  '2. two',
  '7) seven',
  '   continued',
  '  two spaces',
  '    four spaces',
  '\tTabbed',
  '-\ttab item',
  '      deep',
  '> quote',
  '> [!STEPS]',
  '> [!TABS]',
  '> [!PROS]',
  '> [!CONS]',
  '> [!STATS]',
  '> [!SOURCES]',
  '> [!DETAILS] Folded',
  '> [!DETAILS]',
  '- [A link](https://example.com/a) — note',
  '```ts title="a.ts"',
  '> [!WARNING] Careful',
  '> - quoted item',
  '```',
  '```js',
  '~~~',
  '````',
  '   ```',
  '    ```',
  'code `inline` here',
  '```a``` inline',
  '$$',
  '$$ x $$',
  'a $$ b',
  '<div>',
  '</div>',
  '<div>text</div>',
  '<pre>',
  '</pre>',
  '<!-- note',
  '-->',
  '<br>',
  '<span>inline</span> text',
  '<details>',
  '</details>',
  '<summary>S</summary>',
  '![alt](a.png)',
  '*caption*',
  '_also_',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  '**bold** and *em*',
  '[link](https://a.b)',
  '- [ ] task',
  '- **3×** faster',
  '1. **Step**',
  '   *Day 1*',
]

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
    const r = seeded(seed)
    const lines: string[] = []
    for (let n = r.int(2, 14); n > 0; n -= 1) lines.push(LINES[r.int(0, LINES.length - 1)]!)
    const doc = lines.join('\n')
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
