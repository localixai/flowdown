import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { commonmark, gfm } from '../../test/spec/load'
import { defaultUrlTransform } from '../engine/url'
import { html } from '../html'
import { math } from '../math'
import { buildComponents, draw, Markdown } from '../react/markdown'
import { escapeLiteralDollars } from './dollars'
import { closePartialMarkdown } from './heal'
import { headingIdsByOffset } from './headings'
import { flowdownDialect } from './remark-answer-blocks'
import { hasHtmlSyntax } from './syntax'

const drawn = buildComponents(undefined)

/**
 * Every example of CommonMark's and GitHub's specifications, fed a character at a time: each frame,
 * streaming and finished, drawn block by block must be what one parse of that frame draws. The
 * spec suite (`engine/spec.test.ts`) holds the finished text to the specifications; this holds
 * every frame of a stream to the finished text's reading, the setext heading an underline makes of
 * the line above, the list a blank line makes loose, the definition that arrives last.
 */
/** `useId` values depend on where a component sits in the React tree, which blocks change. */
const sameIds = (markup: string) => markup.replace(/_R_[0-9a-z]+_/g, '_R_')

/** The document as ONE parse draws it: the reference a block-by-block render must match. */
function whole(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  const healed = streaming ? closePartialMarkdown(markdown) : markdown
  const source = withMath ? escapeLiteralDollars(healed) : healed
  return sameIds(
    renderToStaticMarkup(
      <div
        className="flowdown"
        data-streaming={streaming || undefined}
        data-caret={streaming || undefined}
      >
        {draw(source, 0, headingIds ? headingIdsByOffset(source) : null, {
          ...drawn,
          extensions: [
            flowdownDialect,
            ...(withMath ? [math] : []),
            ...(hasHtmlSyntax(source) ? [html] : []),
          ],
          urlTransform: defaultUrlTransform,
          ownCode: false,
          ownTable: false,
          ownList: false,
        })}
      </div>,
    ),
  )
}

function split(markdown: string, { streaming = false, withMath = false, headingIds = false } = {}) {
  return sameIds(
    renderToStaticMarkup(
      <Markdown
        streaming={streaming}
        math={withMath ? math : null}
        html={html}
        headingIds={headingIds}
      >
        {markdown}
      </Markdown>,
    ),
  )
}

const frames = (markdown: string): string[] => {
  const out: string[] = []
  for (let end = 1; end <= markdown.length; end++) out.push(markdown.slice(0, end))
  return out
}

describe('every spec example, a character at a time, draws what one parse of each frame draws', () => {
  for (const [suite, examples] of [
    ['CommonMark', commonmark()],
    ['GitHub', gfm()],
  ] as const) {
    test(suite, () => {
      const differ: string[] = []
      for (const example of examples) {
        for (const frame of frames(example.markdown)) {
          for (const streaming of [true, false]) {
            if (split(frame, { streaming }) !== whole(frame, { streaming })) {
              differ.push(
                `example ${example.number} (${example.section}), ${streaming ? 'streaming' : 'finished'}, at ${frame.length}`,
              )
            }
          }
        }
      }
      expect(differ).toEqual([])
    })
  }
})
