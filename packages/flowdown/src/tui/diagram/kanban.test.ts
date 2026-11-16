/**
 * Kanban boards in a terminal.
 *
 * 1. What a board is drawn as: its columns side by side, each card a box with its metadata.
 * 2. Narrow, the columns stacked; narrower than a word, a list.
 * 3. Lines with no indentation, metadata over two lines, and what does not read.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { kanbanDiagram } from './kanban'
import { indentedLines } from './kit'

const draw = (source: string, columns = 80): string[] | undefined =>
  kanbanDiagram.draw(indentedLines(source), columns)?.map(lineText)

const BOARD = [
  'kanban',
  '  Todo',
  '    [Write docs]',
  '    b[Fix bug]@{ assigned: ann, ticket: FD-12, priority: High }',
  '  doing[In progress]',
  '    c[Ship it]',
  '  Done',
].join('\n')

describe('what a board is drawn as', () => {
  test('the columns side by side, each card a box, an empty column its title alone', () => {
    expect(draw(BOARD, 60)).toEqual([
      'Todo (2)            In progress (1)     Done (0)',
      '╭─────────────────╮ ╭─────────────────╮',
      '│ Write docs      │ │ Ship it         │',
      '╰─────────────────╯ ╰─────────────────╯',
      '╭─────────────────╮',
      '│ Fix bug         │',
      '│ @ann FD-12 High │',
      '╰─────────────────╯',
    ])
  })

  test('a high priority in red, who it is assigned to in cyan', () => {
    const rows = kanbanDiagram.draw(indentedLines(BOARD), 60)!
    const colour = (text: string) =>
      rows.flat().find((part) => part.text.includes(text))?.style.color
    expect([colour('High'), colour('@ann')]).toEqual(['red', 'cyan'])
  })
})

describe('narrow', () => {
  test('the columns stacked, one under another', () => {
    expect(draw(BOARD, 30)).toEqual([
      'Todo (2)',
      '╭─────────────────╮',
      '│ Write docs      │',
      '╰─────────────────╯',
      '╭─────────────────╮',
      '│ Fix bug         │',
      '│ @ann FD-12 High │',
      '╰─────────────────╯',
      '',
      'In progress (1)',
      '╭─────────────────╮',
      '│ Ship it         │',
      '╰─────────────────╯',
      '',
      'Done (0)',
    ])
  })

  test('a word wider than a card: each card a line of a list', () => {
    expect(draw('kanban\n  Todo\n    a[Documentation]@{ ticket: X-1 }\n  Done', 12)).toEqual([
      'Todo (1)',
      '  • Document',
      '    ation',
      '    X-1',
      'Done (0)',
    ])
  })
})

describe('what is read', () => {
  test('metadata over two lines, a quoted value with a space', () => {
    const source = [
      'kanban',
      '  Todo',
      '    b[Fix bug]@{ assigned: ann,',
      '      priority: "Very High" }',
      '  Done',
    ].join('\n')
    expect(draw(source, 12)).toEqual([
      'Todo (1)',
      '╭──────────╮',
      '│ Fix bug  │',
      '│ @ann     │',
      '│ Very     │',
      '│ High     │',
      '╰──────────╯',
      '',
      'Done (0)',
    ])
  })

  test('with no indentation, a line with metadata is a card and any other a column', () => {
    expect(draw('kanban\nTodo\na[Card]@{ assigned: me }\nDone', 40)).toEqual([
      'Todo (1)     Done (0)',
      '╭──────────╮',
      '│ Card     │',
      '│ @me      │',
      '╰──────────╯',
    ])
  })

  test('a board of nothing, or another header', () => {
    expect(draw('kanban')).toBeUndefined()
    expect(draw('mindmap\n  Todo\n    [a]')).toBeUndefined()
    expect(kanbanDiagram.matches('kanban')).toBe(true)
  })
})
