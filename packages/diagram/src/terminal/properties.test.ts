/**
 * What holds for any diagram, over seeded random ones of both kinds and at every width:
 *
 * 1. Drawing never throws, and a diagram that reads is always drawn (a picture or an outline).
 * 2. No row is wider than the columns it was drawn for.
 * 3. Every node's and participant's words are there to read.
 * 4. No control character reaches the terminal, whatever the labels hold.
 * 5. The same source draws the same rows.
 * 6. Big diagrams draw in a small part of a second.
 */
import { describe, expect, test } from 'bun:test'
import { seeded, type Random } from '../../test/random'
import { lineText, type Line } from '../style'
import { width } from '../width'
import { drawDiagram } from './index'

const SEEDS = 400
const WIDTHS = [120, 60, 30, 12]
// Words no longer than the narrowest outline's room, so that a word is never cut where it is read.
const WORDS = ['ok', 'Start', 'retry', 'cache', 'Done', '日本語', 'naïve', 'x2', 'deploy', 'queue']
// Written as numbers: the formatter would write a direction override as itself, unseen.
const HOSTILE = [
  `${String.fromCharCode(0x1b)}[2J`,
  String.fromCharCode(0x07),
  String.fromCharCode(0x202e),
  'a<br>b',
  '#quot;',
  '&lt;x&gt;',
  '\t',
]

const label = (random: Random, count: number): string[] =>
  Array.from({ length: count }, () => random.pick(WORDS))

/** A flowchart, with the words of each node's label; a node's words are its id when it has none. */
function flowchart(random: Random): { source: string; words: string[] } {
  const count = random.int(1, 14)
  const labels = Array.from({ length: count }, () => label(random, random.int(0, 3)))
  const shapes = ['[%]', '(%)', '([%])', '((%))', '{%}', '[[%]]', '[(%)]', '>%]', '["%"]']
  const links = ['-->', '---', '-.->', '==>', '--x', '--o', '<-->', '-->|%|', '-- % -->']
  const name = (at: number) => {
    const words = labels[at]!
    return words.length ? random.pick(shapes).replace('%', words.join(' ')) : ''
  }
  const lines = [`flowchart ${random.pick(['TD', 'TB', 'BT', 'LR', 'RL'])}`]
  let open = 0
  for (let at = 0; at < count; at++) lines.push(`n${at}${name(at)}`)
  for (let edge = random.int(0, 2 * count); edge > 0; edge--) {
    const roll = random.next()
    if (roll < 0.08) {
      lines.push(`subgraph g${edge} [${random.pick(WORDS)}]`)
      open++
    } else if (roll < 0.14 && open > 0) {
      lines.push('end')
      open--
    } else if (roll < 0.18)
      lines.push(random.pick(['classDef a fill:#f00', 'style n0 fill:#fff', '%% note']))
    else {
      const link = random.pick(links).replace('%', random.pick([...WORDS, ...HOSTILE]))
      const also = random.next() < 0.2 ? ` & n${random.int(0, count - 1)}` : ''
      lines.push(`n${random.int(0, count - 1)}${also} ${link} n${random.int(0, count - 1)}`)
    }
  }
  if (random.next() < 0.3) lines.push(`n0[${random.pick(HOSTILE)} ${labels[0]!.join(' ') || 'n0'}]`)
  const words = labels.flatMap((own, at) => (own.length ? own : [`n${at}`]))
  return { source: lines.join('\n'), words }
}

