/**
 * `flowdown/tui` held to what a terminal needs of it:
 *
 * 1. The layouts, row for row: the ones the Rust renderer of the `llx` terminal draws.
 * 2. No row is wider than the width, whatever the text and however deep it nests.
 * 3. Nothing a text holds reaches the terminal as an instruction: the only escape sequences in
 *    the output are the renderer's own.
 * 4. No text is lost: what the tree holds to read is on the screen.
 * 5. A reply drawn token by token is, at every step, what a fresh render of that text draws, and
 *    the rows of a block that did not change are the same objects.
 */
import { describe, expect, test } from 'bun:test'
import { prefixes, type Pattern } from '../../test/chunks'
import { FAMILIES, namedDocuments } from '../../test/golden'
import { PAYLOADS, WRAPS } from '../../test/security'
import { formOf } from '../core/forms'
import { mathSyntax } from '../core/math-syntax'
import { flowdownDialect } from '../core/remark-answer-blocks'
import { createDocument } from '../document'
import { parse } from '../engine'
import type { Node } from '../engine/types'
import { mathText } from './math'
import {
  createTerminalView,
  lineText,
  lineWidth,
  printable,
  renderToAnsi,
  renderToLines,
  textWidth,
  toAnsi,
  type Line,
} from './index'

/** Seeded documents per family here; `TUI_SEEDS` makes a run shorter or longer. */
const SEEDS = Number(process.env.TUI_SEEDS ?? 300)

const shown = (markdown: string, width: number): string =>
  renderToAnsi(markdown, { width, color: false })

const rows = (...lines: string[]): string => lines.join('\n')

const ESC = String.fromCharCode(0x1b)

/** Every document of the corpus: named, seeded, and each attack on a page. */
function* corpus(): Generator<[string, string]> {
  yield* Object.entries(namedDocuments())
  for (const [family, document] of Object.entries(FAMILIES))
    for (let seed = 1; seed <= SEEDS; seed++) yield [`${family} ${seed}`, document(seed)]
  for (const [at, payload] of PAYLOADS.entries())
    for (const [way, wrapped] of WRAPS.entries()) yield [`payload ${at}/${way}`, wrapped(payload)]
}

