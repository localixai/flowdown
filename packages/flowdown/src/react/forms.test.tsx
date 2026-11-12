import { describe, expect, test } from 'bun:test'
import { ANSWER_FORM_EXAMPLES } from '../dialect'
import { parseFileTree } from '../core/file-tree-parse'
import { render } from '../../test/render'

describe('tabs (`> [!TABS]` with a heading per variant)', () => {
  const TABS = [
    '> [!TABS]',
    '> #### macOS',
    '> brew install llx',
    '> #### Linux',
    '> curl -fsSL get.llx.sh | sh',
  ].join('\n')

  test('each heading becomes a tab, the first shown and the rest kept in the DOM', () => {
    const html = render(TABS)
    expect(html).toContain('class="fd-tabs"')
    expect(html).toContain('macOS')
    expect(html).toContain('Linux')
    // Every panel is rendered — hidden ones too — so find-in-page and copy still reach them.
    expect(html).toContain('brew install llx')
    expect(html).toContain('curl -fsSL get.llx.sh | sh')
    expect(html.match(/role="tabpanel"/g)?.length).toBe(2)
    expect(html.match(/hidden=""/g)?.length).toBe(1)
    expect(html).not.toContain('[!TABS]')
  })

  test('without a heading under the marker it stays the quote it was written as', () => {
    expect(render('> [!TABS]\n> just text')).toContain('<blockquote')
  })

  test('formatted headings retain their complete tab label', () => {
    const html = render(
      '> [!TABS]\n#### **macOS** `arm64`\nOne.\n#### [Linux](https://example.com)\nTwo.',
    )
    expect(html).toContain('>macOS arm64</button>')
    expect(html).toContain('>Linux</button>')
  })
})

describe('headline figures (`> [!STATS]`)', () => {
  test('each item is its bold value over its label', () => {
    const html = render('> [!STATS]\n> - **3×** faster builds\n> - **−40%** memory')
    expect(html).toContain('<ul class="fd-stats">')
    expect(html).toContain(
      '<div class="fd-stat"><span class="fd-stat-value">3×</span><span class="fd-stat-label">faster builds</span></div>',
    )
  })
})

describe('the case for and against (`> [!PROS]` / `> [!CONS]`)', () => {
  test('written one after the other, the two are paired side by side', () => {
    const html = render('> [!PROS]\n> - fast\n\n> [!CONS]\n> - costly')
    expect(html).toContain('<div class="fd-verdicts">')
    expect(html).toContain('<aside class="fd-verdict" data-verdict="pros">')
    expect(html).toContain('<aside class="fd-verdict" data-verdict="cons">')
    expect(html.indexOf('data-verdict="pros"')).toBeLessThan(html.indexOf('data-verdict="cons"'))
  })

  test('alone, a side is its own aside, with the title the author wrote', () => {
    const html = render('> [!CONS] Risks\n> - lock-in')
    expect(html).not.toContain('fd-verdicts')
    expect(html).toContain('<p class="fd-verdict-title">Risks</p>')
  })
})

describe('file tree (a ```tree fence)', () => {
  const TREE = ['src/', '├── app.ts        # entry point', '└── features/', '    └── chat/'].join(
    '\n',
  )

  test('depth, folders and comments are read off the drawing', () => {
    expect(parseFileTree(TREE)).toMatchObject([
      { depth: 0, name: 'src/', comment: '', folder: true, parent: null },
      { depth: 1, name: 'app.ts', comment: 'entry point', folder: false, parent: 0 },
      { depth: 1, name: 'features/', comment: '', folder: true, parent: 0 },
      { depth: 2, name: 'chat/', comment: '', folder: true, parent: 2 },
    ])
    // A path per row is the key a fold and the arrow keys use.
    expect(parseFileTree(TREE)[3]!.path).toBe('src/features/chat/#3')
  })

  test('folders are foldable treeitems, open at first; files are not foldable', () => {
    const html = render(`\`\`\`tree\n${TREE}\n\`\`\``)
    expect(html.match(/role="treeitem"/g)?.length).toBe(4)
    expect(html.match(/aria-expanded="true"/g)?.length).toBe(3)
    // One Tab stop for the whole tree.
    expect(html.match(/tabindex="0"/g)?.length).toBe(1)
  })

  test('renders as a tree of rows rather than box characters in a code block', () => {
    const html = render(`\`\`\`tree\n${TREE}\n\`\`\``)
    expect(html).toContain('role="tree"')
    expect(html).toMatch(
      /<span class="fd-tree-comment[^"]*" title="entry point">entry point<\/span>/,
    )
    expect(html).not.toContain('├──')
  })
})

