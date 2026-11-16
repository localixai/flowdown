/**
 * Class diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: compartments, an annotation and a generic,
 *    each kind of relation's ends, multiplicities, a direction, a namespace and a note.
 * 2. What is read: members in a body and after a colon, every relation's form, names in
 *    backquotes, nested generics, and what is passed over.
 * 3. What is not drawn: a diagram too wide is written as an outline; another kind, or text that
 *    is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { classDiagram, parseClass } from './class'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  classDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('classes as compartments, and inheritance as a hollow triangle at the parent', () => {
    const source = [
      'classDiagram',
      '  Animal <|-- Duck',
      '  Animal <|-- Fish',
      '  Animal : +int age',
      '  Animal : +isMammal() bool',
      '  class Duck {',
      '    +String beak',
      '    +swim()',
      '  }',
    ].join('\n')
    expect(draw(source)).toEqual([
      '     ┌──────────────────┐',
      '     │      Animal      │',
      '     ├──────────────────┤',
      '     │ +int age         │',
      '     ├──────────────────┤',
      '     │ +isMammal() bool │',
      '     └──────────────────┘',
      '              △ △',
      '        ╭─────╯ ╰─────╮',
      '        │             │',
      '┌───────┴──────┐  ┌───┴──┐',
      '│     Duck     │  │ Fish │',
      '├──────────────┤  └──────┘',
      '│ +String beak │',
      '├──────────────┤',
      '│ +swim()      │',
      '└──────────────┘',
    ])
  })

  test('an annotation over the name, a generic as it is read, realisation dotted', () => {
    const source = [
      'classDiagram',
      '  class Shape {',
      '    <<interface>>',
      '    +area() double',
      '  }',
      '  class Square~T~',
      '  Shape <|.. Square~T~',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌────────────────┐',
      '│  «interface»   │',
      '│     Shape      │',
      '├────────────────┤',
      '│ +area() double │',
      '└────────────────┘',
      '         △',
      '         ┆',
      '         ┆',
      '   ┌─────┴─────┐',
      '   │ Square<T> │',
      '   └───────────┘',
    ])
  })

  test('multiplicities by the boxes, the label between them', () => {
    expect(draw('classDiagram\n  Customer "1" --> "*" Order : places')).toEqual([
      '┌──────────┐',
      '│ Customer │',
      '└─────┬────┘',
      '      1',
      '      │',
      '   places',
      '      *',
      '      ▼',
      '  ┌───────┐',
      '  │ Order │',
      '  └───────┘',
    ])
  })

  test('composition, aggregation, dependency and a plain link, each from a port of its own', () => {
    const source = [
      'classDiagram',
      '  Car *-- Wheel',
      '  Car o-- Driver',
      '  Car ..> Fuel : uses',
      '  Car -- Road',
    ].join('\n')
    expect(draw(source)).toEqual([
      '            ┌───────┐',
      '            │  Car  │',
      '            └┬─────┬┘',
      '             ┆ ◆ ◇ │',
      '             ┆ │ │ │',
      '    ╭┄┄┄┄┄┄┄┄╯ │ │ ╰──────────────╮',
      '    ┆      ╭───╯ ╰─────╮          │',
      '    ┆      │           │          │',
      '  uses ┌───┴───┐  ┌────┴───┐  ┌───┴──┐',
      '    ┆  │ Wheel │  │ Driver │  │ Road │',
      '    ┆  └───────┘  └────────┘  └──────┘',
      '    ┆',
      '    ▼',
      '┌──────┐',
      '│ Fuel │',
      '└──────┘',
    ])
  })

  test('a direction across', () => {
    expect(draw('classDiagram\n  direction LR\n  A <|-- B\n  B .. C')).toEqual([
      '┌───┐  ┌───┐  ┌───┐',
      '│ A │◁─┤ B ├┄┄┤ C │',
      '└───┘  └───┘  └───┘',
    ])
  })

  test('a namespace as a frame, and a note joined to its class', () => {
    const source = [
      'classDiagram',
      '  namespace Shop {',
      '    class Cart',
      '    class Item',
      '  }',
      '  Cart "1" *-- "0..*" Item : holds',
      '  note for Cart "keeps items"',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌ Shop ───────────────────┐',
      '│      ┌──────┐           │',
      '│      │ Cart │           │',
      '│      └────┬─┘           │',
      '│         ◆ ┆             │',
      '│         1 ┆             │',
      '│         │ ┆             │',
      '│     ╭───╯ ╰┄┄┄┄╮        │',
      '│     │          ┆        │',
      '│   holds ┌┄┄┄┄┄┄┴┄┄┄┄┄┄┐ │',
      '│     │   ┆ keeps items ┆ │',
      '│     │   └┄┄┄┄┄┄┄┄┄┄┄┄┄┘ │',
      '│   0..*                  │',
      '│     │                   │',
      '│ ┌───┴──┐                │',
      '│ │ Item │                │',
      '│ └──────┘                │',
      '└─────────────────────────┘',
    ])
  })

  test('nested generics, a label, a name in backquotes', () => {
    const source = [
      'classDiagram',
      '  class List~List~int~~',
      '  class Box["A labelled box"]',
      '  `Odd name` --> Box',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌─────────────────┐  ┌──────────┐',
      '│ List<List<int>> │  │ Odd name │',
      '└─────────────────┘  └─────┬────┘',
      '                           ▼',
      '                  ┌────────────────┐',
      '                  │ A labelled box │',
      '                  └────────────────┘',
    ])
  })
})

describe('what is read', () => {
  const chart = (source: string) => parseClass(diagramLines(source))!

  test('every form of a relation: its ink, its ends, its marks', () => {
    const { edges } = chart(
      [
        'classDiagram',
        '  A <|-- B',
        '  A *-- C',
        '  A o-- D',
        '  A --> E',
        '  A ..> F',
        '  A ..|> G',
        '  A -- H',
        '  A .. I',
        '  A ()-- J',
        '  A <|--|> K',
      ].join('\n'),
    )
    expect(
      edges.map((edge) => [edge.ink, edge.tail, edge.marks?.tail, edge.head, edge.marks?.head]),
    ).toEqual([
      ['solid', 'arrow', 'triangle', 'none', undefined],
      ['solid', 'arrow', 'diamond', 'none', undefined],
      ['solid', 'arrow', 'hollow', 'none', undefined],
      ['solid', 'none', undefined, 'arrow', undefined],
      ['dotted', 'none', undefined, 'arrow', undefined],
      ['dotted', 'none', undefined, 'arrow', 'triangle'],
      ['solid', 'none', undefined, 'none', undefined],
      ['dotted', 'none', undefined, 'none', undefined],
      ['solid', 'circle', undefined, 'none', undefined],
      ['solid', 'arrow', 'triangle', 'arrow', 'triangle'],
    ])
  })

  test('members in a body and after a colon, attributes apart from methods', () => {
    const { nodes } = chart(
      'classDiagram\n  class A {\n    +x int\n    +run()\n  }\n  A : -y\n  A : +stop() bool',
    )
    expect(nodes.map((node) => [node.label, node.parts])).toEqual([
      [
        ['A'],
        [
          ['+x int', '-y'],
          ['+run()', '+stop() bool'],
        ],
      ],
    ])
  })

  test('styles, clicks, links and comments are passed over; the rest is drawn', () => {
    const plain = 'classDiagram\n  A <|-- B'
    const styled = [
      'classDiagram',
      '  classDef hot fill:#f00',
      '  A <|-- B',
      '  cssClass "A" hot',
      '  style B fill:#fff',
      '  click A call cb()',
      '  link B "https://example.com"',
      '  %% a comment',
    ].join('\n')
    expect(draw(styled)).toEqual(draw(plain))
  })
})

describe('what is not drawn', () => {
  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'classDiagram',
      '  class Animal {',
      '    <<abstract>>',
      '    +int age',
      '    +breathe(air) void',
      '  }',
      '  namespace Pond {',
      '    class Duck',
      '  }',
      '  Animal <|-- Duck',
      '  Duck "1" *-- "2" Wing : flies with',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      '• «abstract» Animal',
      '    +int age',
      '    +breathe(air)',
      '      void',
      '• Wing',
      'Pond',
      '  • Duck',
      '«abstract» Animal',
      '  ◁─── Duck',
      'Duck 1 ◆──flies',
      '  with──2 Wing',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    expect(classDiagram.matches('classDiagram')).toBe(true)
    expect(classDiagram.matches('classDiagram-v2')).toBe(true)
    expect(classDiagram.matches('classDiagrams')).toBe(false)
    expect(draw('erDiagram\n  A ||--o{ B : has')).toBeUndefined()
    expect(draw('classDiagram')).toBeUndefined()
    expect(draw('classDiagram\n  <|-- --\n  : x')).toBeUndefined()
    expect(draw('classDiagram\n  A <|-- B', 1)).toBeUndefined()
  })
})
