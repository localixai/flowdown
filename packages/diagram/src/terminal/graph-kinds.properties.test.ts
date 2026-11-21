/**
 * What holds for the diagrams laid out on the flowchart's layers and for block diagrams, over
 * seeded random ones of each kind and at every width:
 *
 * 1. Drawing never throws, and a diagram that reads is always drawn (a picture or an outline).
 * 2. No row is wider than the columns it was drawn for.
 * 3. Every name and every label's words are there to read.
 * 4. No control character reaches the terminal, whatever the labels hold.
 * 5. The same source draws the same rows.
 * 6. Big diagrams draw in a small part of a second.
 */
import { describe, expect, test } from 'bun:test'
import { seeded, type Random } from '../../test/random'
import { lineText, type Line } from '../style'
import { width } from '../width'
import { architectureDiagram } from './architecture'
import { blockDiagram } from './block'
import { c4Diagram } from './c4'
import { classDiagram } from './class'
import { erDiagram } from './er'
import type { DiagramKind } from './kind'
import { requirementDiagram } from './requirement'
import { stateDiagram } from './state'
import { diagramLines } from './text'

const SEEDS = 250
const WIDTHS = [120, 60, 30, 12]
// Words no longer than the narrowest outline's room, so that a word is never cut where it is read.
const WORDS = ['ok', 'Start', 'retry', 'cache', 'Done', '日本語', 'naïve', 'x2', 'deploy', 'queue']
// Written as numbers: the formatter would write a direction override as itself, unseen.
const HOSTILE = [
  `${String.fromCharCode(0x1b)}[2J`,
  String.fromCharCode(0x07),
  String.fromCharCode(0x202e),
  '&lt;x&gt;',
  '#quot;',
  '\t',
]

interface Case {
  source: string
  words: string[]
}

const say = (random: Random, count: number): string[] =>
  Array.from({ length: count }, () => random.pick(WORDS))

/** A label's words, with something hostile among them now and then: it must come out harmless. */
const phrase = (random: Random, words: string[]): string =>
  [...words, random.next() < 0.1 ? random.pick(HOSTILE) : ''].join(' ').trim()

function state(random: Random): Case {
  const count = random.int(1, 10)
  const names = Array.from({ length: count }, () => say(random, random.int(1, 2)))
  const words: string[] = names.flat()
  const lines = ['stateDiagram-v2']
  if (random.next() < 0.3) lines.push(`direction ${random.pick(['LR', 'TB', 'BT', 'RL'])}`)
  names.forEach((own, at) => lines.push(`state "${phrase(random, own)}" as s${at}`))
  let open = 0
  for (let step = random.int(0, 2 * count); step > 0; step--) {
    const who = () => (random.next() < 0.15 ? '[*]' : `s${random.int(0, count - 1)}`)
    const roll = random.next()
    if (roll < 0.08 && open < 3) {
      const title = say(random, 1)
      words.push(...title)
      lines.push(`state "${title[0]}" as g${step} {`)
      open++
    } else if (roll < 0.14 && open > 0) {
      lines.push('}')
      open--
    } else if (roll < 0.18 && open > 0) lines.push('--')
    else if (roll < 0.22)
      lines.push(`state c${step} <<${random.pick(['choice', 'fork', 'join'])}>>`, `s0 --> c${step}`)
    else if (roll < 0.28) {
      const note = say(random, random.int(1, 3))
      words.push(...note)
      lines.push(
        `note ${random.pick(['left', 'right'])} of s${random.int(0, count - 1)} : ${phrase(random, note)}`,
      )
    } else if (roll < 0.34) {
      const description = say(random, random.int(1, 2))
      words.push(...description)
      lines.push(`s${random.int(0, count - 1)} : ${phrase(random, description)}`)
    } else {
      const label = say(random, random.int(0, 2))
      words.push(...label)
      lines.push(`${who()} --> ${who()}${label.length ? ` : ${phrase(random, label)}` : ''}`)
    }
  }
  while (open-- > 0) lines.push('}')
  return { source: lines.join('\n'), words }
}

