/**
 * State diagrams in a terminal.
 *
 * 1. What a small machine is drawn as, row for row: its start and its end, a transition and its
 *    label, a direction, a long name and a description, a choice, a fork and a join, a composite
 *    state, its regions, and notes.
 * 2. What is read: styles passed over, and a transition into a composite drawn to where it starts.
 * 3. What is not drawn: a machine too wide is written as an outline; another kind, or text that
 *    is not a machine, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { parseState, stateDiagram } from './state'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  stateDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a machine is drawn as', () => {
  test('its start, a transition with its label, and its end', () => {
    expect(draw('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy : job\n  Busy --> [*]')).toEqual([
      '    ●',
      '    ▼',
      '╭──────╮',
      '│ Idle │',
      '╰───┬──╯',
      '    │',
      '   job',
      '    ▼',
      '╭──────╮',
      '│ Busy │',
      '╰───┬──╯',
      '    ▼',
      '    ◉',
    ])
  })

  test('a direction', () => {
    expect(draw('stateDiagram\n  direction LR\n  [*] --> A\n  A --> B')).toEqual([
      '  ╭───╮ ╭───╮',
      '●▶│ A ├▶│ B │',
      '  ╰───╯ ╰───╯',
    ])
  })

  test('a long name, and a description under a rule', () => {
    const source = [
      'stateDiagram-v2',
      '  state "Waiting for input" as Wait',
      '  Wait : reads a key',
      '  [*] --> Wait',
    ].join('\n')
    expect(draw(source)).toEqual([
      '          ●',
      '          ▼',
      '╭───────────────────╮',
      '│ Waiting for input │',
      '├───────────────────┤',
      '│ reads a key       │',
      '╰───────────────────╯',
    ])
  })

  test('a choice', () => {
    const source = [
      'stateDiagram-v2',
      '  state Check <<choice>>',
      '  [*] --> Check',
      '  Check --> Yes : ok',
      '  Check --> No',
    ].join('\n')
    expect(draw(source)).toEqual([
      '     ●',
      '     ▼',
      '     ◇',
      '   ╭─┴──╮',
      '   │    ▼',
      '  ok ╭────╮',
      '   │ │ No │',
      '   │ ╰────╯',
      '   ▼',
      '╭─────╮',
      '│ Yes │',
      '╰─────╯',
    ])
  })

  test('a fork and a join, as bars', () => {
    const source = [
      'stateDiagram-v2',
      '  state f <<fork>>',
      '  state j <<join>>',
      '  [*] --> f',
      '  f --> A',
      '  f --> B',
      '  A --> j',
      '  B --> j',
    ].join('\n')
    expect(draw(source)).toEqual([
      '      ●',
      '      ▼',
      '   ━━━━━━━',
      '  ╭──╯ ╰─╮',
      '  ▼      ▼',
      '╭───╮  ╭───╮',
      '│ A │  │ B │',
      '╰─┬─╯  ╰─┬─╯',
      '  ╰──╮ ╭─╯',
      '     ▼ ▼',
      '   ━━━━━━━',
    ])
  })

  test('a composite state: a frame, entered where it starts', () => {
    const source = [
      'stateDiagram-v2',
      '  [*] --> On',
      '  state On {',
      '    [*] --> Low',
      '    Low --> High',
      '  }',
      '  On --> Off',
    ].join('\n')
    expect(draw(source)).toEqual([
      '      ●',
      '┌ On ─┼────┐',
      '│     ▼    │',
      '│     ●    │',
      '│     ▼    │',
      '│  ╭─────╮ │',
      '│  │ Low │ │',
      '│  ╰──┬──╯ │',
      '│     ▼    │',
      '│ ╭──────╮ │',
      '│ │ High │ │',
      '│ ╰───┬──╯ │',
      '└─────┼────┘',
      '      ▼',
      '   ╭─────╮',
      '   │ Off │',
      '   ╰─────╯',
    ])
  })

  test('regions: each `--` a frame of its own inside the composite', () => {
    expect(
      draw('stateDiagram-v2\n  state On {\n    [*] --> A\n    --\n    [*] --> B\n  }'),
    ).toEqual([
      '┌ On ──────────────────┐',
      '│ ┌───────┐  ┌───────┐ │',
      '│ │   ●   │  │   ●   │ │',
      '│ │   ▼   │  │   ▼   │ │',
      '│ │ ╭───╮ │  │ ╭───╮ │ │',
      '│ │ │ A │ │  │ │ B │ │ │',
      '│ │ ╰───╯ │  │ ╰───╯ │ │',
      '│ └───────┘  └───────┘ │',
      '└──────────────────────┘',
    ])
  })

  test('notes, on one line and on several: dotted boxes beside their state, on its side', () => {
    const source = [
      'stateDiagram-v2',
      '  A --> B',
      '  note right of A : first',
      '  note left of B',
      '    two rows',
      '    of note',
      '  end note',
    ].join('\n')
    expect(draw(source)).toEqual([
      '              ╭───╮  ┌┄┄┄┄┄┄┄┐',
      '              │ A │  ┆ first ┆',
      '              ╰─┬─╯  └┄┄┄┄┄┄┄┘',
      '                ▼',
      '┌┄┄┄┄┄┄┄┄┄┄┐  ╭───╮',
      '┆ two rows ┆  │ B │',
      '┆ of note  ┆  ╰───╯',
      '└┄┄┄┄┄┄┄┄┄┄┘',
    ])
  })

  test('across, a note is in the rank on its side, joined by a dotted line', () => {
    const source = [
      'stateDiagram-v2',
      '  direction LR',
      '  A --> B',
      '  note left of A : first',
      '  note right of B : last',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌┄┄┄┄┄┄┄┐  ╭───╮ ╭───╮  ┌┄┄┄┄┄┄┐',
      '┆ first ├┄┄┤ A ├▶│ B ├┄┄┤ last ┆',
      '└┄┄┄┄┄┄┄┘  ╰───╯ ╰───╯  └┄┄┄┄┄┄┘',
    ])
    // Narrow, each note's row says the side it is on.
    expect(draw(source.replace('  direction LR\n', ''), 12)!.slice(-2)).toEqual([
      'first ┄┄┄ A',
      'B ┄┄┄ last',
    ])
  })
})

describe('what is read', () => {
  test('styles, classes and comments are passed over; the rest is drawn', () => {
    const plain = 'stateDiagram-v2\n  [*] --> A\n  A --> B'
    const styled = [
      'stateDiagram-v2',
      '  classDef hot fill:#f00',
      '  [*] --> A:::hot',
      '  class A hot',
      '  style B fill:#fff',
      '  hide empty description',
      '  %% a comment',
      '  A --> B',
    ].join('\n')
    expect(draw(styled)).toEqual(draw(plain))
  })

  test('each region has its own start, and a transition into the composite enters them all', () => {
    const chart = parseState(
      diagramLines(
        'stateDiagram-v2\n  [*] --> On\n  state On {\n    [*] --> A\n    --\n    [*] --> B\n  }',
      ),
    )!
    const name = (at: number) => chart.nodes[at]!.id
    expect(chart.edges.map((edge) => [name(edge.from), name(edge.to)])).toEqual([
      ['[*]start -1', '[*]start 0'],
      ['[*]start -1', '[*]start 2'],
      ['[*]start 0', 'A'],
      ['[*]start 2', 'B'],
    ])
  })
})

describe('what is not drawn', () => {
  test('a machine too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'stateDiagram-v2',
      '  [*] --> Idle',
      '  Idle --> Working : start the job',
      '  state Working {',
      '    [*] --> Fetch',
      '    Fetch --> Store',
      '  }',
      '  Working --> [*]',
      '  Idle : waits for a job',
      '  note right of Idle : polls',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      '• Idle',
      '    waits for a job',
      '• polls',
      'Working',
      '  • Fetch',
      '  • Store',
      '● ──▶ Idle',
      'Idle ──start the',
      '  job──▶ ● Working',
      '● Working ──▶ Fetch',
      'Fetch ──▶ Store',
      'Store ──▶ ◉',
      'Idle ┄┄┄ polls',
    ])
  })

  test('another kind of diagram, or text that is not a machine, is null', () => {
    expect(stateDiagram.matches('stateDiagram')).toBe(true)
    expect(stateDiagram.matches('stateDiagram-v2')).toBe(true)
    expect(stateDiagram.matches('stateDiagrams')).toBe(false)
    expect(stateDiagram.matches('flowchart TD')).toBe(false)
    expect(draw('flowchart TD\n  A --> B')).toBeUndefined()
    expect(draw('stateDiagram-v2')).toBeUndefined()
    expect(draw('stateDiagram-v2\n  --> -->\n  : nothing')).toBeUndefined()
    expect(draw('stateDiagram-v2\n  [*] --> A', 1)).toBeUndefined()
  })
})
