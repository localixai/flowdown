/**
 * Packet diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: the bit numbers, a box a field, a name too
 *    long for its field written under it, `+n` lengths, a field run on into the next row, a gap.
 * 2. Sixteen bits to a row when thirty-two do not fit; a list when sixteen do not, or when fields
 *    overlap.
 * 3. What is not a packet is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { packetDiagram } from './packet'
import { lineText } from '../style'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  packetDiagram.draw(diagramLines(source), columns)?.map(lineText)

const IP = 'packet-beta\n  0-3: "Version"\n  4-7: "IHL"\n  8-15: "Type"'

describe('what a packet is drawn as', () => {
  test('32 bits a row, a box a field; a name too long for one bit is a mark, written out below', () => {
    const source = [
      'packet-beta',
      '  title Header',
      '  0-3: "Version"',
      '  4-7: "IHL"',
      '  8-15: "Type of Service"',
      '  16-31: "Total Length"',
      '  32: "R"',
      '  +2: "Flags"',
    ].join('\n')
    expect(draw(source)).toEqual([
      'Header',
      '    0                   1                   2                   3',
      '    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1',
      '   ┌───────┬───────┬───────────────┬───────────────────────────────┐',
      ' 0 │Version│  IHL  │Type of Service│         Total Length          │',
      '   ├─┬───┬─┴───────┴───────────────┴───────────────────────────────┘',
      '32 │R│ 1 │',
      '   └─┴───┘',
      '1 Flags 33-34',
    ])
  })

  test('a field run on into the next row has no border between, and a gap is a blank row', () => {
    const source = 'packet-beta\n  0-47: "Address"\n  48-63: "Port"\n  128-131: "Tail"'
    expect(draw(source)).toEqual([
      '     0                   1                   2                   3',
      '     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1',
      '    ┌───────────────────────────────────────────────────────────────┐',
      '  0 │                            Address                            │',
      '    │                               ┌───────────────────────────────┤',
      ' 32 │                               │             Port              │',
      '    └───────────────────────────────┴───────────────────────────────┘',
      '',
      '    ┌───────┐',
      '128 │ Tail  │',
      '    └───────┘',
    ])
  })

  test('16 bits a row when 32 do not fit', () => {
    expect(draw(IP, 40)).toEqual([
      '   0                   1',
      '   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5',
      '  ┌───────┬───────┬───────────────┐',
      '0 │Version│  IHL  │     Type      │',
      '  └───────┴───────┴───────────────┘',
    ])
  })
})

describe('what does not fit, and what is not a packet', () => {
  test('at 20 columns, or with fields that overlap, a list of the fields and their bits', () => {
    expect(draw(IP, 20)).toEqual(['0-3   Version', '4-7   IHL', '8-15  Type'])
    expect(draw('packet-beta\n  0-7: "A"\n  4-11: "B"')).toEqual(['0-7   A', '4-11  B'])
  })

  test('a packet past its rows is listed; no field that reads, or another header, is null', () => {
    expect(draw('packet-beta\n  0-99999: "Payload"')).toEqual(['0-99999  Payload'])
    expect(draw('packet-beta\n  7-3: "Backwards"\n  +0: "Empty"\n  x: "No"')).toBeUndefined()
    expect(draw('packets\n  0-7: "A"')).toBeUndefined()
    expect(packetDiagram.matches('packet-beta')).toBe(true)
    expect(packetDiagram.matches('packet')).toBe(true)
  })
})
