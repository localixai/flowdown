import { describe, expect, test } from 'bun:test'
import { fenceScanStats } from './fence-scan'
import { closePartialMarkdown, openFenceBody, isGrowingFence } from './heal'

describe('closePartialMarkdown math', () => {
  test('withholds a formula still being typed, from its opening dollar', () => {
    expect(closePartialMarkdown('Energy is $E = mc')).toBe('Energy is')
    expect(closePartialMarkdown('Then:\n$$\n\\frac{a}{')).toBe('Then:')
    expect(closePartialMarkdown('Done $a$ and $b')).toBe('Done $a$ and')
  })

  test('keeps a closed formula, currency and shell variables as they are', () => {
    expect(closePartialMarkdown('Energy is $E = mc^2$ here')).toBe('Energy is $E = mc^2$ here')
    expect(closePartialMarkdown('It costs $5 today')).toBe('It costs $5 today')
    expect(closePartialMarkdown('Set $HOME/bin first')).toBe('Set $HOME/bin first')
    expect(closePartialMarkdown('Export $PATH before')).toBe('Export $PATH before')
    expect(closePartialMarkdown('Escaped \\$x stays')).toBe('Escaped \\$x stays')
    expect(closePartialMarkdown('In code `echo $x` only')).toBe('In code `echo $x` only')
  })

  test('a dollar that can never open or close a formula hides nothing', () => {
    const shell = 'for i in $(seq 1 12); do printf "line %s" $i; done'
    expect(closePartialMarkdown(shell)).toBe(shell)
    expect(closePartialMarkdown('for i in $(seq 1 12); do printf "line %s" $i')).toBe(
      'for i in $(seq 1 12); do printf "line %s" $i',
    )
    expect(closePartialMarkdown('It costs 5$ and')).toBe('It costs 5$ and')
    expect(closePartialMarkdown('Spaced $ x')).toBe('Spaced $ x')
    expect(closePartialMarkdown('Then $a$5 more')).toBe('Then $a$5 more')
    // A dollar at the very end may open a formula with the next token.
    expect(closePartialMarkdown('Energy is $')).toBe('Energy is')
    expect(closePartialMarkdown('Energy is $E$')).toBe('Energy is $E$')
  })

  test('a * or _ inside a closed formula is not an open emphasis', () => {
    expect(closePartialMarkdown('Product $a*b$ and $x_i$ done')).toBe(
      'Product $a*b$ and $x_i$ done',
    )
  })
})

describe('closePartialMarkdown callout markers', () => {
  test('hides a callout marker still being typed, keeps a complete one', () => {
    expect(closePartialMarkdown('Intro\n\n> [!WARN')).toBe('Intro\n')
    expect(closePartialMarkdown('Intro\n\n> [!')).toBe('Intro\n')
    expect(closePartialMarkdown('> [')).toBe('')
    expect(closePartialMarkdown('Intro\n\n> [!WARNING]')).toBe('Intro\n\n> [!WARNING]')
  })

  test('leaves an ordinary quote or a bracket in prose alone', () => {
    expect(closePartialMarkdown('> quoted [text')).toBe('> quoted [text')
    expect(closePartialMarkdown('See [')).toBe('See [')
  })
})

describe('a text with nothing to complete', () => {
  test('comes back as the very string, not a copy of it', () => {
    const text = `${'A paragraph of plain prose.\n\n'.repeat(50)}And the last one, finished.`
    expect(closePartialMarkdown(text)).toBe(text)
    expect(closePartialMarkdown(`${text} **bold`)).toBe(`${text} **bold**`)
  })
})

describe('openFenceBody', () => {
  test('is the body of the one unterminated fence, and null once every fence is closed', () => {
    expect(openFenceBody('Intro\n```mermaid\nflowchart LR\n  A --> B')).toBe(
      'flowchart LR\n  A --> B',
    )
    expect(openFenceBody('```mermaid\n')).toBe('')
    expect(openFenceBody('```mermaid\nA --> B\n```\nThen prose.')).toBeNull()
    expect(openFenceBody('Plain prose')).toBeNull()
  })

  test('only the tail fence counts as growing: a closed diagram above it is drawn', () => {
    const text = '```mermaid\nA --> B\n```\n\nMore:\n```mermaid\nC --> D'
    const growing = openFenceBody(text)
    expect(isGrowingFence(growing, 'C --> D\n')).toBe(true)
    expect(isGrowingFence(growing, 'A --> B')).toBe(false)
    expect(isGrowingFence(null, 'A --> B')).toBe(false)
  })
})

