/**
 * Architecture diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: a group and its services, an edge by its
 *    sides, a junction, groups in groups with an edge both ways, and an edge to a group.
 * 2. The grid the sides make: a cell taken given up for the one beside it, edges that turn
 *    between cells or at a corner, sides that face one way, labels on lines and beside them.
 * 3. What is not drawn so: a group another service stands among is laid out in layers; a
 *    diagram too wide is written as an outline; another kind, or text that is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { architectureDiagram } from './architecture'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  architectureDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('a group of services, an edge from left to right as its sides put them', () => {
    const source = [
      'architecture-beta',
      '  group api(cloud)[API]',
      '  service db(database)[Database] in api',
      '  service server(server)[Server] in api',
      '  db:L -- R:server',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌ API ────────────────────┐',
      '│ ┌────────┐ ┌──────────┐ │',
      '│ │ Server ├─┤ Database │ │',
      '│ └────────┘ └──────────┘ │',
      '└─────────────────────────┘',
    ])
  })

  test('edges from top to bottom, through a junction', () => {
    const source = [
      'architecture-beta',
      '  service a(server)[Gateway]',
      '  service b(disk)[Disk]',
      '  junction j',
      '  a:B --> T:j',
      '  j:B --> T:b',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌─────────┐',
      '│ Gateway │',
      '└────┬────┘',
      '     ▼',
      '     •',
      '     ▼',
      ' ┌──────┐',
      ' │ Disk │',
      ' └──────┘',
    ])
  })

  test('a group in a group, and an edge both ways', () => {
    const source = [
      'architecture-beta',
      '  group cloud(cloud)[Cloud]',
      '  group edge(cloud)[Edge] in cloud',
      '  service web(server)[Web] in edge',
      '  service cache(disk)[Cache]',
      '  web:R <--> L:cache',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌ Cloud ──────┐',
      '│ ┌ Edge ───┐ │',
      '│ │ ┌─────┐ │ │   ┌───────┐',
      '│ │ │ Web │◀┼─┼──▶│ Cache │',
      '│ │ └─────┘ │ │   └───────┘',
      '│ └─────────┘ │',
      '└─────────────┘',
    ])
  })

  test('a group that holds nothing is a dotted box an edge can reach', () => {
    const source = [
      'architecture-beta',
      '  group empty(cloud)[Nothing yet]',
      '  service s(server)[Server]',
      '  s:R --> L:empty{group}',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌────────┐ ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┐',
      '│ Server ├▶┆ Nothing yet ┆',
      '└────────┘ └┄┄┄┄┄┄┄┄┄┄┄┄┄┘',
    ])
  })
})

describe('the grid the sides make', () => {
  test('a cell taken: the next beside it; an edge turns between cells, or at a corner', () => {
    const source = [
      'architecture-beta',
      '  service a(server)[A]',
      '  service b(server)[B]',
      '  service c(server)[C]',
      '  service d(disk)[D]',
      '  a:R --> L:b',
      '  a:R --> L:c',
      '  c:R -- T:d',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───┐  ┌───┐',
      '│ A ├┬▶│ B │',
      '└───┘│ └───┘',
      '     │',
      '     │ ┌───┐',
      '     ╰▶│ C ├───╮',
      '       └───┘   │',
      '               │',
      '             ┌─┴─┐',
      '             │ D │',
      '             └───┘',
    ])
  })

  test('sides that face one way go round; a label on a line across, or beside one down', () => {
    const round = [
      'architecture-beta',
      '  service a(server)[A]',
      '  service b(server)[B]',
      '  a:R --> R:b',
      '  b:L -[ping]- L:a',
    ].join('\n')
    expect(draw(round)).toEqual([
      ' ┌───┐',
      '╭┤ A ├─╮',
      '│└───┘ │',
      '│ ping │',
      '│┌───┐ │',
      '╰┤ B │◀╯',
      ' └───┘',
    ])
    const labelled = [
      'architecture-beta',
      '  group app(cloud)[App]',
      '  service web(server)[Web] in app',
      '  service db(database)[DB]',
      '  service log(disk)[Log] in app',
      '  web:B <-[sql]-> T:db',
      '  web:R -[writes]-> L:log',
    ].join('\n')
    expect(draw(labelled)).toEqual([
      '┌ App ─────────────────────┐',
      '│ ┌─────┐          ┌─────┐ │',
      '│ │ Web ├──writes─▶│ Log │ │',
      '│ └─────┘          └─────┘ │',
      '│    ▲                     │',
      '└────┼─────────────────────┘',
      '     │ sql',
      '     │',
      '     ▼',
      '  ┌────┐',
      '  │ DB │',
      '  └────┘',
    ])
  })
})

describe('what is not drawn so', () => {
  test('a group another service stands among is laid out in layers', () => {
    const source = [
      'architecture-beta',
      '  group g(cloud)[G]',
      '  service a(server)[A] in g',
      '  service b(server)[B]',
      '  service c(server)[C] in g',
      '  a:R --> L:b',
      '  b:R --> L:c',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌ G ──────────────────┐',
      '│┌───┐           ┌───┐│',
      '││ A ├─╮       ╭▶│ C ││',
      '│└───┘ │       │ └───┘│',
      '└──────┼───────┼──────┘',
      '       │       │',
      '       │ ┌───┐ │',
      '       ╰▶│ B ├─╯',
      '         └───┘',
    ])
  })

  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'architecture-beta',
      '  group api(cloud)[Public API]',
      '  service db(database)[Database] in api',
      '  service server(server)[Web server] in api',
      '  db:L <-- R:server',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      'Public API',
      '  • Database',
      '  • Web server',
      'Web server ──▶',
      '  Database',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    expect(architectureDiagram.matches('architecture-beta')).toBe(true)
    expect(architectureDiagram.matches('architectures')).toBe(false)
    expect(draw('block-beta\n  a b')).toBeUndefined()
    expect(draw('architecture-beta')).toBeUndefined()
    expect(draw('architecture-beta\n  service\n  :R -- L:')).toBeUndefined()
    expect(draw('architecture-beta\n  service a[A]', 1)).toBeUndefined()
  })
})
