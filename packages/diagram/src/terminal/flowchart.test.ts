/**
 * Flowcharts in a terminal.
 *
 * 1. What a small chart is drawn as, row for row, in each direction and with each kind of node,
 *    edge, label, cycle and subgraph.
 * 2. What is read: the forms of a link, `&`, chains, and what is passed over.
 * 3. What is not drawn: a chart too wide is written as an outline; another kind of diagram, or
 *    text that is not one, is left to the caller.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { drawDiagram } from './index'
import { parseFlowchart } from './parse'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  drawDiagram(source, columns)?.map(lineText)

describe('what a chart is drawn as', () => {
  test('down, with a label on its edge', () => {
    expect(draw('flowchart TD\n  A[Start] -->|yes| B(Done)')).toEqual([
      '┌───────┐',
      '│ Start │',
      '└───┬───┘',
      '    │',
      '   yes',
      '    ▼',
      '╭──────╮',
      '│ Done │',
      '╰──────╯',
    ])
  })

  test('across, with the label in the line', () => {
    expect(draw('flowchart LR\n  A[Start] -- yes --> B(Done)')).toEqual([
      '┌───────┐       ╭──────╮',
      '│ Start ├──yes─▶│ Done │',
      '└───────┘       ╰──────╯',
    ])
  })

  test('up and to the left', () => {
    expect(draw('flowchart BT\n  A --> B')).toEqual([
      '┌───┐',
      '│ B │',
      '└───┘',
      '  ▲',
      '┌─┴─┐',
      '│ A │',
      '└───┘',
    ])
    expect(draw('flowchart RL\n  A --> B')).toEqual(['┌───┐ ┌───┐', '│ B │◀┤ A │', '└───┘ └───┘'])
  })

  test('a cycle: the edge back up runs beside the chart, into its own column of the box', () => {
    expect(draw('graph TD\n  A --> B --> C\n  C --> A')).toEqual([
      '┌───┐',
      '│ A │',
      '└─┬─┘',
      '  │▲',
      '  │╰──╮',
      '  ▼   │',
      '┌───┐ │',
      '│ B │ │',
      '└─┬─┘ │',
      '  │╭──╯',
      '  ▼│',
      '┌──┴┐',
      '│ C │',
      '└───┘',
    ])
  })

  test('a long label wraps inside its box', () => {
    expect(draw('flowchart TD\n  A[This label is long enough that it has to wrap] --> B')).toEqual([
      '┌───────────────────────┐',
      '│  This label is long   │',
      '│ enough that it has to │',
      '│         wrap          │',
      '└───────────┬───────────┘',
      '            ▼',
      '          ┌───┐',
      '          │ B │',
      '          └───┘',
    ])
  })

  test('a subgraph is a frame, its title in the border clear of the edges that cross it', () => {
    expect(draw('flowchart TD\n  subgraph api [API]\n    a --> b\n  end\n  c --> a')).toEqual([
      '  ┌───┐',
      '  │ c │',
      '  └─┬─┘',
      '┌───┼ API ─┐',
      '│   ▼      │',
      '│ ┌───┐    │',
      '│ │ a │    │',
      '│ └─┬─┘    │',
      '│   ▼      │',
      '│ ┌───┐    │',
      '│ │ b │    │',
      '│ └───┘    │',
      '└──────────┘',
    ])
  })

  test('shapes: a diamond, a subroutine, a drum', () => {
    expect(draw('flowchart LR\n  A{ok?} -->|no| B[[retry]]\n  A --> C[(store)]')).toEqual([
      '                    ┌┬───────┬┐',
      '        ╭──no──────▶││ retry ││',
      '╱─────╲ │           └┴───────┴┘',
      '< ok? >─┤ ╭───────╮',
      '╲─────╱ │ ├───────┤',
      '        ╰▶│ store │',
      '          ╰───────╯',
    ])
  })

  test('edges out of one box branch from one line, and edges into one gather into one', () => {
    expect(draw('flowchart TD\n  A --> B & C\n  B & C --> D')).toEqual([
      '    ┌───┐',
      '    │ A │',
      '    └─┬─┘',
      '  ╭───┴──╮',
      '  ▼      ▼',
      '┌───┐  ┌───┐',
      '│ B │  │ C │',
      '└─┬─┘  └─┬─┘',
      '  ╰───┬──╯',
      '      ▼',
      '    ┌───┐',
      '    │ D │',
      '    └───┘',
    ])
  })

  test('each kind of link keeps its look: dotted, thick, cross, circle, both ways, open', () => {
    expect(draw('flowchart LR\n  A -.-> B ==> C --x D --o E <--> F --- G', 120)).toEqual([
      '┌───┐  ┌───┐  ┌───┐ ┌───┐ ┌───┐  ┌───┐ ┌───┐',
      '│ A ├┄▶│ B ├━▶│ C ├×│ D ├○│ E │◀▶│ F ├─┤ G │',
      '└───┘  └───┘  └───┘ └───┘ └───┘  └───┘ └───┘',
    ])
  })

  test('a loop to itself goes out of the side and back, its label beside it', () => {
    expect(draw('graph TD\n  A[Retry] -->|again| A\n  A --> B')).toEqual([
      '┌───────┐',
      '│ Retry ├─╮ again',
      '│       │◀╯',
      '└───┬───┘',
      '    ▼',
      '  ┌───┐',
      '  │ B │',
      '  └───┘',
    ])
  })
})

describe('what is read', () => {
  const chart = (source: string) => parseFlowchart(diagramLines(source))!

  test('labels: quoted, broken by <br>, entities read, markup and controls made harmless', () => {
    const { nodes } = chart(
      'graph TD\n  A["a; b <br/> c"] --> B[x &amp; #quot;y#quot;] --> C[<b>bold</b> \u001b[2J]',
    )
    expect(nodes.map((node) => node.label)).toEqual([
      ['a; b', 'c'],
      ['x & "y"'],
      ['bold \\u{1b}[2J'],
    ])
  })

  test('the forms of a link, a chain, and `&` on both sides', () => {
    const { edges } = chart(
      [
        'flowchart LR',
        '  A -- one --> B -. two .-> C == three ==> D',
        '  A & B --x C & D',
        '  E <-->|four| F ~~~ G',
      ].join('\n'),
    )
    expect(
      edges.map((edge) => [
        edge.from,
        edge.to,
        edge.label.join(' '),
        edge.ink,
        edge.tail,
        edge.head,
      ]),
    ).toEqual([
      [0, 1, 'one', 'solid', 'none', 'arrow'],
      [1, 2, 'two', 'dotted', 'none', 'arrow'],
      [2, 3, 'three', 'thick', 'none', 'arrow'],
      [0, 2, '', 'solid', 'none', 'cross'],
      [0, 3, '', 'solid', 'none', 'cross'],
      [1, 2, '', 'solid', 'none', 'cross'],
      [1, 3, '', 'solid', 'none', 'cross'],
      [4, 5, 'four', 'solid', 'arrow', 'arrow'],
    ])
  })

  test('styles, classes, clicks and comments are passed over; the rest is drawn', () => {
    const plain = 'flowchart TD\n  A[Start] --> B'
    const styled = [
      '%%{init: {"theme": "dark"}}%%',
      'flowchart TD',
      '  classDef hot fill:#f00',
      '  A[Start]:::hot --> B',
      '  class A hot',
      '  style B fill:#fff',
      '  click A callback "Tip"',
      '  linkStyle 0 stroke:red',
      '  %% a comment',
      '  A --> --> nowhere',
    ].join('\n')
    expect(draw(styled)).toEqual(draw(plain))
  })

  test('a shape written later is the node’s shape from then on; a bare name is not', () => {
    const { nodes } = chart('graph TD\n  A --> B\n  A{Choose} --> B\n  A --> C')
    expect(nodes.map((node) => [node.id, node.shape, node.label.join(' ')])).toEqual([
      ['A', 'diamond', 'Choose'],
      ['B', 'box', 'B'],
      ['C', 'box', 'C'],
    ])
  })
})

describe('what is not drawn', () => {
  test('a chart too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'flowchart LR',
      '  A[Start] -->|yes| B(Done)',
      '  A -.-> C[Archive the order]',
      '  subgraph later [Later]',
      '    C',
      '  end',
    ].join('\n')
    expect(draw(source, 30)).toEqual([
      '• Start',
      '• Done',
      'Later',
      '  • Archive the order',
      'Start ──yes──▶ Done',
      'Start ┄┄▶ Archive the order',
    ])
    expect(draw(source, 12)).toEqual([
      '• Start',
      '• Done',
      'Later',
      '  • Archive',
      '    the',
      '    order',
      'Start',
      '  ──yes──▶',
      '  Done',
      'Start ┄┄▶',
      '  Archive',
      '  the order',
    ])
  })

  test('a kind not drawn, or text that is not a chart, is left to the caller', () => {
    expect(drawDiagram('info', 80)).toBeNull()
    expect(drawDiagram('notADiagram\n  A --> B', 80)).toBeNull()
    expect(drawDiagram('flowchart TD', 80)).toBeNull()
    expect(drawDiagram('flowchart TD\n  --> -->', 80)).toBeNull()
    expect(drawDiagram('', 80)).toBeNull()
    expect(drawDiagram('graph TD\n  A --> B', 1)).toBeNull()
  })
})