describe('layouts', () => {
  test('blocks, lists, quotes and code', () => {
    const text =
      '# Done\n\nThe landing is in `site/index.html` and works on **phones** too.\n\n' +
      '- one change in the header, which is long enough to wrap onto a second row\n' +
      '- two\n  1. nested\n  2. again\n\n' +
      '> a quote that also wraps when the width is small\n\n' +
      '```rust\nfn main() {\n    println!("hi");\n}\n```\n\n' +
      'See [the docs](https://llx.sh/docs) or https://llx.sh.\n\n---\n\nEnd.'
    expect(shown(text, 40)).toBe(
      rows(
        'Done',
        '',
        'The landing is in site/index.html and',
        'works on phones too.',
        '',
        '• one change in the header, which is',
        '  long enough to wrap onto a second row',
        '• two',
        '  1. nested',
        '  2. again',
        '',
        '│ a quote that also wraps when the width',
        '│ is small',
        '',
        'fn main() {',
        '    println!("hi");',
        '}',
        '',
        'See the docs (https://llx.sh/docs) or',
        'https://llx.sh.',
        '',
        '────────────────────────────────────────',
        '',
        'End.',
      ),
    )
  })

  test('table alignment and empty cells do not shift columns', () => {
    const text = '| Left | Right | Center |\n|:---|---:|:---:|\n| x | y | z |\n| | tail | |'
    expect(shown(text, 60)).toBe(
      rows(
        '│ Left │ Right │ Center │',
        '├──────┼───────┼────────┤',
        '│ x    │     y │   z    │',
        '│      │  tail │        │',
      ),
    )
  })

  test('a table whose rows wrap rules them apart', () => {
    const text =
      '| Name | What it does |\n|---|---|\n| merge | joins two histories with a commit of its own |\n| rebase | rewrites commits onto another base |\n'
    expect(shown(text, 36)).toBe(
      rows(
        '│ Name   │ What it does            │',
        '├────────┼─────────────────────────┤',
        '│ merge  │ joins two histories     │',
        '│        │ with a commit of its    │',
        '│        │ own                     │',
        '├────────┼─────────────────────────┤',
        '│ rebase │ rewrites commits onto   │',
        '│        │ another base            │',
      ),
    )
    // Rows of one line each need no rule between them.
    expect(shown(text, 80)).toBe(
      rows(
        '│ Name   │ What it does                                 │',
        '├────────┼──────────────────────────────────────────────┤',
        '│ merge  │ joins two histories with a commit of its own │',
        '│ rebase │ rewrites commits onto another base           │',
      ),
    )
  })

  test('a table gives its columns room by what they hold', () => {
    const text =
      '| Risk | What happens |\n|---|---|\n| A migration that cannot be undone | The old version breaks on the column that is gone while both still run, and rolling the code back does not bring it back. |\n'
    expect(shown(text, 50)).toBe(
      rows(
        '│ Risk           │ What happens                  │',
        '├────────────────┼───────────────────────────────┤',
        '│ A migration    │ The old version breaks on the │',
        '│ that cannot be │ column that is gone while     │',
        '│ undone         │ both still run, and rolling   │',
        '│                │ the code back does not bring  │',
        '│                │ it back.                      │',
      ),
    )
  })

  test('a table keeps its cells in a narrow terminal and inside a quote', () => {
    const text =
      '> | Name | Description |\n> |:---|---:|\n> | 中文 | long words with **style** and [link](https://example.com) |\n> | empty | |'
    for (const width of [8, 20, 40, 80]) {
      const drawn = renderToLines(text, { width })
      const screen = drawn.map(lineText).join('\n')
      expect(screen).toContain('中文')
      expect(screen).toContain('empty')
      expect(screen).not.toContain('|:---|')
      for (const row of drawn) {
        expect(lineWidth(row)).toBeLessThanOrEqual(width)
        if (row.length > 0) expect(lineText(row).startsWith('│')).toBe(true)
      }
    }
  })

  test('a link broken across rows keeps its address', () => {
    expect(shown('a **b** c `d` e [x  \ny](http://u.v)', 40)).toBe(
      rows('a b c d e x', 'y (http://u.v)'),
    )
  })

  test('an HTML block reads as its rows', () => {
    expect(shown('Before.\n\n<details>\n<summary>x</summary>\n</details>\n\nAfter.', 40)).toBe(
      rows('Before.', '', '<details>', '<summary>x</summary>', '</details>', '', 'After.'),
    )
  })

  test('an item that opens with code keeps its marker', () => {
    expect(shown('1. ```\n   code\n   more\n   ```\n2. two', 40)).toBe(
      rows('1. code', '   more', '2. two'),
    )
  })

  test('a callout is its name and title behind a bar', () => {
    const text = '> [!WARNING] Downtime\n> The migration locks the table for a minute.\n\nAfter.'
    expect(shown(text, 30)).toBe(
      rows(
        '▌ Warning · Downtime',
        '▌ The migration locks the',
        '▌ table for a minute.',
        '',
        'After.',
      ),
    )
    expect(renderToLines(text, { width: 30 })[0]![0]!.style).toEqual({ color: 'yellow' })
  })

  test('steps are numbered down a rail', () => {
    const text =
      '> [!STEPS] Recovery\n1. **Rest**\n   Sleep eight hours, no screens.\n2. **Walk**\n\n   ```sh\n   walk --minutes 30\n   ```\n3. **Done**\n\nAfter.'
    expect(shown(text, 30)).toBe(
      rows(
        'Recovery',
        '1  Rest',
        '│  Sleep eight hours, no',
        '│  screens.',
        '│',
        '2  Walk',
        '│',
        '│  walk --minutes 30',
        '│',
        '3  Done',
        '',
        'After.',
      ),
    )
  })

  test('the numbers of a long chain end in one column, and the rail runs under it', () => {
    const steps = (count: number) =>
      `> [!STEPS]\n${Array.from({ length: count }, (_, n) => `${n + 1}. **S${n + 1}**\n   body`).join('\n')}\n`
    // Nine steps take one column: the tenth is what widens the chain.
    expect(shown(steps(9), 30).split('\n').slice(-5)).toEqual([
      '8  S8',
      '│  body',
      '│',
      '9  S9',
      '   body',
    ])
    expect(shown(steps(10), 30).split('\n').slice(-5)).toEqual([
      ' 9  S9',
      ' │  body',
      ' │',
      '10  S10',
      '    body',
    ])
  })

  test('tabs are drawn one under another, each under its label', () => {
    const text =
      '> [!TABS] Install\n#### npm\n```sh\nnpm install llx\n```\n#### bun\nRun `bun add llx`.\n\n## Next\n'
    expect(shown(text, 30)).toBe(
      rows(
        'Install',
        '─ npm ───────────────────────',
        'npm install llx',
        '',
        '─ bun ───────────────────────',
        'Run bun add llx.',
        '',
        'Next',
      ),
    )
  })

  test('figures stand side by side, each number over what it counts, while a row holds them', () => {
    const text = '> [!STATS]\n- **3x** faster\n- **700** allocations\n'
    expect(shown(text, 40)).toBe(rows('3x       700', 'faster   allocations'))
    // To the column: twenty hold them, nineteen do not.
    expect(shown(text, 20)).toBe(rows('3x       700', 'faster   allocations'))
    expect(shown(text, 19)).toBe(rows('• 3x faster', '• 700 allocations'))
    const drawn = renderToLines(text, { width: 40 })
    expect(drawn[0]![0]).toEqual({ text: '3x', style: { bold: true } })
    expect(drawn[1]![0]).toEqual({ text: 'faster', style: { dim: true } })
    // A figure with nothing said of it leaves its place under it empty, and no row ends in spaces.
    expect(shown('> [!STATS]\n- **3x** faster\n- **700**\n- **9** ms\n', 40)).toBe(
      rows('3x       700   9', 'faster         ms'),
    )
    expect(shown('> [!STATS]\n- **3x**\n- **700**\n', 40)).toBe('3x   700')
    // Sentences where figures were asked for: each still starts at its marker.
    expect(
      shown(
        '> [!STATS]\n- **Python: 10 s.** Every value becomes an object.\n- **Rust: 2 s.**\n',
        30,
      ),
    ).toBe(rows('• Python: 10 s. Every value', '  becomes an object.', '• Rust: 2 s.'))
  })

  test('the case for and against, details and sources', () => {
    const text =
      '> [!PROS]\n- small\n- fast\n\n> [!CONS] Against\n- new\n\n> [!DETAILS] How it was measured\n> The median of nine rounds.\n\n> [!SOURCES]\n- [The spec](https://spec.commonmark.org)\n- [GFM](https://github.github.com/gfm) the tables\n'
    expect(shown(text, 44)).toBe(
      rows(
        '+ small',
        '+ fast',
        '',
        'Against',
        '- new',
        '',
        '▾ How it was measured',
        '  The median of nine rounds.',
        '',
        // A source's address has a row to itself: it is whole whatever its name's length.
        '[1] The spec',
        '    https://spec.commonmark.org',
        '[2] GFM — the tables',
        '    https://github.github.com/gfm',
      ),
    )
    expect(renderToLines(text, { width: 44 })[0]![0]!.style).toEqual({ color: 'green' })
  })

  test('a title stands right above the form it names, whatever the form', () => {
    const forms: Array<[string, string]> = [
      ['> [!STEPS] Plan\n1. **One**\n', '1  One'],
      ['> [!STATS] Speed\n- **3x** faster\n', '3x'],
      ['> [!TABS] Install\n#### npm\nRun it.\n', '─ npm ─'],
      ['> [!PROS] For\n- small\n', '+ small'],
      ['> [!CONS] Against\n- new\n', '- new'],
      ['> [!SOURCES] Further reading\n- [The spec](https://a.b)\n', '[1] The spec'],
    ]
    for (const [text, first] of forms) {
      const [title, next] = shown(text, 40).split('\n')
      // A tab's rule runs on to the width: its start is what says the label follows the title.
      expect([text, title !== '', next!.slice(0, first.length)]).toEqual([text, true, first])
    }
  })

  test('a task list, an image and a loose list', () => {
    expect(
      shown('- [x] done\n- [ ] todo\n\n![a chart](https://a.b/c.png)\n\n1. one\n\n2. two\n', 40),
    ).toBe(rows('✓ done', '☐ todo', '', 'a chart (https://a.b/c.png)', '', '1. one', '', '2. two'))
  })

  test('a task hangs under its text, and a numbered one keeps its number', () => {
    const text =
      '- [ ] check who wrote the commits on the branch\n- [x] back it up\n\n1. [ ] first\n'
    expect(shown(text, 28)).toBe(
      rows('☐ check who wrote the', '  commits on the branch', '✓ back it up', '', '1. ☐ first'),
    )
    expect(renderToLines(text, { width: 28 })[2]![0]!.style).toEqual({ color: 'green' })
  })

  test('code keeps its tabs as columns', () => {
    expect(
      shown(
        '```go\nfunc main() {\n\tif ok {\n\t\treturn\n\t}\n}\n```\n\n```\na\tb\nabcd\te\n```',
        40,
      ),
    ).toBe(
      rows(
        'func main() {',
        '    if ok {',
        '        return',
        '    }',
        '}',
        '',
        'a   b',
        'abcd    e',
      ),
    )
  })

  test('code too long for a row is cut at the edge, its spaces kept', () => {
    expect(shown('```\nabcdefghijkl\n  if (a)  b\n```\n', 8)).toBe(
      rows('abcdefgh', 'ijkl', '  if (a)', '  b'),
    )
    expect(shown('- ```\n  日本語のテキスト\n  ```\n', 9)).toBe(
      rows('• 日本語', '  のテキ', '  スト'),
    )
  })

  test('a word and what runs into it go to the next row together', () => {
    expect(shown('Use the flag `--force-with-lease`: it refuses.', 31)).toBe(
      rows('Use the flag', '--force-with-lease: it refuses.'),
    )
    // What no row holds whole is still broken where it must be.
    expect(shown('`--force-with-lease`**:**', 10)).toBe(rows('--force-wi', 'th-lease:'))
  })

  test('a code span is not broken where a row holds it', () => {
    const screen = shown(
      'The line was `ordered[mid - 1] + ordered[mid] / 2`, which halves one value.',
      40,
    )
    expect(screen).toBe(
      rows('The line was', 'ordered[mid - 1] + ordered[mid] / 2,', 'which halves one value.'),
    )
    // The spaces are spaces: a command copied from the screen is the one written.
    expect(screen.includes(String.fromCharCode(0xa0))).toBe(false)
    // One no row holds is broken at its spaces, as words are.
    expect(shown('Run `python3 -B -m unittest -v test_stats` now.', 20)).toBe(
      rows('Run python3 -B -m', 'unittest -v', 'test_stats now.'),
    )
  })

  test('a quote names its source, a heading its number, a fence its file', () => {
    expect(shown('> Simple is better.\n> — Tim Peters, *The Zen*\n', 40)).toBe(
      rows('│ Simple is better.', '│ — Tim Peters, The Zen'),
    )
    expect(shown('## 2. Setup\n', 40)).toBe('2. Setup')
    expect(shown('```ts title="a.ts"\nconst a = 1\n```\n', 40)).toBe(rows('a.ts', 'const a = 1'))
  })

  test('a file tree is drawn with its branches, and what is said of the names in one column', () => {
    expect(
      shown('```tree\nsrc/\n├── app/\n│   └── App.tsx  # the page\n└── index.ts\n```\n', 40),
    ).toBe(rows('src/', '├─ app/', '│  └─ App.tsx  the page', '└─ index.ts'))
    const tree =
      '```tree\nsrc/\n├── app/\n│   ├── App.tsx  # the page\n│   └── main.ts\n├── lib/\n│   └── u.ts  # helpers\n└── index.ts  # the entry\nREADME.md\n```\n'
    expect(shown(tree, 40)).toBe(
      rows(
        'src/',
        '├─ app/',
        // A folder's line runs down to the last name in it, and no further.
        '│  ├─ App.tsx  the page',
        '│  └─ main.ts',
        '├─ lib/',
        '│  └─ u.ts     helpers',
        '└─ index.ts    the entry',
        'README.md',
      ),
    )
    const drawn = renderToLines(tree, { width: 40 })
    expect(drawn[0]![0]).toEqual({ text: 'src/', style: { bold: true } })
    expect(drawn[2]![0]).toEqual({ text: '│  ├─ ', style: { dim: true } })
    expect(drawn[2]!.at(-1)).toEqual({ text: 'the page', style: { dim: true } })
    // Under the last name of a folder nothing runs down: its own names hang in the clear.
    expect(
      shown('```tree\na/\n└── b/\n    ├── c.ts\n    └── d/\n        └── e.ts\n```\n', 40),
    ).toBe(rows('a/', '└─ b/', '   ├─ c.ts', '   └─ d/', '      └─ e.ts'))
    // Where the column does not fit the row, each is said right after its name.
    expect(shown(tree, 23).split('\n')[5]).toBe('│  └─ u.ts  helpers')
  })

  test('a tree of any depth is drawn in the time its length takes', () => {
    // A staircase: every row is the last of its folder, and each is found without reading on.
    const stairs = Array.from({ length: 3000 }, (_, n) => `${'    '.repeat(n)}d${n}/`).join('\n')
    const flatRows = Array.from({ length: 30_000 }, (_, n) => `f${n}.ts`).join('\n')
    const started = performance.now()
    expect(renderToLines(`\`\`\`tree\n${flatRows}\n\`\`\`\n`, { width: 80 })).toHaveLength(30_000)
    expect(renderToLines(`\`\`\`tree\n${stairs}\n\`\`\`\n`, { width: 80 }).length).toBeGreaterThan(
      0,
    )
    expect(performance.now() - started).toBeLessThan(5000)
  })

  test('a list’s bullet says how deep it is, and a heading its depth by its weight', () => {
    expect(shown('- a\n  - b\n    - c\n', 40)).toBe(rows('• a', '  ◦ b', '    • c'))
    // The depth is the list's own: after a list, and after a nested one, the next starts over.
    expect(shown('> [!NOTE]\n> - a\n>\n> Text.\n>\n> - c\n', 40)).toBe(
      rows('▌ Note', '▌ • a', '▌', '▌ Text.', '▌', '▌ • c'),
    )
    expect(shown('- a\n  - b\n\nText.\n\n- c\n  - d\n', 40)).toBe(
      rows('• a', '  ◦ b', '', 'Text.', '', '• c', '  ◦ d'),
    )
    const styles = renderToLines('# One\n\n## Two\n\n### Three\n\n#### Four\n', { width: 40 })
      .filter((row) => row.length > 0)
      .map((row) => row[0]!.style)
    expect(styles).toEqual([
      { bold: true, underline: true },
      { bold: true },
      { bold: true, italic: true },
      { italic: true },
    ])
  })

  test('a diff says what it adds and takes away with no highlighter, a diagram what it is', () => {
    const drawn = renderToLines('```diff\n@@ -1 +1 @@\n-old\n+new\n same\n```\n', { width: 40 })
    expect(drawn.map((row) => [lineText(row), row[0]!.style])).toEqual([
      ['@@ -1 +1 @@', { dim: true }],
      ['-old', { color: 'red' }],
      ['+new', { color: 'green' }],
      [' same', { color: 'cyan' }],
    ])
    // Only a diff is read by its lines: a list in a plain fence is code.
    for (const fence of ['```\n+ a\n- b\n```\n', '```sh\n+ a\n- b\n```\n'])
      expect(renderToLines(fence, { width: 40 }).map((row) => row[0]!.style)).toEqual([
        { color: 'cyan' },
        { color: 'cyan' },
      ])
    expect(renderToLines('```PATCH\n+a\n```\n', { width: 40 })[0]![0]!.style).toEqual({
      color: 'green',
    })
    expect(shown('```mermaid\ngraph TD\n  A --> B\n```\n', 40)).toBe(
      rows('Diagram', 'graph TD', '  A --> B'),
    )
    // A fence with a name of its own keeps it, and an empty one says nothing.
    expect(shown('```mermaid title="flow.mmd"\ngraph TD\n```\n', 40)).toBe(
      rows('flow.mmd', 'graph TD'),
    )
    expect(shown('```mermaid\n```\n', 40)).toBe('')
  })

  test('a footnote is its number, where it is named and where it is told', () => {
    expect(shown('A claim.[^a]\n\n[^a]: Its source.\n', 40)).toBe(
      rows('A claim.[1]', '', '[1] Its source.'),
    )
  })

  test('styles carry meaning', () => {
    const [row] = renderToLines('**bold** `code` *it* ~~gone~~ [x](https://u.v)', { width: 60 })
    const style = (text: string) => row!.find((run) => run.text === text)?.style
    expect(style('bold')).toEqual({ bold: true })
    expect(style('code')).toEqual({ color: 'cyan' })
    expect(style('it')).toEqual({ italic: true })
    expect(style('gone')).toEqual({ strike: true })
    expect(style('x')).toEqual({ underline: true })
    expect(renderToAnsi('**bold** `code`', { width: 60 })).toBe(
      `${ESC}[1mbold${ESC}[0m ${ESC}[36mcode${ESC}[0m`,
    )
  })

  test('the words the renderer adds are the caller’s to replace', () => {
    const labels = { callouts: { tip: 'Совет' }, details: 'Подробнее', diagram: 'Схема' }
    expect(shown('> [!TIP]\n> x\n', 40)).toBe(rows('▌ Tip', '▌ x'))
    expect(renderToAnsi('> [!TIP]\n> x\n', { width: 40, color: false, labels })).toBe(
      rows('▌ Совет', '▌ x'),
    )
    expect(shown('> [!IMPORTANT]\n> x\n', 40)).toBe(rows('▌ Important', '▌ x'))
    expect(renderToLines('> [!IMPORTANT]\n> x\n', { width: 40 })[0]![0]!.style).toEqual({
      color: 'magenta',
    })
    expect(renderToAnsi('```mermaid\ngraph TD\n```\n', { width: 40, color: false, labels })).toBe(
      rows('Схема', 'graph TD'),
    )
  })

  test('nesting deeper than the width holds is drawn flat, and still read', () => {
    const text = `${'> '.repeat(12)}deep down\n`
    for (const width of [8, 12, 30]) {
      const drawn = renderToLines(text, { width })
      for (const row of drawn) expect(lineWidth(row)).toBeLessThanOrEqual(width)
      expect(drawn.map(lineText).join(' ').replace(/[│\s]/g, '')).toBe('deepdown')
    }
  })

  test('an empty text draws nothing, and an empty item its marker', () => {
    expect(renderToLines('', { width: 40 })).toEqual([])
    expect(renderToLines('\n\n', { width: 40 })).toEqual([])
    expect(shown('- \n- b\n', 40)).toBe(rows('• ', '• b'))
  })
})

