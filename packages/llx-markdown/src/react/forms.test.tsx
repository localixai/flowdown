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
    expect(html).toContain('class="llx-tabs"')
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
    expect(html).toContain('<ul class="llx-stats">')
    expect(html).toContain(
      '<div class="llx-stat"><span class="llx-stat-value">3×</span><span class="llx-stat-label">faster builds</span></div>',
    )
  })
})

describe('the case for and against (`> [!PROS]` / `> [!CONS]`)', () => {
  test('written one after the other, the two are paired side by side', () => {
    const html = render('> [!PROS]\n> - fast\n\n> [!CONS]\n> - costly')
    expect(html).toContain('<div class="llx-verdicts">')
    expect(html).toContain('<aside class="llx-verdict" data-verdict="pros">')
    expect(html).toContain('<aside class="llx-verdict" data-verdict="cons">')
    expect(html.indexOf('data-verdict="pros"')).toBeLessThan(html.indexOf('data-verdict="cons"'))
  })

  test('alone, a side is its own aside, with the title the author wrote', () => {
    const html = render('> [!CONS] Risks\n> - lock-in')
    expect(html).not.toContain('llx-verdicts')
    expect(html).toContain('<p class="llx-verdict-title">Risks</p>')
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
      /<span class="llx-tree-comment[^"]*" title="entry point">entry point<\/span>/,
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
    expect(html).toContain('class="llx-tabs"')
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
    expect(html).toContain('<div class="llx-verdicts">')
    expect(html).not.toContain('[!PROS]')
    expect(html).not.toContain('[!CONS]')
  })

  test('a list form takes only the ONE list after it; prose after the tabs ends at `---`', () => {
    const steps = render('> [!STEPS]\n1. **Day 1**\n   Rest.\n\nAfterwards, walk.')
    expect(steps).toContain('class="llx-steps"')
    expect(steps).toContain('<p>Afterwards, walk.</p>')
    const tabs = render('> [!TABS]\n#### A\nOne.\n\n---\n\nAfter.')
    expect(tabs.indexOf('After.')).toBeGreaterThan(tabs.lastIndexOf('role="tabpanel"'))
  })

  test('every example the prompt shows renders as its form, with no marker left as text', () => {
    const expected: Record<keyof typeof ANSWER_FORM_EXAMPLES, string[]> = {
      comparison: ['class="llx-tabs"', '<div class="llx-verdicts">'],
      verdict: ['<div class="llx-verdicts">'],
      steps: ['class="llx-steps"', 'llx-step-title'],
      stats: ['<ul class="llx-stats">', 'llx-stat-value'],
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
    expect(html).toContain('class="llx-steps"')
    expect(html).toContain('llx-step-title')
    expect(html).toContain('data-callout="tip"')
  })
})
