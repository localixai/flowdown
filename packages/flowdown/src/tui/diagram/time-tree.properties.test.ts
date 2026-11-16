/**
 * What holds for the diagrams of time and of trees (gantt, timeline, journey, gitGraph, kanban,
 * mindmap, zenuml), over seeded random ones and at every width:
 *
 * 1. Drawing never throws, and a diagram that reads is always drawn (a picture or a list).
 * 2. No row is wider than the columns it was drawn for.
 * 3. Every word of every label is there to read.
 * 4. No control character reaches the terminal, whatever the labels hold.
 * 5. The same source draws the same rows.
 * 6. Big diagrams draw in a small part of a second.
 */
import { describe, expect, test } from 'bun:test'
import { seeded, type Random } from '../../../test/random'
import { lineText, type Line } from '../style'
import { width } from '../width'
import { ganttDiagram } from './gantt'
import { gitGraphDiagram } from './gitgraph'
import { journeyDiagram } from './journey'
import { kanbanDiagram } from './kanban'
import type { DiagramKind } from './kind'
import { indentedLines } from './kit'
import { mindmapDiagram } from './mindmap'
import { timelineDiagram } from './timeline'
import { zenumlDiagram } from './zenuml'

const SEEDS = 300
const WIDTHS = [120, 60, 30, 12]
// Words no longer than the narrowest list's room, so that a word is never cut where it is read.
const WORDS = ['ok', 'Start', 'retry', 'cache', 'Done', '日本語', 'naïve', 'x2', 'deploy', 'queue']
// Written as numbers: the formatter would write a direction override as itself, unseen.
const HOSTILE = [
  `${String.fromCharCode(0x1b)}[2J`,
  String.fromCharCode(0x07),
  String.fromCharCode(0x202e),
  '&lt;x&gt;',
  '#quot;',
]

interface Drawn {
  source: string
  words: string[]
}

const label = (random: Random, count: number): string[] =>
  Array.from({ length: count }, () => random.pick(WORDS))

/** A label of one to three words, now and then with something hostile after them. */
function words(random: Random, into: string[]): string {
  const own = label(random, random.int(1, 3))
  into.push(...own)
  return random.next() < 0.1 ? `${own.join(' ')} ${random.pick(HOSTILE)}` : own.join(' ')
}

function gantt(random: Random): Drawn {
  const out: string[] = []
  const format = random.pick(['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY-MM-DD HH:mm'])
  const date = () => {
    const day = String(random.int(1, 28)).padStart(2, '0')
    const month = String(random.int(1, 12)).padStart(2, '0')
    if (format === 'DD/MM/YYYY') return `${day}/${month}/2024`
    return format === 'YYYY-MM-DD' ? `2024-${month}-${day}` : `2024-${month}-${day} 09:30`
  }
  const lines = ['gantt', `dateFormat ${format}`]
  if (random.next() < 0.5) lines.push(`title ${words(random, out)}`)
  if (random.next() < 0.3) lines.push('excludes weekends')
  if (random.next() < 0.3) lines.push(`axisFormat ${random.pick(['%d %b', '%Y-%m-%d', '%a'])}`)
  const count = random.int(1, 12)
  for (let at = 0; at < count; at++) {
    if (random.next() < 0.2) lines.push(`section ${words(random, out)}`)
    const tags = ['done', 'active', 'crit', 'milestone'].filter(() => random.next() < 0.2)
    const start = at > 0 && random.next() < 0.4 ? `after t${random.int(0, at - 1)}` : date()
    const end = random.pick([`${random.int(0, 20)}d`, `${random.int(1, 3)}w`, '12h', date()])
    const meta = random.next() < 0.7 ? [...tags, `t${at}`, start, end] : [...tags, end]
    lines.push(`${words(random, out)} :${meta.join(', ')}`)
  }
  return { source: lines.join('\n'), words: out }
}