describe('columns', () => {
  test('a character takes the columns a terminal gives it', () => {
    expect(textWidth('abc')).toBe(3)
    expect(textWidth('中文')).toBe(4)
    expect(textWidth('日本語のテキスト')).toBe(16)
    expect(textWidth('한글')).toBe(4)
    expect(textWidth('ｆｕｌｌ')).toBe(8)
    expect(textWidth('🚀')).toBe(2)
    // A combining accent sits on its letter; a joiner and a variation selector take no cell.
    expect(textWidth(`e${String.fromCharCode(0x301)}`)).toBe(1)
    expect(textWidth(String.fromCharCode(0x200d, 0xfe0f))).toBe(0)
    expect(textWidth('naïve café — ok')).toBe(15)
    expect(textWidth('Привет')).toBe(6)
  })

  test('wide text wraps by its columns', () => {
    for (const width of [8, 9, 15]) {
      const drawn = renderToLines('日本語のテキストは幅が二倍です', { width })
      for (const row of drawn) expect(lineWidth(row)).toBeLessThanOrEqual(width)
      expect(drawn.map(lineText).join('')).toBe('日本語のテキストは幅が二倍です')
    }
  })
})

describe('on the corpus', () => {
  const WIDTHS = [8, 23, 80]

  test('no row is wider than the width', () => {
    const wide: string[] = []
    for (const [name, markdown] of corpus()) {
      for (const width of WIDTHS) {
        for (const row of renderToLines(markdown, { width })) {
          if (lineWidth(row) > width) wide.push(`${name} at ${width}: ${lineText(row)}`)
        }
      }
    }
    expect(wide.slice(0, 5)).toEqual([])
  })

  /** Whether `code` is an instruction to a terminal, or reorders what is shown. */
  const acts = (code: number): boolean =>
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x200e ||
    code === 0x200f ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)

  const acting = (text: string): string[] =>
    [...text]
      .filter((char) => acts(char.codePointAt(0)!))
      .map((char) => char.codePointAt(0)!.toString(16))

  /** Texts made to act on a terminal: sequences that clear, retitle, move, report and reorder. */
  const HOSTILE = [
    `${ESC}[2J${ESC}[H`,
    `${ESC}]0;title${String.fromCharCode(7)}`,
    `${ESC}]8;;https://evil.example${ESC}\\link${ESC}]8;;${ESC}\\`,
    `${ESC}[6n${ESC}[c`,
    `${ESC}P+q544e${ESC}\\`,
    `${String.fromCharCode(0x9b)}2J${String.fromCharCode(0x9d)}0;x${String.fromCharCode(0x9c)}`,
    `back${String.fromCharCode(8, 8, 8, 8)}over${String.fromCharCode(13)}start`,
    `txt${String.fromCharCode(0x202e)}exe.${String.fromCharCode(0x2066)}x${String.fromCharCode(0x2069)}`,
    `bell${String.fromCharCode(7)} null${String.fromCharCode(0)} del${String.fromCharCode(0x7f)}`,
    `line${String.fromCharCode(0x2028)}sep${String.fromCharCode(0x2029)}para${String.fromCharCode(0x85)}nel`,
  ]

  /** Every place of a document a text can be in. */
  const PLACES: Array<(text: string) => string> = [
    (text) => `${text}\n`,
    (text) => `# ${text}\n`,
    (text) => `- ${text}\n- [x] ${text}\n`,
    (text) => `> ${text}\n`,
    (text) => `\`${text}\`\n`,
    (text) => `\`\`\`${text}\n${text}\n\`\`\`\n`,
    (text) => `\`\`\`ts title="${text}"\n${text}\n\`\`\`\n`,
    (text) => `\`\`\`tree\n${text}/\n├── ${text}  # ${text}\n\`\`\`\n`,
    (text) => `[${text}](https://a.b/${text} "${text}")\n`,
    (text) => `![${text}](https://a.b/c.png "${text}")\n`,
    (text) => `| ${text} | b |\n|---|---|\n| c | ${text} |\n`,
    (text) => `> [!WARNING] ${text}\n> ${text}\n`,
    (text) => `> [!TABS] ${text}\n> ### ${text}\n> ${text}\n`,
    (text) => `> [!DETAILS] ${text}\n> ${text}\n`,
    (text) => `> [!STEPS] ${text}\n> 1. **${text}** · ${text}\n>    ${text}\n`,
    (text) => `> [!STATS] ${text}\n> - **${text}** ${text}\n`,
    (text) => `> [!SOURCES]\n> - [${text}](https://a.b) ${text}\n`,
    (text) => `<div>${text}</div>\n\n<span>${text}</span>\n`,
    (text) => `A[^1]\n\n[^1]: ${text}\n`,
  ]

  test('nothing a text holds reaches the terminal as an instruction', () => {
    const reached: string[] = []
    const check = (name: string, markdown: string, streaming: boolean) => {
      for (const width of [8, 80]) {
        const drawn = renderToLines(markdown, { width, streaming })
        const found = acting(drawn.map(lineText).join(''))
        if (found.length > 0) reached.push(`${name} at ${width}: ${found.join(' ')}`)
        // Coloured, the sequences are the renderer's own and nothing else: taken out, what is
        // left is the plain text, row for row.
        const coloured = toAnsi(drawn, true)
        const plain = toAnsi(drawn, false)
        const stripped = coloured.replaceAll(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '')
        if (stripped !== plain || plain.split('\n').length !== Math.max(1, drawn.length))
          reached.push(`${name} at ${width}: a sequence that is not a style`)
      }
    }
    for (const [name, markdown] of corpus()) check(name, markdown, false)
    for (const [at, text] of HOSTILE.entries())
      for (const [place, put] of PLACES.entries()) {
        check(`hostile ${at} in place ${place}`, put(text), false)
        // Cut anywhere, as a stream would: a sequence half arrived is as harmless.
        const whole = put(text)
        for (let end = 1; end < whole.length; end += 3)
          check(`hostile ${at} in place ${place} cut at ${end}`, whole.slice(0, end), true)
      }
    expect(reached.slice(0, 5)).toEqual([])
  })

  test('what a hostile text says is still shown, written out', () => {
    expect(
      shown(`hi ${ESC}[2J there\n\n\`\`\`\n${ESC}]0;x${String.fromCharCode(7)}\n\`\`\``, 40),
    ).toBe(rows('hi \\u{1b}[2J there', '', '\\u{1b}]0;x\\u{7}'))
    expect(printable(`a${String.fromCharCode(9)}b${String.fromCharCode(0x202e)}c`)).toBe(
      'a\\tb\\u{202e}c',
    )
  })

  /** The text a tree holds to read, in the order it is written, without its spaces. */
  function read(node: Node, out: string[]): void {
    const form = formOf(node)?.form
    // A source's host repeats its address, which is printed; a tree fence is drawn from its rows.
    if (form === 'source-host') return
    if (node.type === 'code' && node.lang === 'tree') return
    // A formula is on the screen as the terminal writes it: `math.test.ts` says what that is.
    if (node.type === 'inlineMath' || node.type === 'math') {
      out.push(printable(mathText(node.value ?? '').replace(/\s/g, '')))
      return
    }
    if (typeof node.value === 'string') out.push(printable(node.value.replace(/\s/g, '')))
    for (const child of node.children ?? []) read(child, out)
  }

  /** A table, or the figures of `[!STATS]`: what is drawn side by side, not in the order written. */
  const hasTable = (node: Node): boolean =>
    node.type === 'table' || formOf(node)?.form === 'stats' || (node.children ?? []).some(hasTable)

  test('no text is lost', () => {
    const lost: string[] = []
    for (const [name, markdown] of corpus()) {
      const held: string[] = []
      let table = false
      for (const block of createDocument().update(markdown, { math: true }).blocks) {
        const tree = parse(block.source, { extensions: [flowdownDialect, mathSyntax] })
        table ||= hasTable(tree)
        read(tree, held)
      }
      const want = held.join('')
      for (const width of WIDTHS) {
        const got = renderToLines(markdown, { width }).map(lineText).join('').replace(/\s/g, '')
        if (table) {
          // Cells and figures are drawn side by side: every character is there, in another order.
          const count = new Map<string, number>()
          for (const char of got) count.set(char, (count.get(char) ?? 0) + 1)
          for (const char of want) {
            const left = (count.get(char) ?? 0) - 1
            if (left < 0) {
              lost.push(`${name} at ${width}: ${JSON.stringify(char)}`)
              break
            }
            count.set(char, left)
          }
          continue
        }
        // Everything else is drawn in the order it is written: the text is a subsequence.
        let at = 0
        for (const char of got) if (at < want.length && char === want[at]) at++
        if (at < want.length)
          lost.push(
            `${name} at ${width}: after ${JSON.stringify(want.slice(Math.max(0, at - 30), at))} wants ${JSON.stringify(want.slice(at, at + 30))}`,
          )
      }
    }
    expect(lost.slice(0, 5)).toEqual([])
  })
})

