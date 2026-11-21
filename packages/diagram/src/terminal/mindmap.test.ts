/**
 * Mindmaps in a terminal.
 *
 * 1. What a mindmap is drawn as: the root at the top, its branches as a tree, a long label
 *    wrapped beside its rail, icons and classes passed over.
 * 2. Every shape marked on its text, compactly; a deep tree drawn closer, then with plain indents.
 * 3. Nesting by indentation, lines without it, and what does not read.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { width } from '../width'
import { indentedLines } from './kit'
import { mindmapDiagram } from './mindmap'

const draw = (source: string, columns = 80): string[] | undefined =>
  mindmapDiagram.draw(indentedLines(source), columns)?.map(lineText)

const SHAPES = [
  'mindmap',
  '  Root',
  '    A[square]',
  '      B(round)',
  '        C((circle))',
  '          D))bang((',
  '            E{{hex}}',
  '              F)cloud(:::urgent',
].join('\n')

describe('what a mindmap is drawn as', () => {
  test('the root over its branches, an icon passed over', () => {
    const source = [
      'mindmap',
      '  root((Plan))',
      '    Goals',
      '      Speed',
      '      Size',
      '    Risks',
      '      ::icon(fa fa-bolt)',
      '      Scope',
      '    Team',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      '◯ Plan',
      '├─ Goals',
      '│  ├─ Speed',
      '│  └─ Size',
      '├─ Risks',
      '│  └─ Scope',
      '└─ Team',
    ])
  })

  test('a long label wrapped beside the rail of the branch it is on', () => {
    const source = [
      'mindmap',
      '  root((Plan))',
      '    Goals',
      '      Fast and small enough to ship',
      '      Size',
      '    Team',
    ].join('\n')
    expect(draw(source, 24)).toEqual([
      '◯ Plan',
      '├─ Goals',
      '│  ├─ Fast and small',
      '│  │  enough to ship',
      '│  └─ Size',
      '└─ Team',
    ])
  })

  test('each main branch in a colour of its own, down to its last leaf', () => {
    const rows = mindmapDiagram.draw(indentedLines('mindmap\n  R\n    A\n      a\n    B'), 40)!
    expect(rows.slice(1).map((row) => row[0]!.style.color)).toEqual(['cyan', 'cyan', 'magenta'])
  })
})

describe('shapes and depth', () => {
  test('every shape marked, a bracket kept or a glyph before it, a class after it passed over', () => {
    expect(draw(SHAPES, 40)).toEqual([
      'Root',
      '└─ [square]',
      '   └─ (round)',
      '      └─ ◯ circle',
      '         └─ ✸ bang',
      '            └─ ⬡ hex',
      '               └─ ◌ cloud',
    ])
  })

  test('each mark one column wide, and a label of two rows marked around both', () => {
    for (const glyph of ['◯', '✸', '⬡', '◌']) expect(width(glyph)).toBe(1)
    expect(draw('mindmap\n  R\n    A[one<br>two]\n    B((three<br>four))', 40)).toEqual([
      'R',
      '├─ [one',
      '│  two]',
      '└─ ◯ three',
      '   four',
    ])
  })

  test('deep for the columns, closer rails; deeper still, plain indents', () => {
    expect(draw(SHAPES, 20)).toEqual([
      'Root',
      '└ [square]',
      '  └ (round)',
      '    └ ◯ circle',
      '      └ ✸ bang',
      '        └ ⬡ hex',
      '          └ ◌ cloud',
    ])
    expect(draw(SHAPES, 12)).toEqual([
      'Root',
      '• [square]',
      '  • (round)',
      '    • ◯',
      '      circle',
      '    • ✸ bang',
      '    • ⬡ hex',
      '    • ◌',
      '      cloud',
    ])
  })
})

describe('what is read', () => {
  test('a node no deeper than the root, and lines with no indentation: branches of the root', () => {
    expect(draw('mindmap\n  Root\n    A\n  B', 40)).toEqual(['Root', '├─ A', '└─ B'])
    expect(draw('mindmap\nRoot\nA\nB', 40)).toEqual(['Root', '├─ A', '└─ B'])
  })

  test('nothing to draw, or another header', () => {
    expect(draw('mindmap')).toBeUndefined()
    expect(draw('mindmap\n  ::icon(fa fa-book)')).toBeUndefined()
    expect(draw('kanban\n  Root')).toBeUndefined()
    expect(mindmapDiagram.matches('mindmap')).toBe(true)
  })
})