function timeline(random: Random): Drawn {
  const out: string[] = []
  const lines = ['timeline']
  if (random.next() < 0.5) lines.push(`title ${words(random, out)}`)
  for (let at = random.int(1, 10); at > 0; at--) {
    if (random.next() < 0.2) lines.push(`section ${words(random, out)}`)
    const events = Array.from({ length: random.int(0, 3) }, () => words(random, out))
    lines.push([words(random, out), ...events].join(' : '))
    if (random.next() < 0.2) lines.push(`: ${words(random, out)}`)
  }
  return { source: lines.join('\n'), words: out }
}

function journey(random: Random): Drawn {
  const out: string[] = []
  const lines = ['journey']
  if (random.next() < 0.5) lines.push(`title ${words(random, out)}`)
  for (let at = random.int(1, 10); at > 0; at--) {
    if (random.next() < 0.3) lines.push(`section ${words(random, out)}`)
    const actors = Array.from({ length: random.int(0, 3) }, () => words(random, out))
    lines.push(`${words(random, out)}: ${random.int(0, 6)}: ${actors.join(', ')}`)
  }
  return { source: lines.join('\n'), words: out }
}

function gitGraph(random: Random): Drawn {
  const out: string[] = ['main']
  const lines = [random.pick(['gitGraph', 'gitGraph LR:', 'gitGraph BT:', 'gitGraph TB:'])]
  const branches = ['main']
  const ids: string[] = []
  for (let step = random.int(1, 25); step > 0; step--) {
    const roll = random.next()
    if (roll < 0.15 && branches.length < 6) {
      const name = `${random.pick(WORDS.filter((word) => /^[a-z]+$/.test(word)))}${branches.length}`
      branches.push(name)
      out.push(name)
      lines.push(`branch ${name}`)
    } else if (roll < 0.3) lines.push(`checkout ${random.pick(branches)}`)
    else if (roll < 0.4) lines.push(`merge ${random.pick(branches)}`)
    else if (roll < 0.45 && ids.length > 0) lines.push(`cherry-pick id: "${random.pick(ids)}"`)
    else {
      const parts = ['commit']
      if (random.next() < 0.5) {
        const id = `${random.pick(WORDS)}${ids.length}`
        ids.push(id)
        out.push(id)
        parts.push(`id: "${id}"`)
      }
      if (random.next() < 0.2) parts.push(`tag: "v${ids.length}"`)
      if (random.next() < 0.3) parts.push(`msg: "${words(random, out)}"`)
      if (random.next() < 0.2) parts.push(`type: ${random.pick(['HIGHLIGHT', 'REVERSE'])}`)
      lines.push(parts.join(' '))
    }
  }
  lines.push('commit')
  return { source: lines.join('\n'), words: out }
}

function kanban(random: Random): Drawn {
  const out: string[] = []
  const lines = ['kanban']
  for (let column = random.int(1, 6); column > 0; column--) {
    lines.push(`  c${column}[${words(random, out)}]`)
    for (let card = random.int(0, 4); card > 0; card--) {
      const meta: string[] = []
      if (random.next() < 0.3) meta.push(`assigned: '${words(random, out)}'`)
      if (random.next() < 0.2) meta.push(`priority: '${random.pick(['High', 'Low', 'Very High'])}'`)
      const own = meta.length > 0 ? `@{ ${meta.join(', ')} }` : ''
      lines.push(`    k${column}${card}[${words(random, out)}]${own}`)
    }
  }
  return { source: lines.join('\n'), words: out }
}

function mindmap(random: Random): Drawn {
  const out: string[] = []
  const shapes = ['[%]', '(%)', '((%))', '))%((', '{{%}}', '%']
  const lines = ['mindmap', `  root((${words(random, out)}))`]
  let depth = 1
  for (let at = random.int(0, 30); at > 0; at--) {
    depth = Math.max(1, Math.min(8, depth + random.int(-2, 1)))
    if (random.next() < 0.1) lines.push(`${'  '.repeat(depth + 1)}::icon(fa fa-book)`)
    const shape = random.pick(shapes)
    const text = words(random, out)
    lines.push(
      `${'  '.repeat(depth + 1)}n${at}${shape === '%' ? '' : ''}${shape.replace('%', text)}`,
    )
  }
  return { source: lines.join('\n'), words: out }
}

