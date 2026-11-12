/**
 * The package reads and sanitizes HTML itself, so this is where it is attacked: every payload is
 * drawn (whole, and at every prefix a stream could stop at) and the page is then read back tag by
 * tag. Nothing may come out that runs script, loads a frame, submits a form or styles the page.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { findings, PAYLOADS, WRAPS, type Finding } from '../../test/security'
import { math } from '../math'

/** A page's findings, or nothing. Text that only looks like a tag is escaped by React and is not one. */
const attack = (markdown: string, props: Parameters<typeof render>[1] = {}): Finding[] =>
  findings(render(markdown, props), {
    katex: Boolean(props?.math),
    slugs: Boolean(props?.headingIds),
  })

describe('nothing a reply writes can act on the page', () => {
  test('the checker itself sees what it must', () => {
    expect(findings('<script>x</script>')).toHaveLength(1)
    expect(findings('<img src="x" onerror="alert(1)"/>')).toHaveLength(1)
    expect(findings('<a href="javascript:alert(1)">x</a>')).toHaveLength(1)
    expect(findings('<a href="java&#x9;script:alert(1)">x</a>')).toHaveLength(1)
    expect(findings('<p style="position:fixed">x</p>')).toHaveLength(1)
    expect(findings('<a id="location">x</a>')).toHaveLength(1)
    expect(findings('<div class="admin">x</div>')).toHaveLength(1)
    expect(findings('<source srcSet="javascript:alert(1)"/>')).toHaveLength(1)
    expect(findings('<a href="/a" target="_blank">x</a>')).toHaveLength(1)
    expect(findings('<button onclick="x">x</button>').length).toBeGreaterThan(0)
    expect(findings('<button type="submit" class="fd-tab">x</button>')).toHaveLength(1)
    expect(findings('<a href="/a" target="_blank" rel="nofollow noopener">x</a>')).toHaveLength(0)
    expect(findings('<link rel="stylesheet" href="/x.css"/>')).toHaveLength(1)
    expect(findings('<link rel="preload" as="image" href="javascript:alert(1)"/>')).toHaveLength(1)
    expect(findings('<a href="https://ok.example/a?b#c">x</a><img src="/a.png"/>')).toHaveLength(0)
  })

  for (const [mode, props] of [
    ['with the HTML stage', {}],
    ['with HTML and math', { math }],
    ['with HTML off', { html: false }],
    ['with heading ids', { headingIds: true }],
  ] as const) {
    test(`${mode}: ${PAYLOADS.length} payloads, whole`, () => {
      for (const payload of PAYLOADS) expect(attack(payload, props), payload).toEqual([])
    })
  }

  test('at every prefix a stream could stop at', () => {
    for (const payload of PAYLOADS)
      for (let end = 1; end <= payload.length; end++) {
        const prefix = payload.slice(0, end)
        expect(attack(prefix, { streaming: true, math }), prefix).toEqual([])
      }
  })

  test('inside other content, and one after another', () => {
    for (const payload of PAYLOADS)
      for (const around of WRAPS)
        expect(attack(around(payload), { math }), around(payload)).toEqual([])
    expect(attack(PAYLOADS.join('\n\n'), { math })).toEqual([])
    expect(attack(PAYLOADS.join(' '), { math })).toEqual([])
  })
})

describe('a refused URL', () => {
  test('is dropped, not left as an empty attribute', () => {
    expect(render('[x](javascript:alert(1))')).toContain('<a>x</a>')
    expect(render('[x][r]\n\n[r]: data:text/html,x')).toContain('<a>x</a>')
    expect(render('![x](javascript:alert(1))')).toContain('<img alt="x"/>')
    expect(render('<img src="javascript:alert(1)" alt="y">')).not.toContain('src=')
    expect(render('<a href="vbscript:x">z</a>')).toContain('<a>z</a>')
    const refuseAll = () => null
    expect(render('[x](https://ok.example)', { urlTransform: refuseAll })).toContain('<a>x</a>')
  })

  test('an allowed one, and a link written with no URL, are kept as written', () => {
    expect(render('[x](https://ok.example)')).toContain('<a href="https://ok.example">x</a>')
    expect(render('![x](/a.png)')).toContain('<img src="/a.png" alt="x"/>')
    // CommonMark's `[x]()` is a link to an empty URL.
    expect(render('[x]()')).toContain('<a href="">x</a>')
    expect(render('![x]()')).toContain('<img alt="x"/>')
  })
})
