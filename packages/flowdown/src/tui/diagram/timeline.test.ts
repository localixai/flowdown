/**
 * Timelines in a terminal.
 *
 * 1. What a timeline is drawn as across: the periods on a rail, their events under them, the
 *    sections as rules over their periods, an event wrapped in its column.
 * 2. Narrow, the rail turns down the left edge; narrower still, it is a list.
 * 3. What does not read is not drawn.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { diagramLines } from './text'
import { timelineDiagram } from './timeline'

const draw = (source: string, columns = 80): string[] | undefined =>
  timelineDiagram.draw(diagramLines(source), columns)?.map(lineText)

const WEB = [
  'timeline',
  '  title Web',
  '  1991 : WWW',
  '  1995 : JavaScript : PHP',
  '  1998 : Google',
].join('\n')

const SECTIONS = [
  'timeline',
  '  section Early',
  '    2002 : LinkedIn',
  '    2004 : Facebook',
  '         : Google',
  '  section Later',
  '    2006 : Twitter',
].join('\n')

describe('across', () => {
  test('a title, the periods on a rail, and each one’s events under it', () => {
    expect(draw(WEB, 40)).toEqual([
      'Web',
      '',
      ' 1991    1995           1998',
      '─●───────●──────────────●────────',
      ' • WWW   • JavaScript   • Google',
      '         • PHP',
    ])
  })

  test('sections as rules over their periods, an event on a line of its own', () => {
    expect(draw(SECTIONS, 50)).toEqual([
      ' Early ─────────────────   Later ───',
      ' 2002         2004         2006',
      '─●────────────●────────────●─────────',
      ' • LinkedIn   • Facebook   • Twitter',
      '              • Google',
    ])
  })

  test('a period with no event, and an event wrapped in its column', () => {
    expect(draw('timeline\n  2006\n  2008 : a long event that wraps', 40)).toEqual([
      ' 2006   2008',
      '─●──────●──────────────',
      '        • a long event',
      '          that wraps',
    ])
  })
})

describe('narrow', () => {
  test('down the left edge, the rail broken between sections', () => {
    expect(draw(WEB, 20)).toEqual([
      'Web',
      '',
      '● 1991',
      '│ • WWW',
      '● 1995',
      '│ • JavaScript',
      '│ • PHP',
      '● 1998',
      '  • Google',
    ])
    expect(draw(SECTIONS, 20)).toEqual([
      'Early',
      '● 2002',
      '│ • LinkedIn',
      '● 2004',
      '  • Facebook',
      '  • Google',
      '',
      'Later',
      '● 2006',
      '  • Twitter',
    ])
  })

  test('a word wider than the rail leaves: a list, every word whole', () => {
    expect(draw('timeline\n  2004 : Facebook\n  2006 : Twitter', 8)).toEqual([
      '2004',
      '  Facebo',
      '    ok',
      '2006',
      '  Twitte',
      '    r',
    ])
  })
})

describe('what does not read', () => {
  test('no period, or another header', () => {
    expect(draw('timeline\n  title Nothing')).toBeUndefined()
    expect(draw('timeline\n  section Empty\n  : orphan event')).toBeUndefined()
    expect(draw('journey\n  2004 : Facebook')).toBeUndefined()
    expect(timelineDiagram.matches('timeline')).toBe(true)
    expect(timelineDiagram.matches('gantt')).toBe(false)
  })
})