describe('checklists (GFM `- [ ] item`)', () => {
  const LIST = '- [ ] backup the database\n- [x] tag the release'

  test('the boxes show their source state, read-only, keyed by where their item starts', () => {
    const html = render(LIST)
    expect(html.match(/type="checkbox"/g)?.length).toBe(2)
    expect(html.match(/disabled=""/g)?.length).toBe(2)
    expect(html.match(/checked=""/g)?.length).toBe(1)
    // The key is the item's offset in the source, so a page can store a tick or rewrite `[ ]`.
    expect(html).toContain('data-task-key="0"')
    expect(html).toContain(`data-task-key="${LIST.indexOf('- [x]')}"`)
  })
})

/**
 * What models actually write: the marker as a one-line quote, then the content UNQUOTED. Markdown
 * ends a quote at a heading or a list, so read literally the marker governed nothing — both cases
 * below are verbatim from a live session where every form rendered as a stray `[!TABS]` line.
 */
describe('a marker-only quote governs the blocks right after it', () => {
  test('tabs: the unquoted headings that follow become the tabs', () => {
    const html = render(
      '> [!TABS]\n#### macOS\nUse fnm.\n\n```sh\nfnm install --lts\n```\n\n#### Linux\nSame on Linux.',
    )
    expect(html).toContain('class="fd-tabs"')
    expect(html).not.toContain('[!TABS]')
    expect(html.match(/role="tabpanel"/g)?.length).toBe(2)
  })

  test('pros/cons inside those tabs are shaped too, each taking the list after it', () => {
    const html = render(
      [
        '> [!TABS]',
        '#### PostgreSQL',
        '> [!PROS]',
        '- concurrent writes',
        '',
        '> [!CONS]',
        '- needs a server',
        '',
        '#### SQLite',
        '> [!PROS]',
        '- one file',
      ].join('\n'),
    )
    expect(html.match(/role="tabpanel"/g)?.length).toBe(2)
    expect(html).toContain('<div class="fd-verdicts">')
    expect(html).not.toContain('[!PROS]')
    expect(html).not.toContain('[!CONS]')
  })

  test('a list form takes only the ONE list after it; prose after the tabs ends at `---`', () => {
    const steps = render('> [!STEPS]\n1. **Day 1**\n   Rest.\n\nAfterwards, walk.')
    expect(steps).toContain('class="fd-steps"')
    expect(steps).toContain('<p>Afterwards, walk.</p>')
    const tabs = render('> [!TABS]\n#### A\nOne.\n\n---\n\nAfter.')
    expect(tabs.indexOf('After.')).toBeGreaterThan(tabs.lastIndexOf('role="tabpanel"'))
  })

  test('every example the prompt shows renders as its form, with no marker left as text', () => {
    const expected: Record<keyof typeof ANSWER_FORM_EXAMPLES, string[]> = {
      comparison: ['class="fd-tabs"', '<div class="fd-verdicts">'],
      verdict: ['<div class="fd-verdicts">'],
      steps: ['class="fd-steps"', 'fd-step-title'],
      stats: ['<ul class="fd-stats">', 'fd-stat-value'],
      details: ['<details class="fd-details">', '<summary>Full log</summary>'],
      sources: ['<ul class="fd-sources">', 'fd-source-host'],
    }
    for (const [form, lines] of Object.entries(ANSWER_FORM_EXAMPLES)) {
      const html = render(lines.join('\n'))
      for (const fragment of expected[form as keyof typeof expected])
        expect(html, form).toContain(fragment)
      expect(html, form).not.toContain('[!')
    }
  })

  test('a marker with nothing it can govern still stays a quote', () => {
    expect(render('> [!STATS]\n\nJust prose.')).toContain('<blockquote')
  })
})

