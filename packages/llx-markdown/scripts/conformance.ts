/**
 * Writes docs/conformance.md: what of Markdown the package reads, counted and checked by running
 * it. Three parts: the specifications (every example of CommonMark, GitHub's extensions), the
 * syntax GitHub's own writing guide lists, and the package's dialect. Nothing in the page is typed
 * by hand: `bun run conformance` writes it, and a test fails when the page is out of date.
 */
import { ANSWER_FORM_EXAMPLES } from '../src/dialect'
import { math } from '../src/math'
import { render } from '../test/render'
import { cmarkGfm, commonmark, gfm, run, type Example } from '../test/spec/load'

interface Check {
  name: string
  markdown: string
  /** What the drawn page must hold for the syntax to count as supported. */
  expect: RegExp
  note?: string
}

const draw = (markdown: string): string => render(markdown, { math, headingIds: true })

/** The syntax of GitHub's "Basic writing and formatting syntax", in the article's order. */
const GITHUB: Check[] = [
  {
    name: 'Headings',
    markdown: '# A\n\n###### F',
    expect: /<h1[^>]*>A<\/h1>[\s\S]*<h6[^>]*>F<\/h6>/,
  },
  {
    name: 'Bold',
    markdown: '**bold** __bold__',
    expect: /<strong>bold<\/strong> <strong>bold<\/strong>/,
  },
  { name: 'Italic', markdown: '*it* _it_', expect: /<em>it<\/em> <em>it<\/em>/ },
  {
    name: 'Strikethrough',
    markdown: '~~gone~~ ~gone~',
    expect: /<del>gone<\/del> <del>gone<\/del>/,
  },
  {
    name: 'Bold with nested italic',
    markdown: '**very _nested_ text**',
    expect: /<strong>very <em>nested<\/em> text<\/strong>/,
  },
  { name: 'All bold and italic', markdown: '***all***', expect: /<em><strong>all<\/strong><\/em>/ },
  {
    name: 'Subscript, superscript, underline',
    markdown: 'H<sub>2</sub>O x<sup>2</sup> <ins>u</ins>',
    expect: /<sub>2<\/sub>O x<sup>2<\/sup> <ins>u<\/ins>/,
    note: 'raw HTML, sanitized',
  },
  { name: 'Quoting text', markdown: '> quoted', expect: /<blockquote>\s*<p>quoted<\/p>/ },
  {
    name: 'Quoting code',
    markdown: 'Use `git status`.\n\n```\ngit status\n```',
    expect: /<code>git status<\/code>[\s\S]*<pre>/,
  },
  {
    name: 'Supported color models (a swatch beside `#0969DA`)',
    markdown: '`#0969DA`',
    expect: /swatch|color-chip/,
  },
  {
    name: 'Links',
    markdown: '[Pages](https://pages.github.com/ "Title")',
    expect: /<a href="https:\/\/pages\.github\.com\/"[^>]*title="Title"/,
  },
  {
    name: 'Bare URLs become links',
    markdown: 'See https://github.com and www.github.com.',
    expect: /<a href="https:\/\/github\.com"[\s\S]*<a href="http:\/\/www\.github\.com"/,
  },
  {
    name: 'Section links (heading ids)',
    markdown: '## Sample Section\n\n[go](#sample-section)',
    expect: /<h2 id="sample-section"[\s\S]*href="#sample-section"/,
    note: 'with `headingIds`',
  },
  {
    name: 'Custom anchors',
    markdown: '<a name="my-anchor"></a>',
    expect: /<a name="user-content-my-anchor">/,
    note: 'names are prefixed, as on GitHub',
  },
  {
    name: 'Line breaks: two spaces, backslash, `<br/>`',
    markdown: 'a  \nb\\\nc<br/>d',
    expect: /a<br\/>\s*b<br\/>\s*c<br\/>d/,
  },
  {
    name: 'Images',
    markdown: '![Alt text](https://example.com/a.png)',
    expect: /<img src="https:\/\/example\.com\/a\.png" alt="Alt text"/,
  },
  {
    name: 'The `<picture>` element',
    markdown:
      '<picture><source media="(prefers-color-scheme: dark)" srcset="d.png"><img src="l.png"></picture>',
    expect: /<picture><source[^>]*srcSet="d\.png"[^>]*\/><img src="l\.png"/,
  },
  { name: 'Lists', markdown: '- a\n* b\n\n1. one\n2. two', expect: /<ul>[\s\S]*<ol>/ },
  {
    name: 'Nested lists',
    markdown: '1. First\n   - Nested\n     - Deeper',
    expect: /<ol>\s*<li>First\s*<ul>\s*<li>Nested\s*<ul>/,
  },
  {
    name: 'Task lists',
    markdown: '- [x] done\n- [ ] open',
    expect: /<input[^>]*checked=""[\s\S]*<input (?![^>]*checked)/,
  },
  {
    name: 'Mentioning people and teams (`@octocat`)',
    markdown: '@octocat',
    expect: /<a[^>]*>@octocat<\/a>/,
  },
  {
    name: 'Referencing issues and pull requests (`#12`)',
    markdown: 'See #12.',
    expect: /<a[^>]*>#12<\/a>/,
  },
  { name: 'Emoji shortcodes (`:+1:`)', markdown: ':+1:', expect: /👍/ },
  { name: 'Paragraphs', markdown: 'one\n\ntwo', expect: /<p>one<\/p>\s*<p>two<\/p>/ },
  {
    name: 'Footnotes',
    markdown: 'Text.[^1]\n\n[^1]: The note.',
    expect: /<sup>[\s\S]*data-footnotes[\s\S]*The note\./,
  },
  {
    name: 'Alerts: note, tip, important, warning, caution',
    markdown: ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
      .map((kind) => `> [!${kind}]\n> Text.`)
      .join('\n\n'),
    expect:
      /data-callout="note"[\s\S]*data-callout="tip"[\s\S]*data-callout="important"[\s\S]*data-callout="warning"[\s\S]*data-callout="caution"/,
  },
  {
    name: 'Hiding content with comments',
    markdown: 'a <!-- hidden --> b',
    expect: /<p>a {2}b<\/p>/,
  },
  {
    name: 'Ignoring Markdown formatting (`\\*`)',
    markdown: '\\*not italic\\*',
    expect: /<p>\*not italic\*<\/p>/,
  },
]

