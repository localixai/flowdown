/**
 * Radar charts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row: a block an axis, a bar a curve, the range over
 *    them; with one curve, a row an axis.
 * 2. What is read: values in order or by their axis, `max` and `min`, values not numbers.
 * 3. Too narrow for bars, the values are a list; what is not a radar is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { radarDiagram } from './radar'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  radarDiagram.draw(diagramLines(source), columns)?.map(lineText)

const SKILLS = [
  'radar-beta',
  '  title Skills',
  '  axis a["Speed"], b["Power"]',
  '  curve x["Ann"]{4, 2}',
  '  curve y["Ben"]{b: 4, a: 1}',
  '  max 4',
].join('\n')

describe('what a radar is drawn as', () => {
  test('a block an axis, each curve a bar in its own fill, keyed values matched to their axes', () => {
    expect(draw(SKILLS, 40)).toEqual([
      'Skills',
      '        0 to 4',
      'Speed',
      '  █ Ann ██████████████████████████████ 4',
      '  ▓ Ben ▓▓▓▓▓▓▓▌                       1',
      'Power',
      '  █ Ann ███████████████                2',
      '  ▓ Ben ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 4',
    ])
  })

  test('one curve is a row an axis; a value below the range, or not a number, has no bar', () => {
    const source =
      'radar-beta\n  axis s["Speed"], p["Power"], r\n  curve c{-1, 2, oops}\n  min 0\n  max 2'
    expect(draw(source, 30)).toEqual([
      '      █ c  0 to 2',
      'Speed                       -1',
      'Power █████████████████████  2',
      'r                            -',
    ])
  })
})

describe('what does not fit, and what is not a radar', () => {
  test('at 20 columns each axis and its values as a list', () => {
    const source = SKILLS.replace('Ann', 'Annabelle Lee').replace('Ben', 'Benjamin Hall')
    expect(draw(source, 20)).toEqual([
      'Skills',
      'Speed',
      '  █ Annabelle Lee 4',
      '  ▓ Benjamin Hall 1',
      'Power',
      '  █ Annabelle Lee 2',
      '  ▓ Benjamin Hall 4',
    ])
  })

  test('no axis, no curve, or another header, is null', () => {
    expect(draw('radar-beta\n  curve x{1, 2}')).toBeUndefined()
    expect(draw('radar-beta\n  axis a, b\n  curve x 1, 2')).toBeUndefined()
    expect(draw('radar-alpha\n  axis a\n  curve x{1}')).toBeUndefined()
    expect(radarDiagram.matches('radar-beta')).toBe(true)
  })
})
