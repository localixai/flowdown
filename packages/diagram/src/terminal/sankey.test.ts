/**
 * Sankey diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: each source with its total, its flows as bars
 *    against the largest, a source that is also a target marked.
 * 2. What is read: quoted fields with commas and quotes in them; a row that is not a flow is not.
 * 3. Too narrow for bars, the flows are wrapped rows; what is not a sankey is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { sankeyDiagram } from './sankey'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  sankeyDiagram.draw(diagramLines(source), columns)?.map(lineText)

const ENERGY =
  'sankey-beta\nSolar,Grid,60\nWind,Grid,20\nGrid,Homes,50\nGrid,"Industry, heavy",30\n'

describe('what a diagram is drawn as', () => {
  test('flows grouped by source, each a bar against the largest flow of all', () => {
    expect(draw(ENERGY, 40)).toEqual([
      'Solar 60',
      '  ──▶ Grid            ███████████████ 60',
      'Wind 20',
      '  ──▶ Grid            █████           20',
      '↳ Grid 80',
      '  ──▶ Homes           ████████████▌   50',
      '  ──▶ Industry, heavy ███████▌        30',
    ])
  })

  test('a quote in a quoted field, a value at zero or below it, a row that is not a flow', () => {
    const source = 'sankey-beta\n"Say ""hi""",Out,0\nIn,Out,-5\nIn,Out\nIn,Out,lots\nIn,Out,1,2'
    expect(draw(source, 30)).toEqual([
      'Say "hi" 0',
      '  ──▶ Out                    0',
      'In -5',
      '  ──▶ Out                   -5',
    ])
  })
})

describe('what does not fit, and what is not a sankey', () => {
  test('at 20 columns, each source and its flows as wrapped rows', () => {
    expect(draw(ENERGY, 20)).toEqual([
      'Solar 60',
      '  ──▶ Grid 60',
      'Wind 20',
      '  ──▶ Grid 20',
      '↳ Grid 80',
      '  ──▶ Homes 50',
      '  ──▶ Industry,',
      '    heavy 30',
    ])
  })

  test('no flow that reads, or another header, is null', () => {
    expect(draw('sankey-beta\nSolar,Grid')).toBeUndefined()
    expect(draw('sankey-beta')).toBeUndefined()
    expect(draw('sankey-gamma\nA,B,1')).toBeUndefined()
    expect(sankeyDiagram.matches('sankey-beta')).toBe(true)
    expect(sankeyDiagram.matches('sankey')).toBe(true)
    expect(sankeyDiagram.matches('sankeys')).toBe(false)
  })
})