function zenuml(random: Random): Drawn {
  const names = Array.from(
    { length: random.int(1, 5) },
    (_, at) => `${random.pick(WORDS.slice(1, 5))}${at}`,
  )
  const lines = [
    'zenuml',
    ...names.map((name) => `${random.pick(['@Actor', '@Database', ''])} ${name}`.trim()),
  ]
  let open = 0
  for (let step = random.int(0, 20); step > 0; step--) {
    const roll = random.next()
    const who = () => random.pick(names)
    if (roll < 0.15) {
      lines.push(`${random.pick(['if (ok)', 'while (more)', 'opt', 'try'])} {`)
      open++
    } else if (roll < 0.25 && open > 0) {
      lines.push(random.pick(['}', '} else {']))
      if (lines.at(-1) === '}') open--
    } else if (roll < 0.4) lines.push(`${who()}->${who()}: ${label(random, 2).join(' ')}`)
    else if (roll < 0.5) lines.push(`return ${random.pick(WORDS)}`)
    else {
      const call = `${who()}.${random.pick(['get', 'put', 'run'])}(${random.pick(['', 'x', 'a, b'])})`
      const assigned = random.next() < 0.3 ? `r = ${call}` : call
      if (random.next() < 0.3) {
        lines.push(`${assigned} {`)
        open++
      } else lines.push(assigned)
    }
  }
  return { source: lines.join('\n'), words: names }
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

function holds(kind: DiagramKind, drawn: Drawn): void {
  const lines = indentedLines(drawn.source)
  expect(kind.matches(lines[0]!.trim())).toBe(true)
  for (const columns of WIDTHS) {
    const rows = kind.draw(lines, columns)
    expect(rows === null ? `null at ${columns}: ${drawn.source}` : null).toBeNull()
    const texts = (rows as Line[]).map(lineText)
    const wide = texts.find((text) => width(text) > columns)
    expect(wide === undefined ? undefined : `${columns}: ${wide}`).toBeUndefined()
    expect(texts.find(control)).toBeUndefined()
    // A word a list wraps is cut only at the end of a row: with the spaces gone, it is whole.
    const flat = texts.join('').replace(/\s+/g, '')
    const missing = drawn.words.filter((word) => !flat.includes(word))
    expect(missing.length > 0 ? `${columns}: ${missing.join(', ')}\n${texts.join('\n')}` : '').toBe(
      '',
    )
    expect(kind.draw(lines, columns)).toEqual(rows)
  }
}

const KINDS: Array<[string, DiagramKind, (random: Random) => Drawn]> = [
  ['gantt', ganttDiagram, gantt],
  ['timeline', timelineDiagram, timeline],
  ['journey', journeyDiagram, journey],
  ['gitGraph', gitGraphDiagram, gitGraph],
  ['kanban', kanbanDiagram, kanban],
  ['mindmap', mindmapDiagram, mindmap],
  ['zenuml', zenumlDiagram, zenuml],
]

describe('any diagram', () => {
  for (const [name, kind, make] of KINDS)
    test(name, () => {
      for (let seed = 1; seed <= SEEDS; seed++) holds(kind, make(seeded(seed)))
    })

  test('any text after a header: never throws, never too wide, never a control character', () => {
    const pieces = [
      'A',
      ' ',
      '\n',
      '  ',
      ':',
      ',',
      '[',
      ']',
      '(',
      ')',
      '{',
      '}',
      '"',
      '@{ ',
      'after ',
      'section ',
      'commit ',
      'branch ',
      'merge ',
      'id: ',
      '->',
      '.',
      '3d',
      '2024-01-01',
      '\u001b',
      '日',
      '%%',
    ]
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = seeded(seed)
      for (const [name, kind] of KINDS) {
        let source = `${name}\n`
        for (let size = random.int(1, 60); size > 0; size--) source += random.pick(pieces)
        for (const columns of WIDTHS) {
          const rows = kind.draw(indentedLines(source), columns) ?? []
          for (const text of rows.map(lineText)) {
            expect(width(text)).toBeLessThanOrEqual(columns)
            expect(control(text)).toBe(false)
          }
        }
      }
    }
  })
})

