/**
 * User journeys in a terminal.
 *
 * 1. What a journey is drawn as: under each section, each task with its marks, its score and its
 *    actors on one row; a score that is not a number, and actors wrapped in their column.
 * 2. Narrow, each task on rows of its own.
 * 3. What does not read is not drawn.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { journeyDiagram } from './journey'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  journeyDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a journey is drawn as', () => {
  test('sections, and a task to a row with its marks, its score and who takes part', () => {
    const source = [
      'journey',
      '  title My day',
      '  section Work',
      '    Make tea: 5: Me',
      '    Meeting: 2: Me, Boss',
      '    Code: 3: Me, Cat',
      '  section Home',
      '    Rest: 4',
    ].join('\n')
    expect(draw(source, 50)).toEqual([
      'My day',
      '',
      'Work',
      '  Make tea  ●●●●● 5  Me',
      '  Meeting   ●●○○○ 2  Me, Boss',
      '  Code      ●●●○○ 3  Me, Cat',
      'Home',
      '  Rest      ●●●●○ 4',
    ])
  })

  test('a score that is not a number, and actors wrapped in their own column', () => {
    const source = 'journey\n  Make tea: 5: Me\n  Talk: x: Me, A long list of actors that wraps'
    expect(draw(source, 40)).toEqual([
      'Make tea  ●●●●● 5  Me',
      'Talk      ○○○○○ ?  Me, A long list of',
      '                   actors that wraps',
    ])
  })

  test('the marks say the score by their colour as well as by their count', () => {
    const rows = journeyDiagram.draw(diagramLines('journey\n  A: 5\n  B: 3\n  C: 1'), 40)!
    expect(rows.map((row) => row.find((part) => part.text.startsWith('●'))?.style.color)).toEqual([
      'green',
      'yellow',
      'red',
    ])
  })
})

describe('narrow, and what does not read', () => {
  test('each task on rows of its own, its actors after its score', () => {
    const source = [
      'journey',
      '  title My day',
      '  section Work',
      '    Make tea: 5: Me',
      '    Meeting: 2: Me, Boss',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      'My day',
      'Work',
      '  Make tea',
      '    ●●●●● 5 · Me',
      '  Meeting',
      '    ●●○○○ 2 · Me,',
      '      Boss',
    ])
  })

  test('no task, or another header: not drawn', () => {
    expect(draw('journey\n  title Nothing\n  section Empty')).toBeUndefined()
    expect(draw('gantt\n  Make tea: 5: Me')).toBeUndefined()
    expect(journeyDiagram.matches('journey')).toBe(true)
  })
})