describe('a reply that also carries raw HTML', () => {
  test('keeps the dialect: callouts and timelines survive the sanitizer', () => {
    const html = render(
      '<b>note</b>\n\n> [!STEPS]\n> 1. **Day 1**\n>    Rest.\n\n> [!TIP]\n> Cache it.',
    )
    expect(html).toContain('class="fd-steps"')
    expect(html).toContain('fd-step-title')
    expect(html).toContain('data-callout="tip"')
  })
})

const RECOVERY = [
  '> [!STEPS] Recovery after surgery',
  '> 1. **First 24 hours**',
  '>    *Day 1*',
  '>    Coming out of anaesthesia; keep her warm and still.',
  '> 2. **Activity returns**',
  '>    *Days 2–3*',
  '>    Appetite comes back; keep walks short.',
].join('\n')

describe('steps (`> [!STEPS]` over a list)', () => {
  test('the quote gives way to a timeline list, its marker gone and its title above', () => {
    const html = render(RECOVERY)
    expect(html).toContain('<ol class="fd-steps">')
    expect(html).not.toContain('<blockquote')
    expect(html).not.toContain('[!STEPS]')
    expect(html).toContain('<p class="fd-steps-title">Recovery after surgery</p>')
  })

  test('each step splits into a head — title and quiet "when" — and its own text', () => {
    const html = render(RECOVERY)
    expect(html).toContain(
      '<div class="fd-step-head"><span class="fd-step-title">First 24 hours</span><span class="fd-step-meta">Day 1</span></div>',
    )
    expect(html).toContain(
      '<div class="fd-step-body">Coming out of anaesthesia; keep her warm and still.</div>',
    )
  })

  test('the "when" may sit on the title line after a dash, and may be absent', () => {
    const html = render(
      ['> [!STEPS]', '> - **Install** — *5 min*', '>   Run the installer.', '> - **Verify**'].join(
        '\n',
      ),
    )
    expect(html).toContain('<ul class="fd-steps">')
    expect(html).toContain('<span class="fd-step-meta">5 min</span>')
    expect(html).toContain('<div class="fd-step-body">Run the installer.</div>')
    expect(html).toContain(
      '<div class="fd-step-head"><span class="fd-step-title">Verify</span></div>',
    )
    expect(html).not.toContain('fd-steps-title')
  })

  test('an ordinary bold-led list is NOT a timeline — only the marker makes one', () => {
    const html = render('1. **Pros:** fast\n2. **Cons:** costly')
    expect(html).not.toContain('fd-steps')
    expect(html).toContain('<strong>Pros:</strong>')
  })

  test('a marker with no list under it stays the quote it was written as', () => {
    const html = render('> [!STEPS]\n> Just a sentence.')
    expect(html).not.toContain('fd-steps')
    expect(html).toContain('<blockquote')
  })
})

describe('a folded section (`> [!DETAILS]`)', () => {
  test('the quote becomes a native details, its title the summary, its content kept whole', () => {
    const html = render('> [!DETAILS] Build log\n> First line.\n>\n> ```sh\n> bun test\n> ```')
    expect(html).toContain(
      '<details class="fd-details">\n<summary>Build log</summary>\n<p>First line.</p>',
    )
    expect(html).toContain('<p>First line.</p>')
    expect(html).toContain('language-sh')
    expect(html).not.toContain('<blockquote')
    expect(html).not.toContain('[!DETAILS]')
  })

  test('without a title it has no summary: the browser prints its own, in its language', () => {
    const html = render('> [!DETAILS]\n> Hidden.')
    expect(html).toContain('<details class="fd-details">\n<p>Hidden.</p>')
    expect(html).not.toContain('<summary')
  })

  test('a title with formatting is content, and a list right under the marker is folded', () => {
    expect(render('> [!DETAILS] **Bold** title\n> Body.')).toContain(
      '<details class="fd-details">\n<p><strong>Bold</strong> title\nBody.</p>',
    )
    const html = render('> [!DETAILS] Steps taken\n> - one\n> - two')
    expect(html).toContain('<summary>Steps taken</summary>\n<ul>')
  })

  test('it folds only what was quoted: a list after the quote is not taken', () => {
    const html = render('> [!DETAILS] More\n> Inside.\n\n- outside')
    expect(html.indexOf('outside')).toBeGreaterThan(html.indexOf('</details>'))
  })

  test('a callout inside it is still a callout, and it survives the sanitizer', () => {
    const html = render('<b>x</b>\n\n> [!DETAILS] Why\n> > [!TIP]\n> > Cache it.')
    expect(html).toContain('<details class="fd-details">\n<summary>Why</summary>')
    expect(html).toContain('data-callout="tip"')
  })
})

