/**
 * Pie charts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row: the stacked whole, a bar a slice, `showData`.
 * 2. What is read: titles on the header or their own line, values at zero, below it and not
 *    numbers at all.
 * 3. Too narrow for the bars, the slices are a list; what is not a pie is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { pieDiagram } from './pie'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  pieDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a pie is drawn as', () => {
  test('the whole stacked over a bar a slice, each with its share and, with showData, its value', () => {
    const source = 'pie showData\n  title Pets\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15'
    expect(draw(source, 50)).toEqual([
      'Pets',
      '     ██████████████████████████▓▓▓▓▓▓▒',
      'Dogs ██████████████████████████▎        79.4%  386',
      'Cats ▓▓▓▓▓▊                             17.5%   85',
      'Rats ▒                                   3.1%   15',
    ])
  })

  test('a value at zero or below it has no share; one that is not a number is not a slice', () => {
    const source = 'pie\n  "Yes" : 3\n  "No" : 1\n  "Lost" : -2\n  "Void" : 0\n  "Bad" : many'
    expect(draw(source, 40)).toEqual([
      '     █████████████████████▓▓▓▓▓▓▓',
      'Yes  █████████████████████         75.0%',
      'No   ▓▓▓▓▓▓▓                       25.0%',
      'Lost                                0.0%',
      'Void                                0.0%',
    ])
  })

  test('a title on the header, labels unquoted or in single quotes, values huge', () => {
    expect(draw("pie title Big\n  'a' : 1e300\n  b : 3e300", 30)).toEqual([
      'Big',
      '  █████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
      'a █████▎                 25.0%',
      'b ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▊       75.0%',
    ])
  })
})

describe('what does not fit, and what is not a pie', () => {
  test('at 20 columns the slices are a list, the stacked whole under the title', () => {
    const source =
      'pie title Where the time goes\n  "Meetings with everyone" : 30\n  "Writing code" : 60\n  "Coffee" : 10'
    expect(draw(source, 20)).toEqual([
      'Where the time goes',
      '██████▓▓▓▓▓▓▓▓▓▓▓▓▒▒',
      '█ Meetings with',
      '  everyone 30.0%',
      '▓ Writing code 60.0%',
      '▒ Coffee 10.0%',
    ])
  })

  test('no slice that reads, or another header, is null', () => {
    expect(draw('pie\n  title Nothing')).toBeUndefined()
    expect(draw('pie\n  "a" : lots\n  "b" 3')).toBeUndefined()
    expect(draw('pies\n  "a" : 1')).toBeUndefined()
    expect(draw('"a" : 1')).toBeUndefined()
    expect(pieDiagram.matches('pie showData')).toBe(true)
    expect(pieDiagram.matches('piechart')).toBe(false)
  })
})
