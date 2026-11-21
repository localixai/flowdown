/**
 * XY charts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row: bars to the eighth, lines, bars below zero,
 *    several series with their key, a numeric x axis, and a chart turned on its side.
 * 2. Categories too long for their columns are numbered; too narrow for any picture, the values
 *    are a table, and the table wrapped rows.
 * 3. What is not a chart is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { xychartDiagram } from './xychart'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  xychartDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a chart is drawn as', () => {
  test('bars as columns, their tops to the eighth, against a y axis with its range and title', () => {
    const source = [
      'xychart-beta',
      '  title "Sales"',
      '  x-axis [Q1, Q2, Q3, Q4]',
      '  y-axis "Units" 0 --> 8',
      '  bar [2, 5, 8, 3.5]',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      'Sales',
      'Units',
      '8 ┤            █████',
      '  │            █████',
      '6 ┤            █████',
      '  │      ▂▂▂▂▂ █████',
      '  │      █████ █████',
      '4 ┤      █████ █████ ▃▃▃▃▃',
      '  │      █████ █████ █████',
      '2 ┤▄▄▄▄▄ █████ █████ █████',
      '  │█████ █████ █████ █████',
      '0 ┤█████ █████ █████ █████',
      '  └────────────────────────',
      '      Q1    Q2    Q3    Q4',
    ])
  })

  test('a line, its values marked and joined across the cells between', () => {
    expect(draw('xychart-beta\n  x-axis [a, b, c, d]\n  line [1, 4, 2, 4]', 30)).toEqual([
      '4 ┤         ●╲         ╱●',
      '  │        ╱ ╲╲       ╱╱',
      '3 ┤       ╱╱  ╲╲     ╱╱',
      '  │      ╱╱    ╲─╲ ╱─╱',
      '  │     ╱╱       ╲ ╱',
      '2 ┤    ╱╱         ●',
      '  │    ╱',
      '1 ┤   ●',
      '  │',
      '0 ┤',
      '  └────────────────────────',
      '      a     b     c     d',
    ])
  })

  test('two bar series side by side in their own fills, one below zero, one value not a number', () => {
    const source =
      'xychart-beta\n  x-axis [a, b, c]\n  bar "Plan" [4, -2, 0]\n  bar "Done" [3, 1, x]'
    expect(draw(source, 30)).toEqual([
      ' 4 ┤ ███',
      '   │ ███▃▃▃',
      '   │ ███▓▓▓',
      ' 2 ┤ ███▓▓▓',
      '   │ ███▓▓▓',
      '   │ ███▓▓▓     ▓▓▓',
      ' 0 ┤ ███▓▓▓     ▓▓▓  ▃▃▃',
      '   │         ███',
      '   │         ███',
      '-2 ┤         ███',
      '   └────────────────────────',
      '        a       b       c',
      '█ Plan ▓ Done',
    ])
  })

  test('a numeric x axis names each value by where it falls in the range, its title under it', () => {
    expect(draw('xychart-beta\n  x-axis "Hour" 0 --> 30\n  line [1, 2, 3, 4]', 40)).toEqual([
      '4 ┤                          ╱─●',
      '  │                      ╱───╱',
      '3 ┤                  ╱─●─╱',
      '  │               ╱──╱',
      '  │             ──╱',
      '2 ┤         ╱──●',
      '  │      ╱──╱',
      '1 ┤    ●─╱',
      '  │',
      '0 ┤',
      '  └────────────────────────────────',
      '       0       10      20      30',
      '                 Hour',
    ])
  })

  test('horizontal: a row a value, each bar along it', () => {
    const source =
      'xychart-beta horizontal\n  x-axis [north, south]\n  y-axis "Sales" 0 --> 10\n  bar [5, 10]'
    expect(draw(source, 40)).toEqual([
      '       Sales',
      'north │███████████████                5',
      'south │██████████████████████████████ 10',
    ])
  })
})

describe('what does not fit', () => {
  test('categories too long for their columns are numbered, and named in a key under the axis', () => {
    const rows = draw('xychart-beta\n  x-axis [January, February, March]\n  bar [1, 2, 3]', 30)
    expect(rows!.slice(-2)).toEqual(['      1     2     3', '1 January 2 February 3 March'])
  })

  test('at 20 columns, narrower than a table of the values, a row a category', () => {
    const source = [
      'xychart-beta',
      '  title "Sales"',
      '  x-axis "Month" [January, February, March, April, May, June, July]',
      '  bar "Plan" [4000, 5000, 1e15, 0, -3, 7, 8]',
      '  line "Done" [3500, x]',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      'Sales',
      'x: Month',
      '█ Plan',
      '● Done',
      'January: █ 4000 ●',
      '  3500',
      'February: █ 5000 ● -',
      'March: █ 1.00e15 ● -',
      'April: █ 0 ● -',
      'May: █ -3 ● -',
      'June: █ 7 ● -',
      'July: █ 8 ● -',
    ])
  })

  test('a chart on its side with a value below zero is a table: a bar from the left would lie', () => {
    expect(draw('xychart-beta horizontal\n  x-axis [a, b]\n  bar [3, -1]', 40)).toEqual([
      '   █ bar 1',
      'a        3',
      'b       -1',
    ])
  })

  test('no series, no value, or another header, is null', () => {
    expect(draw('xychart-beta\n  title "Empty"\n  x-axis [a, b]')).toBeUndefined()
    expect(draw('xychart-beta\n  x-axis [a, b]\n  bar oops')).toBeUndefined()
    expect(draw('xychart-beta\n  bar []')).toBeUndefined()
    expect(draw('xychart-beta sideways\n  bar [1]')).toBeUndefined()
    expect(draw('xychart-alpha\n  bar [1]')).toBeUndefined()
    expect(xychartDiagram.matches('xychart-beta horizontal')).toBe(true)
    expect(xychartDiagram.matches('xychartbeta')).toBe(false)
  })
})
