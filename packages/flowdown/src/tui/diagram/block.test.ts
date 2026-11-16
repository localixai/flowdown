/**
 * Block diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: a grid with a span, a nested block, arrows
 *    straight between neighbours with their labels, an arrow down past an empty cell, block
 *    arrows, and an arrow that has no room written under the picture.
 * 2. What is not drawn: a diagram too wide is written as an outline; another kind, or text that
 *    is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { blockDiagram } from './block'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  blockDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('blocks in columns, one spanning two', () => {
    expect(draw('block-beta\n  columns 3\n  a b c\n  d:2 e')).toEqual([
      '┌───┐   ┌───┐   ┌───┐',
      '│ a │   │ b │   │ c │',
      '└───┘   └───┘   └───┘',
      '',
      '',
      '┌───────────┐   ┌───┐',
      '│     d     │   │ e │',
      '└───────────┘   └───┘',
    ])
  })

  test('a nested block, arrows between neighbours, one across grids written under', () => {
    const source = [
      'block-beta',
      '  columns 2',
      '  a["Load"] b("Parse")',
      '  block:inner:2',
      '    columns 2',
      '    c d',
      '  end',
      '  a -- "then" --> b',
      '  c --> d',
      '  a --> c',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌──────┐       ╭───────╮',
      '│ Load ├─then─▶│ Parse │',
      '└──────┘       ╰───────╯',
      '',
      '',
      '┌──────────────────────┐',
      '│ ┌───────┐   ┌──────┐ │',
      '│ │   c   ├──▶│  d   │ │',
      '│ └───────┘   └──────┘ │',
      '└──────────────────────┘',
      'Load ──▶ c',
    ])
  })

  test('an arrow down past an empty cell, its label on it', () => {
    const source = [
      'block-beta',
      '  columns 1',
      '  top',
      '  space',
      '  bottom[("Store")]',
      '  top -- "saves" --> bottom',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───────┐',
      '│  top  │',
      '└───┬───┘',
      '    │',
      '  saves',
      '    │',
      '    │',
      '    │',
      '    │',
      '    ▼',
      '╭───────╮',
      '├───────┤',
      '│ Store │',
      '╰───────╯',
    ])
  })

  test('block arrows, and two arrows between one pair: the second is written under', () => {
    expect(draw('block-beta\n  go<["Next"]>(right) stop<["Back"]>(left)')).toEqual([
      '┌────────┐   ┌────────┐',
      '│ Next ▶ │   │ Back ◀ │',
      '└────────┘   └────────┘',
    ])
    expect(draw('block-beta\n  a b\n  b --> a\n  a --> b')).toEqual([
      '┌───┐   ┌───┐',
      '│ a │◀──┤ b │',
      '└───┘   └───┘',
      'a ──▶ b',
    ])
  })
})

describe('what is not drawn', () => {
  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'block-beta',
      '  columns 3',
      '  Frontend Backend Database',
      '  block:jobs',
      '    Worker',
      '  end',
      '  Frontend --> Backend',
      '  Backend -- "SQL" --> Database',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      '• Frontend',
      '• Backend',
      '• Database',
      'jobs',
      '  • Worker',
      'Frontend ──▶ Backend',
      'Backend ──SQL──▶',
      '  Database',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    expect(blockDiagram.matches('block-beta')).toBe(true)
    expect(blockDiagram.matches('blocks')).toBe(false)
    expect(draw('architecture-beta\n  service a[A]')).toBeUndefined()
    expect(draw('block-beta')).toBeUndefined()
    expect(draw('block-beta\n  columns 3\n  space space:2\n  --> -->')).toBeUndefined()
    expect(draw('block-beta\n  a b', 1)).toBeUndefined()
  })
})
