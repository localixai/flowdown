/**
 * The documents every renderer is held to, and the ways one is drawn.
 *
 * `golden.test.tsx` draws each document through each way and compares a hash of the result with
 * `test/golden/baseline.json`: what the package drew before a change is what it draws after it,
 * to the byte. The same documents are what a renderer for another target is compared on, against
 * the React one.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORPUS } from './corpus'
import { linesDocument, LINES } from './lines'
import { hash, seeded } from './random'
import { scenarios } from './replies'

/** Lines dense in the dialect: every form, its edge cases, and what forms nest in. */
export const DIALECT_LINES = [
  '',
  '',
  'Text.',
  '> [!NOTE]',
  '> [!TIP] Faster builds',
  '> [!WARNING] **Bold** title',
  '> [!CAUTION]',
  '> [!IMPORTANT] Read this',
  '> [!FOO] not a kind',
  '> quoted text',
  '> — Edsger Dijkstra',
  '> -- Someone',
  '> — ![portrait](https://example.com/p.png)',
  '> > [!NOTE]',
  '> > nested quote',
  '> [!STEPS]',
  '> [!STEPS] The plan',
  '> [!TABS]',
  '> [!TABS] Install',
  '> [!STATS]',
  '> [!STATS] Numbers',
  '> [!PROS]',
  '> [!PROS] For',
  '> [!CONS]',
  '> [!CONS] Against',
  '> [!DETAILS]',
  '> [!DETAILS] Full log',
  '> [!DETAILS] **Formatted** title',
  '> [!SOURCES]',
  '> [!SOURCES] References',
  '> 1. **Quoted step**',
  '>    *When*',
  '> - **9×** quoted stat',
  '> - quoted point',
  '> #### Quoted tab',
  '1. **Back up**',
  '   *Day 1*',
  '   Dump the database.',
  '2. **Switch** — point the app',
  '3. plain step',
  '- **3×** faster',
  '- **−40%** *p99* memory',
  '- plain point',
  '- [Page title](https://www.example.com/page) — a note',
  '- [Relative](/docs/page)',
  '- https://example.com/bare',
  '- [**Bold** title](https://docs.example.com:8080/a?b#c)',
  '#### macOS',
  '#### Linux',
  '#### **Bold** tab',
  '### Shallower',
  '## 1.2 Numbered title',
  '## 3. Dotted',
  '## 42',
  '# Title',
  '---',
  '![Queue](https://example.com/q.png)',
  '![Titled](https://example.com/t.png "The caption")',
  '*The caption line*',
  '![a](b.png) *same line*',
  '```ts title="src/app.ts"',
  '```sh src/run.sh',
  '```tree',
  '```mermaid',
  '```',
  'const x = 1',
  'src/',
  '└── db.ts  # the client',
  'graph TD; A-->B',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  '- [ ] task',
  '- [x] done',
  'Claim.[^1]',
  '[^1]: The source.',
  '<details>',
  '</details>',
  '<div>',
  '</div>',
]