function classes(random: Random): Case {
  const count = random.int(1, 9)
  const words: string[] = []
  const lines = ['classDiagram']
  if (random.next() < 0.3) lines.push(`direction ${random.pick(['LR', 'TB', 'BT', 'RL'])}`)
  let namespace = false
  for (let at = 0; at < count; at++) {
    if (!namespace && random.next() < 0.15) {
      lines.push(`namespace N${at} {`)
      namespace = true
    }
    words.push(`C${at}`)
    const members = Array.from({ length: random.int(0, 3) }, () => {
      const word = random.pick(WORDS)
      words.push(word)
      return random.next() < 0.5 ? `+${word}()` : `-int ${word}`
    })
    if (random.next() < 0.2) lines.push(`<<${random.pick(['interface', 'abstract'])}>> C${at}`)
    if (members.length && random.next() < 0.5) lines.push(`class C${at} {`, ...members, '}')
    else {
      lines.push(`class C${at}${random.next() < 0.2 ? '~T~' : ''}`)
      for (const own of members) lines.push(`C${at} : ${own}`)
    }
    if (namespace && random.next() < 0.4) {
      lines.push('}')
      namespace = false
    }
  }
  if (namespace) lines.push('}')
  const arrows = ['<|--', '*--', 'o--', '-->', '..>', '..|>', '--', '..', '<|--|>', '()--']
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const label = say(random, random.int(0, 2))
    const many =
      random.next() < 0.3 ? [random.pick(['1', '*', '0..1']), random.pick(['1', 'many'])] : null
    words.push(...label, ...(many ?? []))
    const from = `C${random.int(0, count - 1)}`
    const to = `C${random.int(0, count - 1)}`
    const arrow = random.pick(arrows)
    lines.push(
      `${from} ${many ? `"${many[0]}" ` : ''}${arrow}${many ? ` "${many[1]}"` : ''} ${to}${label.length ? ` : ${phrase(random, label)}` : ''}`,
    )
  }
  if (random.next() < 0.2) {
    const note = say(random, 2)
    words.push(...note)
    lines.push(`note for C0 "${note.join(' ')}"`)
  }
  return { source: lines.join('\n'), words }
}

function entities(random: Random): Case {
  const count = random.int(1, 8)
  const words: string[] = []
  const lines = ['erDiagram']
  for (let at = 0; at < count; at++) {
    words.push(`E${at}`)
    if (random.next() < 0.6) {
      lines.push(`E${at} {`)
      for (let row = random.int(0, 3); row > 0; row--) {
        const [type, name] = say(random, 2)
        const comment = random.next() < 0.3 ? random.pick(WORDS) : ''
        words.push(type!, name!, ...(comment ? [comment] : []))
        lines.push(
          `  ${type} ${name}${random.next() < 0.3 ? ' PK' : ''}${comment ? ` "${comment}"` : ''}`,
        )
      }
      lines.push('}')
    } else lines.push(`E${at}`)
  }
  const lefts = ['|o', '||', '}o', '}|']
  const rights = ['o|', '||', 'o{', '|{']
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const label = say(random, random.int(1, 2))
    words.push(...label)
    const line = random.pick(['--', '..'])
    lines.push(
      random.next() < 0.2
        ? `E${random.int(0, count - 1)} only one to zero or more E${random.int(0, count - 1)} : "${phrase(random, label)}"`
        : `E${random.int(0, count - 1)} ${random.pick(lefts)}${line}${random.pick(rights)} E${random.int(0, count - 1)} : "${phrase(random, label)}"`,
    )
  }
  return { source: lines.join('\n'), words }
}

