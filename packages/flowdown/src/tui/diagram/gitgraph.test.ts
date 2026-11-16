/**
 * Git graphs in a terminal.
 *
 * 1. What a small graph is drawn as, row for row: branches leaving their parent, merges coming
 *    back, tags, messages, the types of commit, `order`, and a cherry-pick's dotted line; down,
 *    up (`BT:`) and across (`LR:`).
 * 2. When the names do not fit on one row they stand down a stair; a graph too long to run across
 *    is drawn down; narrower still, the graph is a list.
 * 3. What does not read is passed over, and a graph of nothing is not drawn.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { gitGraphDiagram } from './gitgraph'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  gitGraphDiagram.draw(diagramLines(source), columns)?.map(lineText)

const MERGED = [
  'gitGraph',
  '  commit id: "init"',
  '  branch dev',
  '  commit id: "feat" tag: "v1"',
  '  checkout main',
  '  commit',
  '  merge dev',
].join('\n')

describe('what a graph is drawn as', () => {
  test('a branch leaves its parent’s rail, and its merge comes back across', () => {
    expect(draw(MERGED, 40)).toEqual([
      'main  dev',
      '',
      '○─────╮  init',
      '│     ○  feat (v1)',
      '○     │',
      '●─────╯  merge dev',
    ])
  })

  test('the types of commit, a message, `order` for the columns, and a cherry-pick', () => {
    const source = [
      'gitGraph',
      '  commit id: "a" type: HIGHLIGHT',
      '  commit id: "b" type: REVERSE msg: "undo it"',
      '  branch late order: 2',
      '  commit id: "x"',
      '  checkout main',
      '  branch early order: 1',
      '  switch early',
      '  commit id: "fix"',
      '  checkout main',
      '  cherry-pick id: "fix"',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      'main  early  late',
      '',
      '■               a',
      '⊗─────┬──────╮  b undo it',
      '│     │      ○  x',
      '│     ○         fix',
      '○┄┄┄┄┄╯         cherry-pick fix',
    ])
  })

  test('each branch in a colour of its own, its rails and its commits alike', () => {
    const rows = gitGraphDiagram.draw(diagramLines(MERGED), 40)!
    const colour = (row: number, text: string) =>
      rows[row]!.find((part) => part.text.includes(text))?.style.color
    expect([colour(0, 'main'), colour(0, 'dev'), colour(3, '○'), colour(5, '╯')]).toEqual([
      'cyan',
      'magenta',
      'magenta',
      'magenta',
    ])
  })
})

describe('which way it runs', () => {
  test('up: the first commit lowest, the names under their rails', () => {
    expect(draw(MERGED.replace('gitGraph', 'gitGraph BT:'), 40)).toEqual([
      '●─────╮  merge dev',
      '○     │',
      '│     ○  feat (v1)',
      '○─────╯  init',
      '',
      'main  dev',
    ])
  })

  test('across: a rail a row, its name at the left, each commit’s words under it', () => {
    expect(draw(MERGED.replace('gitGraph', 'gitGraph LR:'), 40)).toEqual([
      'main ○────┬─────────────○─┬─●',
      '     init │               │ merge dev',
      '          │               │',
      'dev       ╰─○─────────────╯',
      '            feat (v1)',
    ])
  })

  test('across, a cherry-pick comes dotted from the commit it copies', () => {
    const source = [
      'gitGraph LR:',
      '  commit id: "a"',
      '  branch fix',
      '  commit id: "b"',
      '  checkout main',
      '  cherry-pick id: "b"',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      'main ○─┬───┬─○',
      '     a │   ┆ cherry-pick b',
      '       │   ┆',
      'fix    ╰─○┄╯',
      '         b',
    ])
  })

  test('`TB:` is down, as with no direction', () => {
    expect(draw(MERGED.replace('gitGraph', 'gitGraph TB:'), 40)).toEqual(draw(MERGED, 40))
  })

  test('across, too long for the columns: its words wrapped narrower, then drawn down', () => {
    const across = MERGED.replace('gitGraph', 'gitGraph LR:')
    expect(draw(across, 32)).toEqual([
      'main ○────┬────────○─┬─●',
      '     init │          │ merge',
      '          │          │ dev',
      '          │          │',
      'dev       ╰─○────────╯',
      '            feat',
      '            (v1)',
    ])
    expect(draw(across, 22)).toEqual(draw(MERGED, 22))
    expect(draw(across, 12)).toEqual(draw(MERGED, 12))
  })
})

describe('what does not fit', () => {
  test('names too wide for one row stand down a stair, the rails closer', () => {
    const source = [
      'gitGraph',
      '  commit id: "init"',
      '  branch develop',
      '  commit id: "feat"',
      '  branch feature',
      '  commit id: "ui"',
      '  checkout main',
      '  merge feature',
    ].join('\n')
    expect(draw(source, 22)).toEqual([
      'main',
      '   develop',
      '      feature',
      '',
      '○──╮     init',
      '│  ○──╮  feat',
      '│     ○  ui',
      '●─────╯  merge feature',
    ])
  })

  test('narrower still, a list: the branches, then each branch and commit in turn', () => {
    expect(draw(MERGED.replace('  commit\n', ''), 12)).toEqual([
      'main, dev',
      'main ○ init',
      'branch dev',
      '  from main',
      'dev ○ feat',
      '  (v1)',
      'main ● merge',
      '  dev',
    ])
  })
})

describe('what does not read', () => {
  test('a checkout or merge of no branch, a branch made twice, a cherry-pick of nothing', () => {
    const source = [
      'gitGraph LR:',
      '  commit',
      '  checkout nowhere',
      '  merge nowhere',
      '  merge main',
      '  branch main',
      '  cherry-pick id: "missing"',
      '  commit',
    ].join('\n')
    expect(draw(source, 40)).toEqual(['main ○───○'])
  })

  test('a graph of nothing, or another header', () => {
    expect(draw('gitGraph')).toBeUndefined()
    expect(draw('gitGraph\n  checkout main')).toBeUndefined()
    expect(draw('gitgraph\n  commit')).toBeUndefined()
    expect(gitGraphDiagram.matches('gitGraph TB:')).toBe(true)
  })
})