/** GitHub's advanced formatting, each from its own page of the guide. */
const GITHUB_ADVANCED: Check[] = [
  {
    name: 'Tables, with column alignment',
    markdown: '| a | b |\n|:--|--:|\n| 1 | 2 |',
    expect: /<table[\s\S]*text-align:left[\s\S]*text-align:right/,
  },
  {
    name: 'Collapsed sections (`<details>`)',
    markdown: '<details>\n<summary>More</summary>\n\nHidden.\n\n</details>',
    expect: /<details>\s*<summary>More<\/summary>[\s\S]*Hidden\./,
    note: 'raw HTML, sanitized',
  },
  {
    name: 'Fenced code blocks with a language',
    markdown: '```ts\nlet a = 1\n```',
    expect: /<code class="language-ts"/,
  },
  {
    name: 'Diagrams (` ```mermaid `)',
    markdown: '```mermaid\ngraph TD\nA-->B\n```',
    expect: /class="llx-diagram"/,
    note: 'drawn when `mermaid` is given',
  },
  {
    name: 'Mathematical expressions: `$…$`, `$$…$$`, ` ```math `',
    markdown: '$x^2$\n\n$$\ny\n$$\n\n```math\nz\n```',
    expect: /(class="katex"[\s\S]*){3}/,
    note: 'with `llx-markdown/math`',
  },
  {
    name: '`<kbd>` keys',
    markdown: '<kbd>Ctrl</kbd>',
    expect: /<kbd>Ctrl<\/kbd>/,
    note: 'raw HTML, sanitized',
  },
]