/** Forms as people and models actually nest them: written by hand, one case each. */
const NESTED: Record<string, string> = {
  'callout in a tab':
    '> [!TABS]\n#### A\n> [!WARNING] Careful\n> Body.\n\n#### B\nText.\n\n---\n\nAfter.',
  'tabs quoted whole': '> [!TABS]\n> #### npm\n> `npm i`\n>\n> #### bun\n> `bun add`',
  'steps quoted whole':
    '> [!STEPS] Recovery\n> 1. **First**\n>    *Day 1*\n>    Rest.\n> 2. **Second** — then move.\n> 3. no title',
  'figure in a callout': '> [!NOTE]\n> ![Q](https://example.com/q.png)\n>\n> *Caption*',
  'attribution after a break': '> Line one.  \n> — Author, *Book*',
  'attribution alone': '> — Nobody',
  'attribution with a link': '> Quote.\n>\n> — [Author](https://example.com)',
  'callout with only a title': '> [!TIP] Just this',
  'callout with a formatted title': '> [!TIP] **Bold** and more\n> Body.',
  'pros then cons then pros': '> [!PROS] A\n- a\n\n> [!CONS] B\n- b\n\n> [!PROS] C\n- c',
  'cons then pros': '> [!CONS]\n- b\n\n> [!PROS]\n- a',
  'pros without a list': '> [!PROS]\n\nJust prose.',
  'stats with emphasis': '> [!STATS] Q3\n- **12%** *growth* year over year\n- **$4M**\n- no value',
  'sources of every kind':
    '> [!SOURCES]\n- [Title](https://www.example.com/a) — note\n- https://example.com/bare\n- [Rel](/x)\n- not a link\n- [**B**](https://a.b/c)',
  'details with prose': '> [!DETAILS] Log\n> line one\n> line two\n>\n> - item',
  'details without a title': '> [!DETAILS]\n> Hidden.',
  'details with a formatted title': '> [!DETAILS] **Bold** title\n> Hidden.',
  'details, prose on the marker paragraph': '> [!DETAILS] Title\n> prose right under',
  'tabs with a title':
    '> [!TABS] Install\n#### macOS\nbrew\n\n#### Linux\napt\n\n### Next\n\nAfter.',
  'tabs holding forms':
    '> [!TABS]\n#### One\n> [!STEPS]\n1. **a**\n2. **b**\n\n#### Two\n> [!STATS]\n- **1** x\n\n---',
  'numbered headings': '# 1 Intro\n\n## 1.1 Scope\n\n### 1.1.1. Deep\n\n## 2\n\n## 2024 was a year',
  'fence titles':
    '```ts title="src/a.ts"\nconst a = 1\n```\n\n```py file=b.py\nb = 2\n```\n\n```sh run.sh\nls\n```\n\n```js {1,3}\nx\n```',
  'tree and diagram':
    '```tree\nsrc/\n├── a.ts\n└── lib/\n    └── b.ts  # note\n```\n\n```mermaid\ngraph TD\n  A --> B\n```',
  'figure with a title': '![Alt](https://example.com/a.png "Caption **raw**")\n\nAfter.',
  'figure caption under': '![Alt](https://example.com/a.png)\n*Caption* \n\nAfter.',
  'image in prose': 'An ![inline](https://example.com/i.png) image.',
  'form in a list item':
    '- item\n\n  > [!WARNING]\n  > inside a list\n\n- > [!STEPS]\n  > 1. **a**',
  'form in a quote': '> > [!STATS]\n> > - **1** a\n>\n> after',
  'a marker that governs nothing': '> [!STEPS]\n\nJust a paragraph.',
  'two forms in a row': '> [!STATS]\n- **1** a\n\n> [!STEPS]\n1. **b**',
  'task list and footnotes': '- [ ] a\n- [x] b\n\nText.[^n] Again.[^n]\n\n[^n]: Note with `code`.',
  'raw html around forms': '<div align="center">\n\n> [!TIP]\n> Inside.\n\n</div>\n\n<kbd>K</kbd>',
}

const demo = (): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const folder of ['scenes', 'review']) {
    const dir = join(import.meta.dir, '../../../demo', folder)
    for (const file of readdirSync(dir).toSorted())
      if (file.endsWith('.md'))
        out[`demo/${folder}/${file}`] = readFileSync(join(dir, file), 'utf8')
  }
  return out
}

/** Every named document: the corpus, the nested forms, the demo's pages, the seeded replies. */
export function namedDocuments(): Record<string, string> {
  const replies: Record<string, string> = {}
  for (const { name, text } of scenarios()) {
    // The long ones measure speed, not shape: their first part has every construct they hold.
    if (name === 'thread-30') continue
    replies[`reply: ${name}`] = text.length > 24_000 ? text.slice(0, 24_000) : text
  }
  return {
    ...CORPUS,
    ...Object.fromEntries(Object.entries(NESTED).map(([name, text]) => [`nested: ${name}`, text])),
    ...demo(),
    ...replies,
  }
}

/** How many seeded documents each family has; `GOLDEN_SEEDS` makes a run shorter or longer. */
export const SEEDS = Number(process.env.GOLDEN_SEEDS ?? 1200)

export const FAMILIES: Record<string, (seed: number) => string> = {
  lines: (seed) => linesDocument(seed, LINES),
  dialect: (seed) => linesDocument(seed, DIALECT_LINES),
}

/** A few places a document is cut at, as a stream would have it: seeded by the text itself. */
export function cuts(text: string, count = 3): string[] {
  if (text.length < 2) return [text]
  const r = seeded(Number.parseInt(hash(text), 16))
  return Array.from({ length: count }, () => text.slice(0, r.int(1, text.length - 1)))
}

/** JSON with every object's keys in order, so two trees built differently compare as equal. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const fields: string[] = []
    for (const key of Object.keys(value).toSorted()) {
      const field = (value as Record<string, unknown>)[key]
      if (field !== undefined) fields.push(`${JSON.stringify(key)}:${canonical(field)}`)
    }
    return `{${fields.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** A text's hash and length: what the baseline keeps of it. */
export const digest = (text: string): string => `${hash(text)}${text.length.toString(36)}`