/** A sequence diagram, with the words of each participant's name. */
function sequence(random: Random): { source: string; words: string[] } {
  const count = random.int(1, 6)
  const names = Array.from({ length: count }, () => label(random, random.int(1, 2)))
  const lines = ['sequenceDiagram']
  if (random.next() < 0.3) lines.push('autonumber')
  names.forEach((words, at) =>
    lines.push(`${random.pick(['participant', 'actor'])} P${at} as ${words.join(' ')}`),
  )
  const arrows = ['->>', '-->>', '->', '-->', '-x', '--x', '-)', '--)', '<<->>']
  let open = 0
  for (let step = random.int(0, 20); step > 0; step--) {
    const who = () => `P${random.int(0, count - 1)}`
    const text = [
      ...label(random, random.int(0, 4)),
      random.next() < 0.1 ? random.pick(HOSTILE) : '',
    ].join(' ')
    const roll = random.next()
    if (roll < 0.1) {
      lines.push(`${random.pick(['loop', 'alt', 'opt', 'par', 'critical', 'break'])} ${text}`)
      open++
    } else if (roll < 0.15 && open > 0) lines.push(random.pick(['else', 'and']) + ` ${text}`)
    else if (roll < 0.2 && open > 0) {
      lines.push('end')
      open--
    } else if (roll < 0.3) {
      const side = random.pick(['left of', 'right of', 'over'])
      const second = side === 'over' && random.next() < 0.5 ? `,${who()}` : ''
      lines.push(`Note ${side} ${who()}${second}: ${text}`)
    } else if (roll < 0.35) lines.push(`${random.pick(['activate', 'deactivate'])} ${who()}`)
    else {
      const suffix = random.pick(['', '', '+', '-'])
      lines.push(`${who()}${random.pick(arrows)}${suffix}${who()}: ${text}`)
    }
  }
  return { source: lines.join('\n'), words: names.flat() }
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

function holds(source: string, words: string[]): void {
  for (const columns of WIDTHS) {
    const rows = drawDiagram(source, columns)
    // A drawing that threw is caught and given as null: null here is a fault found.
    expect(rows).not.toBeNull()
    const texts = (rows as Line[]).map(lineText)
    const wide = texts.find((text) => width(text) > columns)
    expect(wide === undefined ? undefined : `${columns}: ${wide}`).toBeUndefined()
    expect(texts.find(control)).toBeUndefined()
    // A word an outline wraps is cut only at the end of a row: with the spaces gone, it is whole.
    const flat = texts.join('').replace(/\s+/g, '')
    expect(words.filter((word) => !flat.includes(word))).toEqual([])
    expect(drawDiagram(source, columns)).toEqual(rows)
  }
}

describe('any diagram', () => {
  test('flowcharts', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { source, words } = flowchart(seeded(seed))
      holds(source, words)
    }
  })

  test('sequence diagrams', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { source, words } = sequence(seeded(seed))
      holds(source, words)
    }
  })

  test('any text after a header: never throws, never too wide, never a control character', () => {
    const pieces = [
      'A',
      'B',
      '-->',
      '--',
      '|',
      '[',
      ']',
      '(',
      '{',
      '"',
      ' ',
      '\n',
      ';',
      '&',
      'end',
      'subgraph ',
      ':',
      '->>',
      'Note over ',
      'loop ',
      'activate ',
      '->>+',
      '-->>-',
      '\u001b',
      '日',
      '%%',
      'x',
    ]
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = seeded(seed)
      let source = random.pick(['flowchart LR\n', 'graph TD\n', 'sequenceDiagram\n'])
      for (let size = random.int(1, 60); size > 0; size--) source += random.pick(pieces)
      for (const columns of WIDTHS) {
        const rows = drawDiagram(source, columns) ?? []
        for (const text of rows.map(lineText)) {
          expect(width(text)).toBeLessThanOrEqual(columns)
          expect(control(text)).toBe(false)
        }
      }
    }
  })
})

describe('time', () => {
  const timed = (source: string, columns: number) => {
    const start = performance.now()
    const rows = drawDiagram(source, columns)
    return { rows, ms: performance.now() - start }
  }

  test('a chain of 300 nodes is drawn whole, at once', () => {
    const source = [
      'flowchart TD',
      ...Array.from({ length: 299 }, (_, at) => `n${at} --> n${at + 1}`),
    ].join('\n')
    const { rows, ms } = timed(source, 120)
    expect(rows!.map(lineText)).toContain('│ n299 │')
    expect(ms).toBeLessThan(1000)
  })

  test('a dense graph of 60 nodes, as a picture when wide and as an outline when narrow', () => {
    const random = seeded(7)
    const lines = ['flowchart TD']
    for (let node = 0; node < 60; node++)
      for (let edge = 0; edge < 4; edge++) lines.push(`n${node} --> n${random.int(0, 59)}`)
    for (const columns of [1000, 120]) {
      const { rows, ms } = timed(lines.join('\n'), columns)
      expect(rows).not.toBeNull()
      expect(ms).toBeLessThan(1000)
    }
  })

  test('past the caps: a source too long, or too many rows, is not drawn', () => {
    expect(drawDiagram(`graph TD\n  A[${'x'.repeat(300_000)}] --> B`, 80)).toBeNull()
    const many = ['graph TD', ...Array.from({ length: 3000 }, (_, at) => `a${at} --> b${at}`)].join(
      '\n',
    )
    expect(timed(many, 80).ms).toBeLessThan(1000)
  })
})