describe('closePartialMarkdown', () => {
  test('plain complete text is returned verbatim', () => {
    const text = 'Hello **world**, see `code` and [a link](https://x.dev).'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  test('empty string is returned as-is', () => {
    expect(closePartialMarkdown('')).toBe('')
  })

  test('closes an unterminated code fence', () => {
    expect(closePartialMarkdown('intro\n```ts\nconst a = 1')).toBe('intro\n```ts\nconst a = 1\n```')
  })

  test('closes an unterminated tilde fence with the same marker', () => {
    expect(closePartialMarkdown('~~~~\ncode')).toBe('~~~~\ncode\n~~~~')
  })

  test('leaves a terminated fence untouched', () => {
    const text = '```ts\nconst a = 1\n```\nafter'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  test('skips inline fixes while inside a fence', () => {
    expect(closePartialMarkdown('```\na ** b')).toBe('```\na ** b\n```')
  })

  test('a shorter fence-like line does not close a longer opener', () => {
    expect(closePartialMarkdown('````\n```\ncode')).toBe('````\n```\ncode\n````')
  })

  test('closes a dangling bold span', () => {
    expect(closePartialMarkdown('this is **import')).toBe('this is **import**')
  })

  test('strips a bare trailing bold opener', () => {
    expect(closePartialMarkdown('this is **')).toBe('this is ')
  })

  test('closes a dangling strikethrough span', () => {
    expect(closePartialMarkdown('was ~~remov')).toBe('was ~~remov~~')
  })

  test('closes a dangling inline code span', () => {
    expect(closePartialMarkdown('call `fetchCata')).toBe('call `fetchCata`')
  })

  test('strips a bare trailing backtick opener', () => {
    expect(closePartialMarkdown('call `')).toBe('call ')
  })

  test('ignores ** inside inline code when balancing', () => {
    const text = 'the glob `**/*.ts` matches'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  test('closes a half-typed link', () => {
    expect(closePartialMarkdown('see [docs](https://exa')).toBe('see [docs](https://exa)')
  })

  test('hides a half-typed image', () => {
    expect(closePartialMarkdown('look ![diagram](https://exa')).toBe('look ')
    expect(closePartialMarkdown('look ![diag')).toBe('look ')
  })

  test('only the last paragraph is touched', () => {
    expect(closePartialMarkdown('a ** b\n\nnow **bol')).toBe('a ** b\n\nnow **bol**')
  })

  test('balanced earlier paragraphs stay byte-identical', () => {
    const head = '**done** and `ok`\n\n'
    expect(closePartialMarkdown(`${head}tail `)).toBe(`${head}tail `)
  })

  test('escaped backticks are not counted', () => {
    const text = 'a literal \\` backtick'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  // ── single-char emphasis (`*` / `_`) ──
  test('closes a dangling single-asterisk italic', () => {
    expect(closePartialMarkdown('this is *important')).toBe('this is *important*')
  })

  test('closes a dangling single-underscore italic', () => {
    expect(closePartialMarkdown('this is _important')).toBe('this is _important_')
  })

  test('strips a bare trailing single emphasis opener', () => {
    // Word-adjacent `*` is emphasis-capable; a bare trailing one is stripped
    // rather than closed (closing an empty pair would show two literal chars).
    expect(closePartialMarkdown('open intraword a*')).toBe('open intraword a')
  })

  test('leaves a whitespace-flanked lone asterisk alone', () => {
    // Not emphasis-capable (it never flashes), so don't strip a real literal.
    expect(closePartialMarkdown('a stray *')).toBe('a stray *')
  })

  test('leaves complete single emphasis untouched', () => {
    expect(closePartialMarkdown('an *italic* word')).toBe('an *italic* word')
    expect(closePartialMarkdown('an _italic_ word')).toBe('an _italic_ word')
  })

  test('does not touch a multiplication asterisk', () => {
    expect(closePartialMarkdown('compute 2 * 3 now')).toBe('compute 2 * 3 now')
  })

  test('does not touch a glob asterisk', () => {
    expect(closePartialMarkdown('match *.ts files')).toBe('match *.ts files')
  })

  test('holds back a block marker until the first word of what it opens', () => {
    // Alone on the last line, each is an empty item, heading or quote for a frame.
    for (const marker of ['* ', '-', '+', '##', '#', '1.', '12)', '3', '>', '> -', '> > ', '   -'])
      expect(closePartialMarkdown(`list:\n\n${marker}`)).toBe('list:\n\n')
    // A `-` or `=` under a paragraph would make it a heading until the item's text came.
    expect(closePartialMarkdown('Some paragraph text.\n-')).toBe('Some paragraph text.\n')
    expect(closePartialMarkdown('Some paragraph text.\n===')).toBe('Some paragraph text.\n')
    // The text above it is completed as any end of a text is.
    expect(closePartialMarkdown('Some **bold\n-')).toBe('Some **bold**\n')
    // Once a word follows the marker, it is drawn.
    expect(closePartialMarkdown('list:\n\n* a')).toBe('list:\n\n* a')
    expect(closePartialMarkdown('# T')).toBe('# T')
    expect(closePartialMarkdown('#hashtag')).toBe('#hashtag')
    expect(closePartialMarkdown('2024 was')).toBe('2024 was')
  })

  test('completes a construct where the text stops, before a line break or a space it ends in', () => {
    // After the line break, `**` would close nothing and show with the `**` it was to close.
    expect(closePartialMarkdown('A **long bold\n')).toBe('A **long bold**\n')
    expect(closePartialMarkdown('Some *it ')).toBe('Some *it* ')
    expect(closePartialMarkdown('Run `npm i\n')).toBe('Run `npm i`\n')
    expect(closePartialMarkdown('plain text\n')).toBe('plain text\n')
  })

  test('does not touch intraword underscores', () => {
    expect(closePartialMarkdown('the file_name var')).toBe('the file_name var')
    expect(closePartialMarkdown('python __init__ dunder')).toBe('python __init__ dunder')
    expect(closePartialMarkdown('a snake_case_var here')).toBe('a snake_case_var here')
  })

  test('ignores single emphasis chars inside inline code', () => {
    const text = 'see `a * b` and `x_y`'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  test('does not double-count ** when balancing single asterisks', () => {
    expect(closePartialMarkdown('**bold** then *it')).toBe('**bold** then *it*')
  })

  // ── a badge: an image in a link ──
  test('a badge is drawn as its image while its link is still being written', () => {
    const badge = 'Build: [![build](https://img.example/b.svg)](https://ci.example/run) ok'
    // No frame shows a bracket or a bare address, once the badge's `[!` has its second `[`.
    for (let end = 11; end <= badge.length; end += 1) {
      const healed = closePartialMarkdown(badge.slice(0, end))
      const drawn = healed
        .replace(/\[!\[build\]\(https:\/\/img\.example\/b\.svg\)\]\([^)]*\)/, '')
        .replace(/!\[build\]\(https:\/\/img\.example\/b\.svg\)/, '')
      expect(drawn, JSON.stringify(badge.slice(0, end))).not.toMatch(/[[\]()!]/)
    }
    expect(closePartialMarkdown('Build: [![build](https://img.example/b.svg)')).toBe(
      'Build: ![build](https://img.example/b.svg)',
    )
    expect(closePartialMarkdown('Build: [![build](https://img.example/b.svg)](https://ci')).toBe(
      'Build: [![build](https://img.example/b.svg)](https://ci)',
    )
    // An exclamation mark that ends a sentence is no image.
    expect(closePartialMarkdown('Done!')).toBe('Done!')
  })

  // ── partial table rows ──
  test('hides a half-typed trailing table row', () => {
    expect(closePartialMarkdown('| A | B |\n| --- | --- |\n| 1 |')).toBe('| A | B |\n| --- | --- |')
  })

  test('does not hide pipe-prefixed prose or a table header before its separator', () => {
    expect(closePartialMarkdown('| literal')).toBe('| literal')
    expect(closePartialMarkdown('intro\n\n| quoted prose')).toBe('intro\n\n| quoted prose')
    expect(closePartialMarkdown('| A | B |')).toBe('| A | B |')
    expect(closePartialMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| prose')).toBe(
      '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| prose',
    )
  })

  test('keeps a completed table row (ends in newline)', () => {
    const text = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    expect(closePartialMarkdown(text)).toBe(text)
  })

  test('holds back the row of dashes under a header until it is one', () => {
    // Drawn as it comes, `|--` prints under the header as text, and a token later both turn
    // into a table.
    for (const partial of ['|', '| -', '|--', '| --- | ', '|:-', '| :--: |', '---|', ':-- |'])
      expect(closePartialMarkdown(`| A | B |\n${partial}`), partial).toBe('| A | B |\n')
    expect(closePartialMarkdown('A | B\n--|')).toBe('A | B\n')
    // Ended by its newline, it makes the table: nothing is held.
    const table = '| A | B |\n| --- | --- |\n'
    expect(closePartialMarkdown(table)).toBe(table)
    expect(closePartialMarkdown('A | B\n--|-\n')).toBe('A | B\n--|-\n')
  })

  test('a line of dashes under prose, or prose after a pipe line, is left alone', () => {
    // Under a line with no pipe it is no table's: the bare marker rule holds `-` back, and text
    // with a pipe in it shows.
    expect(closePartialMarkdown('Text\n| -')).toBe('Text\n| -')
    expect(closePartialMarkdown('| A | B |\n| and so on')).toBe('| A | B |\n| and so on')
    expect(closePartialMarkdown('| A | B |\nnext line')).toBe('| A | B |\nnext line')
  })
})

describe('closePartialMarkdown footnotes and tasks', () => {
  test('hides a footnote reference still being typed', () => {
    expect(closePartialMarkdown('As shown[^')).toBe('As shown')
    expect(closePartialMarkdown('As shown[^1')).toBe('As shown')
    expect(closePartialMarkdown('As shown[^long-label')).toBe('As shown')
    expect(closePartialMarkdown('As shown[^1] here')).toBe('As shown[^1] here')
    // Code is code; a link's text is the link's.
    expect(closePartialMarkdown('Write `[^1')).toBe('Write `[^1`')
    expect(closePartialMarkdown('See [the do')).toBe('See [the do')
  })

  test('holds back a task box until the first word of its item', () => {
    for (const box of ['- [', '- [ ', '- [ ]', '- [x', '- [X]', '* [x] ', '1. [ ]'])
      expect(closePartialMarkdown(`Tasks:\n\n- [ ] one\n${box}`), box).toBe('Tasks:\n\n- [ ] one\n')
    expect(closePartialMarkdown('- [ ] one\n- [x] two')).toBe('- [ ] one\n- [x] two')
    // A link item is not a box: it shows from its first letter.
    expect(closePartialMarkdown('- [A')).toBe('- [A')
  })
})

describe('openFenceBody incremental scan', () => {
  test('matches a fresh scan while text grows token by token and after unrelated texts', () => {
    const reply =
      'Intro\n\n```ts\nconst a = 1\n```\n\nMore\n~~~~\ncode\n~~~ x\n~~~~\nend\n```\nlast'
    for (let i = 0; i <= reply.length; i += 1) {
      const text = reply.slice(0, i)
      openFenceBody('unrelated\n```\nbody') // reset the cached prefix between calls
      const fresh = openFenceBody(text)
      for (let j = 0; j <= i; j += 1) openFenceBody(reply.slice(0, j))
      expect(openFenceBody(text)).toBe(fresh)
    }
    expect(openFenceBody(reply)).toBe('last')
    expect(openFenceBody('```')).toBe('')
    expect(openFenceBody('```\n```')).toBeNull()
  })

  test('stays linear on a long streamed reply', () => {
    // Counts scanned lines instead of timing: wall-clock budgets flake on shared CI runners.
    const line = 'word '.repeat(20) + '\n'
    const lines = 2_000
    openFenceBody('reset')
    const before = fenceScanStats.lines
    let text = '```\n'
    for (let i = 0; i < lines; i += 1) {
      text += line
      closePartialMarkdown(text)
    }
    // A rescan from the start on every call would scan about lines² / 2.
    expect(fenceScanStats.lines - before).toBeLessThanOrEqual(lines + 1)
  })
})
