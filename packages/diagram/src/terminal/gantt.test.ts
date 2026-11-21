/**
 * Gantt charts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row: each kind of bar, a milestone, sections, a
 *    title, the axis and its formats, and a chart with no date written.
 * 2. What is read: date formats, `after` and `until`, durations, `excludes weekends`.
 * 3. What does not fit is written as a list; what does not read is not drawn.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { ganttDiagram } from './gantt'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  ganttDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a chart is drawn as', () => {
  test('a fill for each kind of task, a milestone, the axis and a key', () => {
    const source = [
      'gantt',
      '  dateFormat YYYY-MM-DD',
      '  Spec :done, s, 2024-03-04, 3d',
      '  Code :active, c, after s, 4d',
      '  Fix :crit, after c, 2d',
      '  Ship :milestone, after c, 0d',
    ].join('\n')
    expect(draw(source, 40)).toEqual([
      'Spec    ░░░░░░░░░░░',
      'Code              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
      'Fix                             ▒▒▒▒▒▒▒▒',
      'Ship                            ◆',
      '        ┬──────┬──────┬──────┬──────────',
      '        Mar 4  Mar 6  Mar 8  Mar 10',
      '',
      '▓ active  ░ done  ▒ crit  ◆ milestone',
    ])
  })

  test('a title and sections, the tasks indented under them; weeks on the axis', () => {
    const source = [
      'gantt',
      '  title Launch',
      '  section Plan',
      '    Brief :b, 2024-03-04, 1w',
      '  section Work',
      '    Build :after b, 1w',
    ].join('\n')
    expect(draw(source, 36)).toEqual([
      'Launch',
      '',
      'Plan',
      '  Brief   █████████████',
      'Work',
      '  Build                █████████████',
      '          ┬────────────┬────────────',
      '          Mar 4        Mar 11',
    ])
  })

  test('the axis in hours when the chart is, and in the format `axisFormat` gives', () => {
    const hours = [
      'gantt',
      '  dateFormat YYYY-MM-DD HH:mm',
      '  Boot :b, 2024-03-04 09:00, 90m',
      '  Test :after b, 2h',
    ].join('\n')
    expect(draw(hours, 40)).toEqual([
      'Boot    ██████████████',
      'Test                 ███████████████████',
      '        ┬────────┬────────┬────────┬────',
      '        09:00    10:00    11:00    12:00',
    ])
    expect(draw('gantt\n  axisFormat %d/%m\n  A :2024-01-01, 10d', 40)).toEqual([
      'A       ████████████████████████████████',
      '        ┬─────────────────────┬─────────',
      '        01/01                 08/01',
    ])
  })

  test('a chart with no date written counts its days from the first', () => {
    expect(draw('gantt\n  Prep :p, 2d\n  Go :after p, 1d', 40)).toEqual([
      'Prep    █████████████████████',
      'Go                           ███████████',
      '        ┬─────────┬──────────┬──────────',
      '        day 1     day 2      day 3',
    ])
  })
})

describe('what is read', () => {
  test('a format of its own, weekends skipped, `after`, `until`, hours, an `after` of nothing', () => {
    // 1 March 2024 is a Friday: three days of work end on the Wednesday after.
    const source = [
      'gantt',
      '  dateFormat DD/MM/YYYY',
      '  excludes weekends',
      '  Spec :s, 01/03/2024, 3d',
      '  Code :c, after s, 2w',
      '  Call :after c, 6h',
      '  Wait :w, 04/03/2024, until c',
      '  Late :l, after z, 1d',
    ].join('\n')
    expect(draw(source, 18)).toEqual([
      '█ Spec 2024-03-01',
      '  00:00 →',
      '  2024-03-06 00:00',
      '█ Code 2024-03-06',
      '  00:00 →',
      '  2024-03-26 00:00',
      '█ Call 2024-03-26',
      '  00:00 →',
      '  2024-03-26 06:00',
      '█ Wait 2024-03-04',
      '  00:00 →',
      '  2024-03-06 00:00',
      '█ Late 2024-03-06',
      '  00:00 →',
      '  2024-03-07 00:00',
    ])
  })

  test('month names and ordinals; a task may name one written after it', () => {
    const source = [
      'gantt',
      '  dateFormat MMM Do YYYY',
      '  B :b, after a, 1d',
      '  A :a, Mar 1st 2024, 1d',
    ].join('\n')
    expect(draw(source, 18)).toEqual(['█ B 2024-03-02', '█ A 2024-03-01'])
  })
})

describe('what does not fit, and what does not read', () => {
  test('narrow, a list of the tasks under their sections, a milestone its one date', () => {
    const source = [
      'gantt',
      '  title Plan',
      '  section A',
      '  Spec :done, s, 2024-03-04, 3d',
      '  Ship :milestone, crit, 2024-03-09, 0d',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      'Plan',
      'A',
      '  ░ Spec 2024-03-04',
      '    → 2024-03-06',
      '  ◆ Ship 2024-03-09',
    ])
    expect(draw('gantt\n  Prep :p, 2d\n  Go :after p, 1d', 12)).toEqual([
      '█ Prep day 1',
      '  → day 2',
      '█ Go day 3',
    ])
  })

  test('no task, another header, or no room at all: not drawn', () => {
    expect(draw('gantt\n  title Nothing\n  section Empty')).toBeUndefined()
    expect(draw('gantt')).toBeUndefined()
    expect(draw('timeline\n  A :2024-01-01, 1d')).toBeUndefined()
    expect(draw('gantt\n  A :2024-01-01, 1d', 1)).toBeUndefined()
    expect(ganttDiagram.matches('gantt')).toBe(true)
    expect(ganttDiagram.matches('ganttish')).toBe(false)
  })
})
