/**
 * Quadrant charts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row: the box, its quadrants' names in their corners,
 *    each point with its name, and the axes' ends round it.
 * 2. Names that find no room are listed under the box; a point off the chart is drawn at its edge.
 * 3. Too narrow for a box, the chart is a list by quadrant; what is not one is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { quadrantDiagram } from './quadrant'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  quadrantDiagram.draw(diagramLines(source), columns)?.map(lineText)

const EFFORT = [
  'quadrantChart',
  '  title Effort',
  '  x-axis Low --> High',
  '  y-axis Small --> Big',
  '  quadrant-1 Plan',
  '  quadrant-2 Do',
  '  quadrant-3 Skip',
  '  quadrant-4 Delegate',
  '  Docs: [0.2, 0.8]',
  '  Tests:::hot: [0.7, 0.3] radius: 10, color: #ff3300',
].join('\n')

describe('what a chart is drawn as', () => {
  test('a box split in four, the names in their corners, each point beside its name', () => {
    expect(draw(EFFORT, 30)).toEqual([
      'Effort',
      '↑ Big',
      '┌─────────────┬─────────────┐',
      '│Do           │         Plan│',
      '│     ● Docs  │             │',
      '│             │             │',
      '├─────────────┼─────────────┤',
      '│             │    ● Tests  │',
      '│             │             │',
      '│Skip         │     Delegate│',
      '└─────────────┴─────────────┘',
      '↓ Small',
      '← Low                  High →',
    ])
  })

  test('names crowded round one place: those that find no room are listed under the box', () => {
    const source = [
      'quadrantChart',
      '  quadrant-1 A',
      ...['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map(
        (name) => `  ${name}: [0.9, 0.9]`,
      ),
      '  Far: [1.5, -1]',
    ].join('\n')
    expect(draw(source, 30)).toEqual([
      '┌─────────────┬─────────────┐',
      '│             │      Two   A│',
      '│             │     One ●   │',
      '│             │    Three Six│',
      '├─────────────┼─────────────┤',
      '│             │             │',
      '│             │             │',
      '│             │        Far ●│',
      '└─────────────┴─────────────┘',
      '● Four (0.9, 0.9)',
      '● Five (0.9, 0.9)',
      '● Seven (0.9, 0.9)',
    ])
  })
})

describe('what does not fit, and what is not a chart', () => {
  test('at 20 columns: the axes, then each quadrant with the points in it', () => {
    expect(draw(EFFORT, 20)).toEqual([
      'Effort',
      'x: Low → High',
      'y: Small → Big',
      'Plan (top right)',
      'Do (top left)',
      '  ● Docs (0.2, 0.8)',
      'Skip (bottom left)',
      'Delegate (bottom',
      '  right)',
      '  ● Tests (0.7, 0.3)',
    ])
  })

  test('nothing that reads, or another header, is null', () => {
    expect(draw('quadrantChart\n  Docs: [high, 0.8]\n  Tests [0.1, 0.2]')).toBeUndefined()
    expect(draw('quadrantChart\n  Docs: [0.1, 0.2, 0.3]')).toBeUndefined()
    expect(draw('quadrant\n  Docs: [0.2, 0.8]')).toBeUndefined()
    expect(quadrantDiagram.matches('quadrantChart')).toBe(true)
    expect(quadrantDiagram.matches('quadrantChart2')).toBe(false)
  })
})
