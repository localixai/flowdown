/**
 * Sequence diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: messages, notes, blocks and their parts, and
 *    activations as heavy lifelines, nested and left open.
 * 2. What is read: participants and aliases, every arrow, notes, autonumber, blocks left open,
 *    activations written as lines and as `+` and `-`.
 * 3. A diagram too wide for the columns is written as an outline.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { drawDiagram } from './index'
import { parseSequence } from './sequence-parse'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  drawDiagram(source, columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('messages, each label over its arrow, the lifelines spaced to hold it', () => {
    expect(draw('sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hey')).toEqual([
      '┌───────┐ ┌─────┐',
      '│ Alice │ │ Bob │',
      '└───┬───┘ └──┬──┘',
      '    │   Hi   │',
      '    ├───────▶│',
      '    │  Hey   │',
      '    │◀┄┄┄┄┄┄┄┤',
      '    │        │',
    ])
  })

  test('a note beside a lifeline, and a loop as a frame across the diagram', () => {
    const source = [
      'sequenceDiagram',
      '  participant A as Alice',
      '  Note right of A: thinking',
      '  loop daily',
      '    A->>B: ping',
      '  end',
    ].join('\n')
    expect(draw(source)).toEqual([
      '  ┌───────┐       ┌───┐',
      '  │ Alice │       │ B │',
      '  └───┬───┘       └─┬─┘',
      '      │╭┄┄┄┄┄┄┄┄┄┄╮ │',
      '      │┆ thinking ┆ │',
      '      │╰┄┄┄┄┄┄┄┄┄┄╯ │',
      '┌ loop daily ───────┼───┐',
      '│     │    ping     │   │',
      '│     ├────────────▶│   │',
      '└─────┼─────────────┼───┘',
      '      │             │',
    ])
  })

  test('alt and else, an actor, numbered messages, a cross and a message to oneself', () => {
    const source = [
      'sequenceDiagram',
      '  autonumber',
      '  actor U as User',
      '  participant S as Server',
      '  U->>S: login',
      '  alt ok',
      '    S-->>U: token',
      '  else bad',
      '    S--xU: denied',
      '    S->>S: log it',
      '  end',
    ].join('\n')
    expect(draw(source)).toEqual([
      '  ╭──────╮   ┌────────┐',
      '  │ User │   │ Server │',
      '  ╰───┬──╯   └────┬───┘',
      '      │ 1. login  │',
      '      ├──────────▶│',
      '┌ alt ok ─────────┼─────────────┐',
      '│     │ 2. token  │             │',
      '│     │◀┄┄┄┄┄┄┄┄┄┄┤             │',
      '├ else bad ┄┄┄┄┄┄┄┼┄┄┄┄┄┄┄┄┄┄┄┄┄┤',
      '│     │ 3. denied │             │',
      '│     │×┄┄┄┄┄┄┄┄┄┄┤             │',
      '│     │           ├─╮ 4. log it │',
      '│     │           │◀╯           │',
      '└─────┼───────────┼─────────────┘',
      '      │           │',
    ])
  })
})

describe('activations', () => {
  test('a heavy lifeline from the arrow that starts it to the arrow that ends it', () => {
    const source = ['sequenceDiagram', '  A->>+B: ask', '  B-->>-A: answer', '  A->>B: thanks']
    expect(draw(source.join('\n'))).toEqual([
      '┌───┐    ┌───┐',
      '│ A │    │ B │',
      '└─┬─┘    └─┬─┘',
      '  │  ask   │',
      '  ├───────▶┃',
      '  │ answer ┃',
      '  │◀┄┄┄┄┄┄┄┨',
      '  │ thanks │',
      '  ├───────▶│',
      '  │        │',
    ])
  })

  test('nested, with `activate` and `deactivate`, through a message that crosses it', () => {
    const source = [
      'sequenceDiagram',
      '  participant A',
      '  participant B',
      '  participant C',
      '  A->>B: one',
      '  activate B',
      '  B->>+B: self',
      '  A->>C: over',
      '  deactivate B',
      '  A->>C: still',
      '  deactivate B',
      '  A->>C: done',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───┐ ┌───┐    ┌───┐',
      '│ A │ │ B │    │ C │',
      '└─┬─┘ └─┬─┘    └─┬─┘',
      '  │ one │        │',
      '  ├────▶┃        │',
      '  │     ┠─╮ self │',
      '  │     ┃◀╯      │',
      '  │     over     │',
      '  ├─────╂───────▶│',
      '  │    still     │',
      '  ├─────╂───────▶│',
      '  │     done     │',
      '  ├─────┼───────▶│',
      '  │     │        │',
    ])
  })

  test('one never ended runs to the end; an outline says nothing of it', () => {
    const rows = draw('sequenceDiagram\n  A->>+B: go\n  A->>B: on')!
    expect(rows.slice(-3)).toEqual(['  │ on  ┃', '  ├────▶┃', '  │     ┃'])
    expect(
      draw('sequenceDiagram\n  A->>+B: a message too long to fit\n  deactivate B', 14),
    ).toEqual(['A, B', 'A ──▶ B: a', '  message too', '  long to fit'])
  })
})

describe('what is read', () => {
  const chart = (source: string) => parseSequence(diagramLines(source))!

  test('participants by alias and in the order they are met, actors marked', () => {
    const { participants } = chart(
      [
        'sequenceDiagram',
        '  actor U as The user',
        '  participant API',
        '  U->>DB: query',
        '  participant DB as Store',
      ].join('\n'),
    )
    expect(participants.map((one) => [one.id, one.label.join(' '), one.actor])).toEqual([
      ['U', 'The user', true],
      ['API', 'API', false],
      ['DB', 'Store', false],
    ])
  })

  test('every arrow, an activation after it read apart', () => {
    const arrows = ['->', '-->', '->>', '-->>', '-x', '--x', '-)', '--)', '<<->>']
    const { steps } = chart(
      ['sequenceDiagram', ...arrows.map((arrow) => `A${arrow}+B: m`)].join('\n'),
    )
    expect(steps.filter((step) => step.kind === 'activate')).toHaveLength(arrows.length)
    expect(
      steps.flatMap((step) => (step.kind === 'message' ? [[step.ink, step.tip, step.both]] : [])),
    ).toEqual([
      ['solid', 'none', false],
      ['dotted', 'none', false],
      ['solid', 'arrow', false],
      ['dotted', 'arrow', false],
      ['solid', 'cross', false],
      ['dotted', 'cross', false],
      ['solid', 'async', false],
      ['dotted', 'async', false],
      ['solid', 'arrow', true],
    ])
  })

  test('notes over two, autonumber from a number, a block left open closed at the end', () => {
    const { steps } = chart(
      [
        'sequenceDiagram',
        '  autonumber 10 5',
        '  Note over B,A: both',
        '  A->>B: one',
        '  A->>B: two',
        '  opt maybe',
        '  activate A',
        '  rect rgb(0,0,0)',
        '  end',
      ].join('\n'),
    )
    expect(steps).toEqual([
      { kind: 'note', side: 'over', from: 0, to: 1, label: ['both'] },
      {
        kind: 'message',
        from: 1,
        to: 0,
        label: ['10. one'],
        ink: 'solid',
        tip: 'arrow',
        both: false,
      },
      {
        kind: 'message',
        from: 1,
        to: 0,
        label: ['15. two'],
        ink: 'solid',
        tip: 'arrow',
        both: false,
      },
      { kind: 'open', keyword: 'opt', title: ['maybe'] },
      { kind: 'activate', who: 1, on: true },
      { kind: 'close' },
    ])
  })

  test('activations: `+` makes the receiver active, `-` ends the sender’s, and the words', () => {
    const { steps } = chart(
      ['sequenceDiagram', '  A->>+B: go', '  B-->>-A: back', '  activate A', '  deactivate A'].join(
        '\n',
      ),
    )
    expect(steps.filter((step) => step.kind === 'activate')).toEqual([
      { kind: 'activate', who: 1, on: true },
      { kind: 'activate', who: 1, on: false },
      { kind: 'activate', who: 0, on: true },
      { kind: 'activate', who: 0, on: false },
    ])
  })
})

describe('what does not fit', () => {
  test('a diagram too wide is written as an outline: its participants, then its steps', () => {
    const source = [
      'sequenceDiagram',
      '  participant A as Alice',
      '  participant B as Bob',
      '  participant C as Carol',
      '  A->>C: a message too long to draw here',
      '  loop retry',
      '    B--)A: ping',
      '  end',
      '  Note over A,B: done',
    ].join('\n')
    expect(draw(source, 30)).toEqual([
      'Alice, Bob, Carol',
      'Alice ──▶ Carol: a message too',
      '  long to draw here',
      'loop retry',
      '  Bob ┄┄▷ Alice: ping',
      'end',
      'note over Alice, Bob: done',
    ])
  })
})