/** The package's own forms: what it draws beyond Markdown, each with the markup that proves it. */
const DIALECT: Check[] = [
  {
    name: 'Callout with a title',
    markdown: '> [!WARNING] Careful\n> Back up first.',
    expect: /class="llx-callout" data-callout="warning"[^>]*aria-label="Careful"/,
  },
  {
    name: 'Steps',
    markdown: ANSWER_FORM_EXAMPLES.steps.join('\n'),
    expect: /class="llx-steps"[\s\S]*class="llx-step-title"/,
  },
  {
    name: 'Tabs',
    markdown: ANSWER_FORM_EXAMPLES.comparison.join('\n'),
    expect: /class="llx-tabs"[\s\S]*class="llx-tab-panel"/,
  },
  {
    name: 'Pros and cons',
    markdown: ANSWER_FORM_EXAMPLES.verdict.join('\n'),
    expect: /data-verdict="pros"[\s\S]*data-verdict="cons"/,
  },
  {
    name: 'Stats',
    markdown: ANSWER_FORM_EXAMPLES.stats.join('\n'),
    expect: /class="llx-stat-value"[\s\S]*class="llx-stat-label"/,
  },
  {
    name: 'Details (a folded section)',
    markdown: ANSWER_FORM_EXAMPLES.details.join('\n'),
    expect: /<details[^>]*class="llx-details"/,
  },
  {
    name: 'Sources',
    markdown: ANSWER_FORM_EXAMPLES.sources.join('\n'),
    expect: /class="llx-sources"[\s\S]*class="llx-source-host"/,
  },
  {
    name: 'Quote with its source',
    markdown: '> Simplicity is prerequisite for reliability.\n> — Edsger Dijkstra',
    expect: /<blockquote>[\s\S]*<(footer|cite)[\s\S]*Edsger Dijkstra/,
  },
  {
    name: 'Figure with a caption',
    markdown: '![Chart](a.png "Requests per second")',
    expect: /<figure class="llx-figure">[\s\S]*<figcaption>Requests per second/,
  },
  {
    name: 'File tree',
    markdown: '```tree\nsrc/\n└── app.ts\n```',
    expect: /role="tree"[\s\S]*class="llx-tree-row"/,
  },
  {
    name: 'Code block with a file name',
    markdown: '```ts title="src/app.ts"\nlet a\n```',
    expect: /class="llx-code-title">src\/app\.ts</,
  },
  {
    name: 'Diff',
    markdown: '```diff\n-a\n+b\n```',
    expect: /data-language="diff"/,
    note: 'colored with `llx-markdown/highlight`',
  },
  {
    name: 'Numbered sections',
    markdown: '## 1.2 Water',
    expect: /class="llx-section-number">1\.2</,
  },
  {
    name: 'Diagram',
    markdown: '```mermaid\ngraph TD\nA-->B\n```',
    expect: /class="llx-diagram"/,
    note: 'drawn when `mermaid` is given',
  },
  {
    name: 'Math',
    markdown: 'Inline $x^2$.',
    expect: /class="katex"/,
    note: 'with `llx-markdown/math`',
  },
]

const cell = (text: string): string => text.replace(/\|/g, '\\|')
const mark = (pass: boolean): string => (pass ? '✓' : '—')

/** Pass counts by section, in the order the specification has them. */
const bySection = (examples: Example[], key: (example: Example) => string) => {
  const rows = new Map<string, { pass: number; total: number }>()
  for (const example of examples) {
    const row = rows.get(key(example)) ?? { pass: 0, total: 0 }
    row.total++
    if (run(example).pass) row.pass++
    rows.set(key(example), row)
  }
  return rows
}

const total = (rows: Map<string, { pass: number; total: number }>) => {
  let pass = 0
  let all = 0
  for (const row of rows.values()) {
    pass += row.pass
    all += row.total
  }
  return { pass, all }
}