function requirements(random: Random): Case {
  const count = random.int(1, 6)
  const words: string[] = []
  const lines = ['requirementDiagram']
  for (let at = 0; at < count; at++) {
    words.push(`r${at}`)
    if (random.next() < 0.6) {
      const said = say(random, 2)
      words.push(...said)
      lines.push(
        `requirement r${at} {`,
        `id: ${at}`,
        `text: ${phrase(random, said)}`,
        'risk: high',
        '}',
      )
    } else {
      const kind = random.pick(WORDS)
      words.push(kind)
      lines.push(`element r${at} {`, `type: ${kind}`, '}')
    }
  }
  const kinds = ['contains', 'copies', 'derives', 'satisfies', 'verifies', 'refines', 'traces']
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const kind = random.pick(kinds)
    words.push(`«${kind}»`)
    const [a, b] = [random.int(0, count - 1), random.int(0, count - 1)]
    lines.push(random.next() < 0.5 ? `r${a} - ${kind} -> r${b}` : `r${a} <- ${kind} - r${b}`)
  }
  return { source: lines.join('\n'), words }
}

function c4(random: Random): Case {
  const count = random.int(1, 7)
  const words: string[] = []
  const lines = [
    random.pick(['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment']),
  ]
  if (random.next() < 0.3) {
    const title = say(random, 2)
    words.push(...title)
    lines.push(`title ${title.join(' ')}`)
  }
  let open = 0
  for (let at = 0; at < count; at++) {
    if (random.next() < 0.15 && open < 2) {
      const title = random.pick(WORDS)
      words.push(title)
      lines.push(
        `${random.pick(['Boundary', 'System_Boundary', 'Enterprise_Boundary', 'Deployment_Node'])}(b${at}, "${title}") {`,
      )
      open++
    }
    const kind = random.pick([
      'Person',
      'System',
      'Container',
      'Component',
      'SystemDb',
      'ContainerQueue',
      'Person_Ext',
      'System_Ext',
    ])
    const label = say(random, random.int(1, 2))
    const description = say(random, random.int(0, 3))
    words.push(...label, ...description)
    const technical = /Container|Component/.test(kind)
    lines.push(
      `${kind}(e${at}, "${phrase(random, label)}"${technical ? ', "tech"' : ''}, "${description.join(' ')}")`,
    )
    if (open > 0 && random.next() < 0.3) {
      lines.push('}')
      open--
    }
  }
  while (open-- > 0) lines.push('}')
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const label = say(random, random.int(1, 2))
    words.push(...label)
    lines.push(
      `${random.pick(['Rel', 'BiRel', 'Rel_Back', 'Rel_D', 'Rel_U', 'Rel_Up', 'Rel_L', 'Rel_Right'])}(e${random.int(0, count - 1)}, e${random.int(0, count - 1)}, "${label.join(' ')}")`,
    )
  }
  return { source: lines.join('\n'), words }
}

function architecture(random: Random): Case {
  const count = random.int(1, 8)
  const words: string[] = []
  const lines = ['architecture-beta']
  const groups: string[] = []
  for (let at = 0; at < random.int(0, 2); at++) {
    const title = random.pick(WORDS)
    words.push(title)
    lines.push(
      `group g${at}(cloud)[${title}]${groups.length && random.next() < 0.5 ? ` in ${groups[0]}` : ''}`,
    )
    groups.push(`g${at}`)
  }
  for (let at = 0; at < count; at++) {
    const where = groups.length && random.next() < 0.5 ? ` in ${random.pick(groups)}` : ''
    if (random.next() < 0.15) lines.push(`junction s${at}${where}`)
    else {
      const title = say(random, random.int(1, 2))
      words.push(...title)
      lines.push(`service s${at}(server)[${phrase(random, title)}]${where}`)
    }
  }
  const sides = ['L', 'R', 'T', 'B']
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const label = random.next() < 0.2 ? random.pick(WORDS) : ''
    if (label) words.push(label)
    const [tail, head] = [random.pick(['', '<']), random.pick(['', '>'])]
    const to =
      groups.length && random.next() < 0.1
        ? `${random.pick(groups)}{group}`
        : `s${random.int(0, count - 1)}`
    lines.push(
      `s${random.int(0, count - 1)}:${random.pick(sides)} ${tail}-${label ? `[${label}]` : ''}-${head} ${random.pick(sides)}:${to}`,
    )
  }
  return { source: lines.join('\n'), words }
}

