/**
 * Entity relationship diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: relationships with their crow's feet at the
 *    ends and their labels, identifying and not, an entity's attributes in columns, a direction,
 *    the cardinalities written in words, and an alias.
 * 2. What is read: attributes' keys and comments, and what is passed over.
 * 3. What is not drawn: a diagram too wide is written as an outline; another kind, or text that
 *    is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { erDiagram, parseEr } from './er'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  erDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('relationships: each end its crow’s foot, the label between them', () => {
    const source = [
      'erDiagram',
      '  CUSTOMER ||--o{ ORDER : places',
      '  ORDER ||--|{ LINE-ITEM : contains',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌──────────┐',
      '│ CUSTOMER │',
      '└─────┬────┘',
      '     ||',
      '      │',
      '   places',
      '     o{',
      '      │',
      '  ┌───┴───┐',
      '  │ ORDER │',
      '  └───┬───┘',
      '     ||',
      '      │',
      '  contains',
      '     |{',
      '      │',
      '┌─────┴─────┐',
      '│ LINE-ITEM │',
      '└───────────┘',
    ])
  })

  test('an entity’s attributes as a table: type, name, keys, comment', () => {
    const source = [
      'erDiagram',
      '  CUSTOMER {',
      '    string name PK "full name"',
      '    string email UK',
      '    int age',
      '  }',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───────────────────────────┐',
      '│         CUSTOMER          │',
      '├───────────────────────────┤',
      '│ string name  PK full name │',
      '│ string email UK           │',
      '│ int    age                │',
      '└───────────────────────────┘',
    ])
  })

  test('a relationship that does not identify is dotted', () => {
    expect(draw('erDiagram\n  PERSON }|..|{ CAR : drives')).toEqual([
      '┌────────┐',
      '│ PERSON │',
      '└────┬───┘',
      '    }|',
      '     ┆',
      '     ┆',
      '  drives',
      '     ┆',
      '    |{',
      '     ┆',
      '  ┌──┴──┐',
      '  │ CAR │',
      '  └─────┘',
    ])
  })

  test('across, with the cardinalities written in words', () => {
    expect(draw('erDiagram\n  direction LR\n  A only one to zero or more B : has')).toEqual([
      '┌───┐             ┌───┐',
      '│ A ├||───has──o{─┤ B │',
      '└───┘             └───┘',
    ])
  })

  test('an alias names the box', () => {
    const source = [
      'erDiagram',
      '  p[Person] {',
      '    string name',
      '  }',
      '  p |o--o| PASSPORT : holds',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌─────────────┐',
      '│   Person    │',
      '├─────────────┤',
      '│ string name │',
      '└──────┬──────┘',
      '      |o',
      '       │',
      '     holds',
      '      o|',
      '       │',
      ' ┌─────┴────┐',
      ' │ PASSPORT │',
      ' └──────────┘',
    ])
  })
})

describe('what is read', () => {
  const chart = (source: string) => parseEr(diagramLines(source))!

  test('each cardinality, written as marks or in words, and whether it identifies', () => {
    const { edges } = chart(
      [
        'erDiagram',
        '  A |o--o| B : one',
        '  A }o..o{ B : two',
        '  A }|--|{ B : three',
        '  A one or more optionally to zero or one B : four',
        '  A 1+ to many(0) B : five',
      ].join('\n'),
    )
    expect(edges.map((edge) => [edge.ends, edge.ink, edge.label.join(' ')])).toEqual([
      [{ tail: '|o', head: 'o|' }, 'solid', 'one'],
      [{ tail: '}o', head: 'o{' }, 'dotted', 'two'],
      [{ tail: '}|', head: '|{' }, 'solid', 'three'],
      [{ tail: '}|', head: 'o|' }, 'dotted', 'four'],
      [{ tail: '}|', head: 'o{' }, 'solid', 'five'],
    ])
  })

  test('keys joined, a comment unquoted, a line that is no attribute passed over', () => {
    const { nodes } = chart(
      'erDiagram\n  T {\n    int id PK, FK "the key"\n    varchar(9) code\n    not an attribute here\n  }',
    )
    expect(nodes[0]!.parts).toEqual([['int        id   PK,FK the key', 'varchar(9) code']])
  })

  test('styles and comments are passed over; the rest is drawn', () => {
    const plain = 'erDiagram\n  A ||--o{ B : has'
    const styled = [
      'erDiagram',
      '  classDef hot fill:#f00',
      '  A ||--o{ B : has',
      '  style A fill:#fff',
      '  class B hot',
      '  %% a comment',
    ].join('\n')
    expect(draw(styled)).toEqual(draw(plain))
  })
})

describe('what is not drawn', () => {
  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'erDiagram',
      '  CUSTOMER {',
      '    string name PK "full name"',
      '    int age',
      '  }',
      '  CUSTOMER ||--o{ ORDER : places',
      '  ORDER }|..|{ PRODUCT : lists',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      '• CUSTOMER',
      '    string name PK',
      '      full name',
      '    int age',
      '• ORDER',
      '• PRODUCT',
      'CUSTOMER',
      '  ||──places──o{',
      '  ORDER',
      'ORDER }|┄┄lists┄┄|{',
      '  PRODUCT',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    expect(erDiagram.matches('erDiagram')).toBe(true)
    expect(erDiagram.matches('erDiagrams')).toBe(false)
    expect(draw('classDiagram\n  A <|-- B')).toBeUndefined()
    expect(draw('erDiagram')).toBeUndefined()
    expect(draw('erDiagram\n  ||--o{ : nothing')).toBeUndefined()
    expect(draw('erDiagram\n  A ||--o{ B : has', 1)).toBeUndefined()
  })
})
