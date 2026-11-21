/**
 * Treemaps in a terminal.
 *
 * 1. What a small treemap is drawn as, row for row: each node under its parent with its value and
 *    a bar of its share of that parent, sections summed.
 * 2. What is read: nesting by indentation, or flat when the indentation is gone; classes passed
 *    over; values at zero, below it, and not numbers.
 * 3. Too narrow for bars, the tree is a wrapped list; what is not a treemap is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { treemapDiagram, treemapLines } from './treemap'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  treemapDiagram.draw(treemapLines(source), columns)?.map(lineText)

const BUDGET = [
  'treemap-beta',
  '  title Budget',
  '  "Food"',
  '    "Fruit": 30',
  '    "Bread": 10:::cheap',
  '  "Rent": 60',
].join('\n')

describe('what a treemap is drawn as', () => {
  test('each node under its parent, its value, and a bar of its share of the parent', () => {
    expect(draw(BUDGET, 50)).toEqual([
      'Budget',
      'Food     40 █████████▋                40.0%',
      '  Fruit  30 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        75.0%',
      '  Bread  10 ▓▓▓▓▓▓                    25.0%',
      'Rent     60 ██████████████▍           60.0%',
    ])
  })

  test('nested sections are summed from the deepest out; a value below zero has no share', () => {
    const source = [
      'treemap-beta',
      '"A"',
      '  "B"',
      '    "C": 3',
      '    "D": 1',
      '  "E": -2',
      '  "F": many',
      '"G": 0',
      '%% a comment',
      'classDef cheap fill:#fff',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      'A       2 ███████████████████████ 100.0%',
      '  B     4 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100.0%',
      '    C   3 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▎       75.0%',
      '    D   1 ▒▒▒▒▒▊                   25.0%',
      '  E    -2                           0.0%',
      'G       0                           0.0%',
    ])
  })

  test('lines trimmed of their indentation are read flat: a section holds the leaves after it', () => {
    expect(treemapDiagram.draw(diagramLines(BUDGET), 50)?.map(lineText)).toEqual([
      'Budget',
      'Food     100 ████████████████████████ 100.0%',
      '  Fruit   30 ▓▓▓▓▓▓▓▎                  30.0%',
      '  Bread   10 ▓▓▍                       10.0%',
      '  Rent    60 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▍           60.0%',
    ])
  })
})

describe('what does not fit, and what is not a treemap', () => {
  test('at 20 columns, each node indented under its parent, wrapped', () => {
    expect(draw(BUDGET, 20)).toEqual([
      'Budget',
      'Food 40 40.0%',
      '  Fruit 30 75.0%',
      '  Bread 10 25.0%',
      'Rent 60 60.0%',
    ])
  })

  test('no node that reads, or another header, is null', () => {
    expect(draw('treemap-beta\n  "Open\n  "A": lots')).toBeUndefined()
    expect(draw('treemap\n  "A": 1')).not.toBeUndefined()
    expect(draw('treemaps\n  "A": 1')).toBeUndefined()
    expect(treemapDiagram.matches('treemap-beta')).toBe(true)
  })
})