function blocks(random: Random): Case {
  const count = random.int(1, 10)
  const words: string[] = []
  const lines = ['block-beta']
  if (random.next() < 0.7) lines.push(`columns ${random.int(1, 4)}`)
  let open = 0
  let row: string[] = []
  const flush = () => {
    if (row.length) lines.push(row.join(' '))
    row = []
  }
  for (let at = 0; at < count; at++) {
    const roll = random.next()
    if (roll < 0.1 && open < 2) {
      flush()
      lines.push(
        `block:g${at}${random.next() < 0.5 ? `:${random.int(1, 3)}` : ''}`,
        `columns ${random.int(1, 3)}`,
      )
      open++
    } else if (roll < 0.18 && open > 0) {
      flush()
      lines.push('end')
      open--
    }
    if (random.next() < 0.1) row.push(random.pick(['space', 'space:2']))
    const label = say(random, random.int(1, 2))
    words.push(...label)
    const shape = random.pick(['["%"]', '("%")', '(["%"])', '[("%")]', '{"%"}', '<["%"]>(right)'])
    row.push(
      `b${at}${shape.replace('%', phrase(random, label))}${random.next() < 0.2 ? `:${random.int(1, 3)}` : ''}`,
    )
  }
  flush()
  while (open-- > 0) lines.push('end')
  for (let edge = random.int(0, count); edge > 0; edge--) {
    const label = random.next() < 0.3 ? random.pick(WORDS) : ''
    if (label) words.push(label)
    lines.push(
      `b${random.int(0, count - 1)} ${label ? `-- "${label}" -->` : random.pick(['-->', '---', '-.->'])} b${random.int(0, count - 1)}`,
    )
  }
  return { source: lines.join('\n'), words }
}

/** Whether `text` holds a character a terminal acts on: a control, or a mark that reorders text. */
const control = (text: string): boolean =>
  [...text].some((char) => {
    const code = char.codePointAt(0)!
    return (
      code < 0x20 ||
      (code >= 0x7f && code < 0xa0) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    )
  })

function holds(kind: DiagramKind, { source, words }: Case): void {
  const lines = diagramLines(source)
  expect(kind.matches(lines[0]!)).toBe(true)
  for (const columns of WIDTHS) {
    let rows: Line[] | null = null
    expect(() => {
      rows = kind.draw(lines, columns)
    }).not.toThrow()
    expect(rows).not.toBeNull()
    const texts = (rows as unknown as Line[]).map(lineText)
    const wide = texts.find((one) => width(one) > columns)
    expect(wide === undefined ? undefined : `${columns}: ${wide}`).toBeUndefined()
    expect(texts.find(control)).toBeUndefined()
    // A word an outline wraps is cut only at the end of a row: with the spaces gone, it is whole.
    const flat = texts.join('').replace(/\s+/g, '')
    const missing = words.filter((word) => !flat.includes(word))
    expect(missing.length ? `${columns}: ${missing.join(' ')}\n${source}` : '').toBe('')
    expect(kind.draw(lines, columns)).toEqual(rows)
  }
}

const KINDS: Array<[string, DiagramKind, (random: Random) => Case]> = [
  ['state diagrams', stateDiagram, state],
  ['class diagrams', classDiagram, classes],
  ['entity relationship diagrams', erDiagram, entities],
  ['requirement diagrams', requirementDiagram, requirements],
  ['C4 diagrams', c4Diagram, c4],
  ['architecture diagrams', architectureDiagram, architecture],
  ['block diagrams', blockDiagram, blocks],
]

