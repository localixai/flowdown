/**
 * Requirement diagrams in a terminal.
 *
 * 1. What a small diagram is drawn as, row for row: a requirement and an element with their
 *    fields, a relation, `contains` with its `⊕`, a relation written backwards, and a direction.
 * 2. What is not drawn: a diagram too wide is written as an outline; another kind, or text that
 *    is not one, is null.
 */
import { describe, expect, test } from 'bun:test'
import { lineText } from '../style'
import { requirementDiagram } from './requirement'
import { diagramLines } from './text'

const draw = (source: string, columns = 80): string[] | undefined =>
  requirementDiagram.draw(diagramLines(source), columns)?.map(lineText)

describe('what a diagram is drawn as', () => {
  test('a requirement and an element, their fields under a rule, and a relation', () => {
    const source = [
      'requirementDiagram',
      '  requirement boot {',
      '    id: 1',
      '    text: boots fast',
      '    risk: high',
      '    verifymethod: test',
      '  }',
      '  element kernel {',
      '    type: code',
      '  }',
      '  kernel - satisfies -> boot',
    ].join('\n')
    expect(draw(source)).toEqual([
      '    ┌────────────┐',
      '    │ «Element»  │',
      '    │   kernel   │',
      '    ├────────────┤',
      '    │ Type: code │',
      '    └──────┬─────┘',
      '           ┆',
      '           ┆',
      '      «satisfies»',
      '           ┆',
      '           ▼',
      '┌────────────────────┐',
      '│   «Requirement»    │',
      '│        boot        │',
      '├────────────────────┤',
      '│ Id: 1              │',
      '│ Text: boots fast   │',
      '│ Risk: high         │',
      '│ Verification: test │',
      '└────────────────────┘',
    ])
  })

  test('`contains` solid with `⊕` at what contains, and a relation written backwards', () => {
    const source = [
      'requirementDiagram',
      '  functionalRequirement "login" {',
      '    id: 2',
      '  }',
      '  designConstraint tls {',
      '    id: 3',
      '  }',
      '  login - contains -> tls',
      '  tls <- traces - login',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌──────────────────────────┐',
      '│ «Functional Requirement» │',
      '│          login           │',
      '├──────────────────────────┤',
      '│ Id: 2                    │',
      '└──────────────┬───────────┘',
      '             ⊕ ┆',
      '             │ ┆',
      '         ╭───╯ ╰┄┄┄╮',
      '         │         ┆',
      '    «contains» «traces»',
      '         │         ┆',
      '         ╰───╮ ╭┄┄┄╯',
      '             │ ▼',
      '   ┌─────────┴───────────┐',
      '   │ «Design Constraint» │',
      '   │         tls         │',
      '   ├─────────────────────┤',
      '   │ Id: 3               │',
      '   └─────────────────────┘',
    ])
  })

  test('a direction across', () => {
    const source = [
      'requirementDiagram',
      '  direction LR',
      '  element a {',
      '  }',
      '  element b {',
      '  }',
      '  a - copies -> b',
    ].join('\n')
    expect(draw(source)).toEqual([
      '┌───────────┐              ┌───────────┐',
      '│ «Element» │              │ «Element» │',
      '│     a     ├┄┄┄«copies»┄┄▶│     b     │',
      '└───────────┘              └───────────┘',
    ])
  })
})

describe('what is not drawn', () => {
  test('a diagram too wide for the columns is written as an outline, wrapped to them', () => {
    const source = [
      'requirementDiagram',
      '  requirement boot {',
      '    id: 1',
      '    text: boots in under a second',
      '  }',
      '  element kernel {',
      '    type: code',
      '  }',
      '  kernel - satisfies -> boot',
    ].join('\n')
    expect(draw(source, 20)).toEqual([
      '• «Requirement» boot',
      '    Id: 1',
      '    Text: boots in',
      '      under a second',
      '• «Element» kernel',
      '    Type: code',
      '«Element» kernel',
      '  ┄┄«satisfies»┄┄▶',
      '  «Requirement» boot',
    ])
  })

  test('another kind of diagram, or text that is not one, is null', () => {
    expect(requirementDiagram.matches('requirementDiagram')).toBe(true)
    expect(requirementDiagram.matches('requirement')).toBe(false)
    expect(draw('erDiagram\n  A ||--o{ B : has')).toBeUndefined()
    expect(draw('requirementDiagram')).toBeUndefined()
    expect(draw('requirementDiagram\n  - satisfies ->\n  thing {')).toBeUndefined()
    expect(draw('requirementDiagram\n  a - traces -> b', 1)).toBeUndefined()
  })
})