const specTable = (head: string, rows: Map<string, { pass: number; total: number }>): string[] => {
  const sum = total(rows)
  return [
    `| ${head} | Examples | Pass |`,
    '| --- | ---: | ---: |',
    ...[...rows].map(([name, row]) => `| ${cell(name)} | ${row.total} | ${row.pass} |`),
    `| **All** | **${sum.all}** | **${sum.pass}** |`,
  ]
}

const checkTable = (checks: Check[]): string[] => [
  '| Syntax | Supported | Note |',
  '| --- | :-: | --- |',
  ...checks.map(
    (check) =>
      `| ${cell(check.name)} | ${mark(check.expect.test(draw(check.markdown)))} | ${cell(check.note ?? '')} |`,
  ),
]

const EXTENSION_NAMES: Record<string, string> = {
  table: 'Tables',
  strikethrough: 'Strikethrough',
  autolink: 'Autolinks',
  tagfilter: 'Disallowed raw HTML',
}

/** The page, as text. */
export const conformance = (): string => {
  const core = bySection(commonmark(), (example) => example.section)
  const extensions = bySection(
    gfm(),
    (example) => EXTENSION_NAMES[example.extension] ?? example.extension,
  )
  const cmark = bySection(cmarkGfm(), (example) => example.section)
  const coreSum = total(core)
  const extensionSum = total(extensions)
  const cmarkSum = total(cmark)
  return [
    '# Conformance',
    '',
    '<!-- Generated by packages/llx-markdown/scripts/conformance.ts (`bun run conformance`). Do not edit: a test fails when this page is out of date. -->',
    '',
    'llx-markdown reads Markdown with its own parser. This page is what that parser is held to: every example of the specifications is run, and every piece of syntax below is drawn and looked for in the page. The page is written by a script, and the test suite fails when it no longer matches the code.',
    '',
    '| Suite | Examples | Pass |',
    '| --- | ---: | ---: |',
    `| [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) | ${coreSum.all} | ${coreSum.pass} |`,
    `| [GitHub Flavored Markdown](https://github.github.com/gfm/), the extensions | ${extensionSum.all} | ${extensionSum.pass} |`,
    `| [cmark-gfm](https://github.com/github/cmark-gfm)'s extension tests | ${cmarkSum.all} | ${cmarkSum.pass} |`,
    '',
    '## CommonMark',
    '',
    'Every example of the specification, by section. The expected HTML is compared character for character.',
    '',
    ...specTable('Section', core),
    '',
    '## GitHub Flavored Markdown',
    '',
    "The examples of GitHub's specification that are about one of its extensions. (The rest of that document restates an older CommonMark, covered above at 0.31.2.) Task lists and footnotes have no examples there; cmark-gfm's own tests below cover them.",
    '',
    ...specTable('Extension', extensions),
    '',
    "cmark-gfm is GitHub's parser; these are the tests it keeps for its extensions.",
    '',
    ...specTable('Section', cmark),
    '',
    '## GitHub’s writing syntax',
    '',
    'What [Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) lists, in its order. A dash is syntax that belongs to github.com (its users, issues and emoji), which a reply has no use for: it shows as written.',
    '',
    ...checkTable(GITHUB),
    '',
    'From the advanced pages of the same guide:',
    '',
    ...checkTable(GITHUB_ADVANCED),
    '',
    '## The dialect',
    '',
    'What llx-markdown draws beyond Markdown; [Syntax](syntax.md) describes each form. Every form is plain Markdown to any other renderer.',
    '',
    ...checkTable(DIALECT),
    '',
  ].join('\n')
}

if (import.meta.main) {
  const page = conformance()
  await Bun.write(new URL('../../../docs/conformance.md', import.meta.url), page)
  console.log(
    page
      .split('\n')
      .filter((line) => /^\| (\[|\*\*All)/.test(line))
      .join('\n'),
  )
  const missing = page.split('\n').filter((line) => / \| — \| /.test(line))
  console.log(`${missing.length} not supported:\n${missing.join('\n')}`)
}
