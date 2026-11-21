/**
 * C4 diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: its title, a person and a system with their
 *    kinds and descriptions, a boundary as a frame, a database, what is external dotted, a
 *    relation both ways with its technology, and a dynamic diagram's numbered relations.
 * 2. What is read: arguments in quotes holding commas, named arguments passed over, `Rel_Back`,
 *    and the ways `Rel_U`, `Rel_D`, `Rel_L` and `Rel_R` name, as hints where a target goes.
 * 3. What is not drawn: a diagram too wide is written as an outline; another kind, or text that
 *    is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { c4Diagram, parseC4 } from './c4'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  c4Diagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('a title, a person and a system, and a relation', () => {
    const source = [
      'C4Context',
      '  title Banking',
      '  Person(user, "Customer", "Has an account")',
      '  System(bank, "Bank", "Holds the money")',
      '  Rel(user, bank, "Uses")',
    ].join('\n')
    expect(draw(source)).toEqual([
      'Banking',
      ' ╭────────────────╮',
      ' │    Customer    │',
      ' │    [Person]    │',
      ' ├────────────────┤',
      ' │ Has an account │',
      ' ╰────────┬───────╯',
      '          │',
      '        Uses',
      '          ▼',
      '┌───────────────────┐',
      '│       Bank        │',
      '│ [Software System] │',
      '├───────────────────┤',
      '│ Holds the money   │',
      '└───────────────────┘',
    ])
  })

  test('a boundary, a database, an external system dotted, a relation both ways', () => {
    const source = [
      'C4Container',
      '  System_Boundary(b, "Shop") {',
      '    Container(web, "Web", "React")',
      '    ContainerDb(db, "Store", "Postgres")',
      '  }',
      '  System_Ext(pay, "Payments")',
      '  Rel(web, db, "Reads", "SQL")',
      '  BiRel(web, pay, "Pays")',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌ Shop [System] ─────────────────────────────┐',
      '│                ┌────────────────────┐      │',
      '│                │        Web         │      │',
      '│                │ [Container: React] │      │',
      '│                └─────────┬──────────┘      │',
      '│                          │ ▲               │',
      '│                          │ ╰────────────╮  │',
      '│                          ╰╮             │  │',
      '│                           │             │  │',
      '│                         Reads         Pays │',
      '│                         [SQL]           │  │',
      '│             ╭─────────────╯             ╰──┼────────────╮',
      '│             ▼                              │            ▼',
      '│ ╭───────────────────────╮                  │ ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐',
      '│ ├───────────────────────┤                  │ ┆      Payments      ┆',
      '│ │         Store         │                  │ ┆ [External Software ┆',
      '│ │ [Container: Postgres] │                  │ ┆      System]       ┆',
      '│ ╰───────────────────────╯                  │ └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘',
      '└────────────────────────────────────────────┘',
    ])
  })

  test('a dynamic diagram numbers its relations in order, or as `RelIndex` says', () => {
    const source = [
      'C4Dynamic',
      '  Component(a, "A")',
      '  Component(b, "B")',
      '  ComponentQueue(q, "Q")',
      '  Rel(a, b, "asks")',
      '  Rel(b, q, "posts")',
      '  RelIndex(9, q, a, "tells")',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌─────────────┐',
      '│      A      │',
      '│ [Component] │',
      '└─────┬───────┘',
      '      │ ▲',
      '      │ ╰───────╮',
      '      ╰╮        │',
      '       │        │',
      '    1: asks 9: tells',
      '       ▼        │',
      '┌─────────────┐ │',
      '│      B      │ │',
      '│ [Component] │ │',
      '└──────┬──────┘ │',
      '       │        │',
      '   2: posts     │',
      '       │ ╭──────╯',
      '       ▼ │',
      ' ╭───────┴─────╮',
      ' (      Q      )',
      ' ( [Component] )',
      ' ╰─────────────╯',
    ])
  })
})

describe('what is read', () => {
  test('a comma in quotes, named arguments, styles, and `Rel_Back` drawn the other way', () => {
    const read = parseC4(
      diagramLines(
        [
          'C4Context',
          '  Person(a, "Smith, John", "Pays, then leaves", $sprite="person", $tags="v1")',
          '  System(b, "Bank")',
          '  UpdateElementStyle(a, $fontColor="red")',
          '  Rel_Back(a, b, "Bills")',
        ].join('\n'),
      ),
    )!
    expect(read.chart.nodes.map((node) => [node.label, node.parts])).toEqual([
      [['Smith, John', '[Person]'], [['Pays, then leaves']]],
      [['Bank', '[Software System]'], [[]]],
    ])
    expect(read.chart.edges.map((edge) => [edge.from, edge.to, edge.label])).toEqual([
      [1, 0, ['Bills']],
    ])
  })
})

describe('the ways a relation names', () => {
  test('up: the target in the rank over its source, the arrow still at the target', () => {
    const source = [
      'C4Context',
      '  Person(u, "User")',
      '  System(s, "Shop")',
      '  Rel_U(u, s, "Uses")',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───────────────────┐',
      '│       Shop        │',
      '│ [Software System] │',
      '└───────────────────┘',
      '          ▲',
      '          │',
      '        Uses',
      '          │',
      '    ╭─────┴────╮',
      '    │   User   │',
      '    │ [Person] │',
      '    ╰──────────╯',
    ])
    expect(draw(source.replace('Rel_U', 'Rel_Down'))!.slice(0, 4)).toEqual([
      '    ╭──────────╮',
      '    │   User   │',
      '    │ [Person] │',
      '    ╰─────┬────╯',
    ])
  })

  test('left and right, more than up and down: the chart runs across, each target its way', () => {
    const source = [
      'C4Context',
      '  Person(u, "User")',
      '  System(s, "Shop")',
      '  System(m, "Mail")',
      '  Rel_L(u, s, "Uses")',
      '  Rel_Right(u, m, "Reads")',
      '  Rel_U(s, m, "Sends")',
    ].join('\n')
    expect(draw(source)).toEqual([
      '                                  ╭──────────╮',
      '                                  │   User   │',
      '┌───────────────────┐   ╭──Uses───┤ [Person] ├──Reads──╮  ┌───────────────────┐',
      '│       Shop        │◀──╯         ╰──────────╯         ╰─▶│       Mail        │',
      '│ [Software System] ├──╮                                ╭▶│ [Software System] │',
      '└───────────────────┘  ╰───Sends────────────────────────╯ └───────────────────┘',
    ])
    expect(parseC4(diagramLines(source))!.chart.direction).toBe('LR')
    expect(draw(source, 30)).toEqual([
      '• User [Person]',
      '• Shop [Software System]',
      '• Mail [Software System]',
      'Shop [Software System]',
      '  ◀──Uses── User [Person]',
      'User [Person] ──Reads──▶ Mail',
      '  [Software System]',
      'Shop [Software System]',
      '  ──Sends──▶ Mail [Software',
      '  System]',
    ])
  })
})

describe('what is not drawn', () => {
  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'C4Context',
      '  title Banking system',
      '  Enterprise_Boundary(e, "Bank") {',
      '    Person(user, "Customer", "Has an account")',
      '  }',
      '  System_Ext(mail, "Mail")',
      '  Rel(user, mail, "Sends", "SMTP")',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      'Banking system',
      '• Mail [External',
      '  Software System]',
      'Bank [Enterprise]',
      '  • Customer',
      '    [Person]',
      '      Has an account',
      'Customer [Person]',
      '  ──Sends [SMTP]──▶',
      '  Mail [External',
      '  Software System]',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    for (const header of ['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'])
      expect(c4Diagram.matches(header)).toBe(true)
    expect(c4Diagram.matches('C4Other')).toBe(false)
    expect(draw('erDiagram\n  A ||--o{ B : has')).toBeUndefined()
    expect(draw('C4Context\n  title Nothing')).toBeUndefined()
    expect(draw('C4Context\n  Person(\n  Rel(, )')).toBeUndefined()
    expect(draw('C4Context\n  Person(a, "A")', 1)).toBeUndefined()
  })
})
