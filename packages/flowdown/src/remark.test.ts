/**
 * `@localix/flowdown/remark` in a real unified pipeline: remark reads the Markdown, the dialect's
 * plugin shapes the forms. Each form must come out with the classes `<Markdown>` draws it with,
 * since one stylesheet styles both.
 */
import { describe, expect, test } from 'bun:test'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { render } from '../test/render'
import { ANSWER_FORM_EXAMPLES, remarkHeadingIds, remarkFlowdown } from './remark'

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFlowdown)
  .use(remarkHeadingIds)
  .use(remarkRehype)
  .use(rehypeStringify)

const viaRemark = (markdown: string) => String(pipeline.processSync(markdown))

/**
 * The class names the dialect's pass gives a page, each once. The ones React components add on
 * top (the code block's bar, the tab strip) are theirs, not the plugin's.
 */
const dialectClasses = (html: string) =>
  [
    ...new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => (m[1] ?? '').split(' '))
        .filter((name) => /^fd-(?!code|table|markdown|copy|tabs?(-|$))/.test(name)),
    ),
  ].toSorted()

describe('the dialect as a remark plugin', () => {
  for (const [form, lines] of Object.entries(ANSWER_FORM_EXAMPLES)) {
    test(`${form}: the same classes as <Markdown> draws`, () => {
      const markdown = lines.join('\n')
      const html = viaRemark(markdown)
      const classes = dialectClasses(render(markdown))
      expect(classes.length).toBeGreaterThan(0)
      for (const name of classes) expect(html, name).toContain(name)
    })
  }

  test('a callout carries its kind and title', () => {
    const html = viaRemark('> [!WARNING] Careful\n> Back up first.')
    expect(html).toContain('data-callout="warning"')
    expect(html).toContain('data-callout-title="Careful"')
  })

  test('tabs are answer-tab elements inside answer-tabs', () => {
    const html = viaRemark('> [!TABS]\n\n#### npm\n\nA\n\n#### bun\n\nB\n\n---')
    expect(html.match(/<answer-tab[ >]/g)).toHaveLength(2)
    expect(html).toContain('<answer-tabs')
  })

  test('headings get the ids extractHeadings returns', () => {
    const html = viaRemark('# Set up\n\n## Set up')
    expect(html).toContain('<h1 id="set-up">')
    expect(html).toContain('<h2 id="set-up-1">')
  })
})