describe('a reply while it arrives', () => {
  const same = (a: Line[], b: Line[]) => expect(toAnsi(a)).toBe(toAnsi(b))

  test('every step is what a fresh render of that text draws', () => {
    const patterns: Pattern[] = ['token', 'frame', 'line']
    const documents = [
      ...Object.entries(namedDocuments()).map(([, text]) => text.slice(0, 2_500)),
      ...Object.values(FAMILIES).flatMap((document) =>
        Array.from({ length: Math.min(SEEDS, 40) }, (_, seed) => document(seed + 1)),
      ),
    ]
    let steps = 0
    documents.forEach((markdown, index) => {
      const pattern = patterns[index % patterns.length]!
      const width = [80, 30, 12][index % 3]!
      const view = createTerminalView({ width })
      const all = prefixes(markdown, pattern, index + 1)
      // Every step is drawn, as a stream draws it; one in a few is held to a fresh render.
      all.forEach((prefix, at) => {
        const drawn = view.render(prefix, { streaming: true })
        if (at % 7 === 0 || at === all.length - 1) {
          same(drawn, renderToLines(prefix, { width, streaming: true }))
          steps++
        }
      })
      same(view.render(markdown), renderToLines(markdown, { width }))
    })
    expect(steps).toBeGreaterThan(500)
  })

  test('the rows of a block that did not change are the same objects', () => {
    const view = createTerminalView({ width: 40 })
    const start =
      '# Title\n\nA first paragraph that is long enough to wrap onto a second row.\n\n- a\n- b\n\n'
    const before = view.render(`${start}The last`, { streaming: true })
    const after = view.render(`${start}The last block grows.`, { streaming: true })
    const stable = before.length - 1
    expect(stable).toBeGreaterThan(5)
    for (let at = 0; at < stable; at++) {
      // A blank row between blocks is made each time; a block's own rows are kept.
      if (before[at]!.length > 0) expect(after[at]).toBe(before[at]!)
    }
    expect(lineText(after.at(-1)!)).toBe('The last block grows.')
  })

  test('a terminal resized is drawn for its new width', () => {
    const view = createTerminalView({ width: 80 })
    const text =
      'One two three four five six seven eight nine ten eleven twelve.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'
    view.render(text)
    same(view.render(text, { width: 20 }), renderToLines(text, { width: 20 }))
    same(view.render(text), renderToLines(text, { width: 20 }))
  })

  test('a fence left open is drawn as code from its first line', () => {
    expect(shown('```sh\nnpm i', 40)).toBe(rows('npm i'))
    expect(renderToAnsi('```sh\nnpm i', { width: 40, color: false, streaming: true })).toBe('npm i')
    expect(renderToAnsi('Some **bold te', { width: 40, color: false, streaming: true })).toBe(
      'Some bold te',
    )
  })
})