describe('any diagram of the graph kinds', () => {
  for (const [name, kind, make] of KINDS)
    test(name, () => {
      for (let seed = 1; seed <= SEEDS; seed++) holds(kind, make(seeded(seed)))
    })

  test('any text after a header: never throws, never too wide, never a control character', () => {
    const pieces = [
      'A',
      'B',
      '-->',
      '--',
      '..',
      '<|',
      '|>',
      '*',
      'o',
      '{',
      '}',
      '[',
      ']',
      '(',
      ')',
      '"',
      ' ',
      '\n',
      ':',
      ',',
      '[*]',
      'state ',
      'class ',
      'note ',
      '<<choice>>',
      '||',
      'o{',
      'Rel(',
      'service ',
      'group ',
      ':R',
      'L:',
      'block',
      'end',
      'columns 2',
      'space',
      '~',
      '\u001b',
      '日',
      '%%',
      '--',
    ]
    const headers = [
      'stateDiagram-v2',
      'classDiagram',
      'erDiagram',
      'requirementDiagram',
      'C4Context',
      'architecture-beta',
      'block-beta',
    ]
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = seeded(seed)
      const header = random.pick(headers)
      let source = `${header}\n`
      for (let size = random.int(1, 60); size > 0; size--) source += random.pick(pieces)
      const kind = KINDS.find(([, own]) => own.matches(header))![1]
      for (const columns of WIDTHS) {
        const rows = kind.draw(diagramLines(source), columns) ?? []
        for (const one of rows.map(lineText)) {
          expect(width(one)).toBeLessThanOrEqual(columns)
          expect(control(one)).toBe(false)
        }
      }
    }
  })
})

describe('time', () => {
  const timed = (kind: DiagramKind, source: string, columns: number) => {
    const start = performance.now()
    const rows = kind.draw(diagramLines(source), columns)
    return { rows, ms: performance.now() - start }
  }

  test('a chain of 300 states, and of 300 classes, is drawn at once', () => {
    const states = [
      'stateDiagram-v2',
      ...Array.from({ length: 300 }, (_, at) => `s${at} --> s${at + 1}`),
    ]
    const hierarchy = [
      'classDiagram',
      ...Array.from({ length: 300 }, (_, at) => `C${at} <|-- C${at + 1} : is`),
    ]
    for (const [kind, source] of [
      [stateDiagram, states],
      [classDiagram, hierarchy],
    ] as const) {
      const { rows, ms } = timed(kind, source.join('\n'), 120)
      expect(rows).not.toBeNull()
      expect(ms).toBeLessThan(1000)
    }
  })

  test('dense graphs of 60 entities and 60 services, wide and narrow', () => {
    const random = seeded(11)
    const er = ['erDiagram']
    const services = ['architecture-beta']
    for (let node = 0; node < 60; node++) {
      services.push(`service s${node}(server)[S${node}]`)
      for (let edge = 0; edge < 4; edge++) {
        er.push(`E${node} ||--o{ E${random.int(0, 59)} : has`)
        services.push(`s${node}:R --> L:s${random.int(0, 59)}`)
      }
    }
    for (const [kind, source] of [
      [erDiagram, er],
      [architectureDiagram, services],
    ] as const)
      for (const columns of [1000, 120]) {
        const { rows, ms } = timed(kind, source.join('\n'), columns)
        expect(rows).not.toBeNull()
        expect(ms).toBeLessThan(1000)
      }
  })

  test('a grid of 2000 blocks, and 3000 lines of members, are bounded', () => {
    const grid = [
      'block-beta',
      'columns 40',
      ...[...Array(50).keys()].map((row) =>
        [...Array(40).keys()].map((at) => `b${row}_${at}`).join(' '),
      ),
    ]
    const members = [
      'classDiagram',
      ...Array.from({ length: 3000 }, (_, at) => `C${at % 10} : +field${at}`),
    ]
    for (const [kind, source] of [
      [blockDiagram, grid],
      [classDiagram, members],
    ] as const)
      expect(timed(kind, source.join('\n'), 120).ms).toBeLessThan(1000)
  })
})