describe('time', () => {
  const timed = (kind: DiagramKind, source: string, columns: number) => {
    const start = performance.now()
    const rows = kind.draw(indentedLines(source), columns)
    return { rows, ms: performance.now() - start }
  }

  const big: Array<[string, DiagramKind, string]> = [
    [
      'a gantt chart of 500 tasks, each after the one before',
      ganttDiagram,
      [
        'gantt',
        'excludes weekends',
        'Task 0 :t0, 2024-01-01, 3d',
        ...Array.from({ length: 499 }, (_, at) => `Task ${at + 1} :t${at + 1}, after t${at}, 2d`),
      ].join('\n'),
    ],
    [
      'a gantt chart whose tasks all name one written after them',
      ganttDiagram,
      [
        'gantt',
        ...Array.from({ length: 400 }, (_, at) => `Task ${at} :t${at}, after t${at + 1}, 1d`),
        'Last :t400, 2024-01-01, 1d',
      ].join('\n'),
    ],
    [
      'a timeline of 1000 periods',
      timelineDiagram,
      ['timeline', ...Array.from({ length: 1000 }, (_, at) => `${at} : event ${at} : more`)].join(
        '\n',
      ),
    ],
    [
      'a journey of 1000 tasks',
      journeyDiagram,
      [
        'journey',
        ...Array.from({ length: 1000 }, (_, at) => `Task ${at}: ${at % 6}: Me, You`),
      ].join('\n'),
    ],
    [
      'a git graph of 900 commits over 30 branches, across',
      gitGraphDiagram,
      [
        'gitGraph LR:',
        ...Array.from({ length: 30 }, (_, at) => [
          `branch b${at}`,
          ...Array.from({ length: 29 }, (__, own) => `commit id: "c${at}-${own}"`),
          'checkout main',
          `merge b${at}`,
          `cherry-pick id: "c${at}-0"`,
        ]).flat(),
      ].join('\n'),
    ],
    [
      'a git graph of 900 commits over 30 branches',
      gitGraphDiagram,
      [
        'gitGraph',
        ...Array.from({ length: 30 }, (_, at) => [
          `branch b${at}`,
          ...Array.from({ length: 29 }, (__, own) => `commit id: "c${at}-${own}"`),
          'checkout main',
          `merge b${at}`,
        ]).flat(),
      ].join('\n'),
    ],
    [
      'a kanban board of 1000 cards',
      kanbanDiagram,
      [
        'kanban',
        ...Array.from({ length: 10 }, (_, at) => [
          `  c${at}[Column ${at}]`,
          ...Array.from(
            { length: 100 },
            (__, own) => `    k${at}-${own}[Card ${own}]@{ assigned: 'me' }`,
          ),
        ]).flat(),
      ].join('\n'),
    ],
    [
      'a mindmap 1500 deep',
      mindmapDiagram,
      ['mindmap', ...Array.from({ length: 1500 }, (_, at) => `${' '.repeat(at)}n${at}`)].join('\n'),
    ],
    [
      'a zenuml diagram of 1000 nested calls',
      zenumlDiagram,
      [
        'zenuml',
        ...Array.from({ length: 1000 }, (_, at) => `P${at % 7}.call${at}() {`),
        ...Array.from({ length: 1000 }, () => '}'),
      ].join('\n'),
    ],
  ]

  for (const [name, kind, source] of big)
    test(name, () => {
      for (const columns of [200, 80, 20]) {
        const { rows, ms } = timed(kind, source, columns)
        expect(ms).toBeLessThan(1000)
        for (const text of (rows ?? []).map(lineText))
          expect(width(text)).toBeLessThanOrEqual(columns)
      }
    })
})