describe('references (`> [!SOURCES]` over a list of links)', () => {
  test('each link shows its title and its site, the note after it kept', () => {
    const html = render(
      '> [!SOURCES] Further reading\n- [CommonMark spec](https://www.commonmark.org/spec) — the grammar\n- [Local notes](./notes.md)',
    )
    expect(html).toContain('<p class="fd-sources-title">Further reading</p>')
    expect(html).toContain('<ul class="fd-sources">')
    expect(html).toContain(
      '<span class="fd-source-title">CommonMark spec</span><span class="fd-source-host">commonmark.org</span></a>',
    )
    expect(html).toContain('<span class="fd-source-note">the grammar</span>')
    // A relative link has no site to name.
    expect(html).toContain('<span class="fd-source-title">Local notes</span></a>')
    expect(html).not.toContain('[!SOURCES]')
  })

  test('a bare URL is named by its site, not printed twice', () => {
    const html = render('> [!SOURCES]\n- https://example.com/a/b')
    expect(html).toContain('<span class="fd-source-title">example.com</span></a>')
    expect(html).not.toContain('fd-source-host')
  })

  test('an item that is not a link stays a plain line; with raw HTML the form survives', () => {
    const html = render('<b>x</b>\n\n> [!SOURCES]\n- plain\n- [A](https://a.dev)')
    expect(html).toContain('<li>plain</li>')
    expect(html).toContain('<span class="fd-source-host">a.dev</span>')
  })
})

describe('a code fence that names its file', () => {
  test('`title=`, `filename=` and a bare path all title the block; other words do not', () => {
    for (const info of ['ts title="src/app.ts"', "ts filename='src/app.ts'", 'ts src/app.ts']) {
      const html = render('```' + info + '\nconst a = 1\n```')
      expect(html, info).toContain('<span class="fd-code-title">src/app.ts</span>')
      expect(html, info).toContain('<span class="fd-code-language">ts</span>')
    }
    expect(render('```ts {1,3} showLineNumbers\nconst a = 1\n```')).not.toContain('fd-code-title')
    expect(render('```ts\nconst a = 1\n```')).not.toContain('fd-code-title')
  })

  test('the title survives the sanitizer and shows while the fence is still open', () => {
    expect(render('<b>x</b>\n\n```ts title="a.ts"\nconst a = 1\n```')).toContain(
      '<span class="fd-code-title">a.ts</span>',
    )
    expect(render('```ts title="a.ts"\nconst a = 1', { streaming: true })).toContain(
      '<span class="fd-code-title">a.ts</span>',
    )
  })
})

describe('a callout title on the marker line', () => {
  test('stays the title when the body under it opens with formatting', () => {
    const html = render('> [!CAUTION] Data loss\n> `--force` drops the column.')
    expect(html).toContain('aria-label="Data loss"')
    expect(html).toContain('<p><code>--force</code> drops the column.</p>')
  })
  test('is body text when the marker line itself carries formatting', () => {
    const html = render('> [!NOTE] **Do not** run it twice')
    expect(html).not.toContain('aria-label="Do not')
    expect(html).toContain('<strong>Do not</strong> run it twice')
  })
})
