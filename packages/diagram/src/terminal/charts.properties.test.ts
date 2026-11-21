/**
 * What holds for any chart of the kinds `chart.ts` serves, over seeded random ones of each kind
 * and at every width:
 *
 * 1. Drawing never throws, and a chart that reads is always drawn (a picture or a list).
 * 2. No row is wider than the columns it was drawn for.
 * 3. Every label's words are there to read: titles, names, categories, fields.
 * 4. No control character reaches the terminal, whatever the labels hold.
 * 5. The same source draws the same rows.
 * 6. Big charts draw in a small part of a second.
 *
 * Values are drawn from zero, below it, past what reads in digits, and what is not a number.
 */
import { describe, expect, test } from 'bun:test'
import { seeded, type Random } from '../../test/random'
import type { DiagramKind } from './kind'
import { packetDiagram } from './packet'
import { pieDiagram } from './pie'
import { quadrantDiagram } from './quadrant'
import { radarDiagram } from './radar'
import { sankeyDiagram } from './sankey'
import { diagramLines } from './text'
import { treemapDiagram, treemapLines } from './treemap'
import { xychartDiagram } from './xychart'
import { lineText, type Line } from '../style'
import { width } from '../width'

const SEEDS = 300
const WIDTHS = [120, 60, 30, 12]
// Words no longer than the narrowest list's room, so that a word is never cut where it is read.
const WORDS = ['ok', 'Start', 'retry', 'cache', 'Done', '日本語', 'naïve', 'x2', 'deploy', 'queue']
// Written as numbers: the formatter would write a direction override as itself, unseen.
const HOSTILE = [
  `${String.fromCharCode(0x1b)}[2J`,
  String.fromCharCode(0x07),
  String.fromCharCode(0x202e),
  'a<br>b',
  '&lt;x&gt;',
  '\t',
]
const NUMBERS = ['0', '-3', '12', '0.5', '7', '1e300', '-2e307', '42', '1000000', '3.25']
const NOT_NUMBERS = ['abc', '1,000', 'NaN', '12%', '']

type Chart = { source: string; words: string[] }

const words = (random: Random, least: number, most: number): string[] =>
  Array.from({ length: random.int(least, most) }, () => random.pick(WORDS))

/** A label of one or two words, a hostile piece after it now and then: the words it must show. */
function label(random: Random): { text: string; words: string[] } {
  const own = words(random, 1, 2)
  const hostile = random.next() < 0.15 ? ` ${random.pick(HOSTILE)}` : ''
  return { text: own.join(' ') + hostile, words: own }
}

const value = (random: Random): string =>
  random.next() < 0.15 ? random.pick(NOT_NUMBERS) : random.pick(NUMBERS)

const isNumber = (text: string): boolean => !NOT_NUMBERS.includes(text)

function pie(random: Random, size = random.int(1, 12)): Chart {
  const title = label(random)
  const lines = [random.next() < 0.5 ? 'pie showData' : 'pie', `  title ${title.text}`]
  const out = [...title.words]
  for (let at = 0; at < size; at++) {
    const own = label(random)
    const number = at === 0 ? random.pick(NUMBERS) : value(random)
    lines.push(`  "${own.text}" : ${number}`)
    if (isNumber(number)) out.push(...own.words)
  }
  return { source: lines.join('\n'), words: out }
}

function xychart(random: Random, many = random.int(1, 14), series = random.int(1, 3)): Chart {
  const title = label(random)
  const lines = [random.next() < 0.3 ? 'xychart-beta horizontal' : 'xychart-beta']
  const out: string[] = []
  if (random.next() < 0.7) {
    lines.push(`  title "${title.text}"`)
    out.push(...title.words)
  }
  const roll = random.next()
  if (roll < 0.6) {
    const categories = Array.from({ length: many }, () => label(random))
    lines.push(`  x-axis [${categories.map((own) => own.text).join(', ')}]`)
    out.push(...categories.flatMap((own) => own.words))
  } else if (roll < 0.8)
    lines.push(`  x-axis "${random.pick(WORDS)}" 0 --> ${random.pick(NUMBERS)}`)
  if (random.next() < 0.4)
    lines.push(`  y-axis "${random.pick(WORDS)}" ${random.pick(NUMBERS)} --> 100`)
  for (let at = 0; at < series; at++) {
    const name = random.next() < 0.5 ? label(random) : null
    const values = Array.from({ length: many }, () => value(random))
    lines.push(
      `  ${random.pick(['bar', 'line'])}${name ? ` "${name.text}"` : ''} [${values.join(', ')}]`,
    )
    if (name) out.push(...name.words)
  }
  return { source: lines.join('\n'), words: out }
}

function quadrant(random: Random, size = random.int(0, 10)): Chart {
  const lines = ['quadrantChart']
  const out: string[] = []
  const add = (prefix: string) => {
    const own = label(random)
    lines.push(`  ${prefix}${own.text}`)
    out.push(...own.words)
  }
  if (random.next() < 0.6) add('title ')
  for (let at = 1; at <= 4; at++) if (random.next() < 0.7) add(`quadrant-${at} `)
  for (const axis of ['x', 'y']) {
    const low = label(random)
    const high = label(random)
    lines.push(`  ${axis}-axis ${low.text} --> ${high.text}`)
    out.push(...low.words, ...high.words)
  }
  const place = () => random.pick(['0', '0.3', '0.5', '0.62', '1', '1.5', '-0.2', 'x'])
  for (let at = 0; at < size; at++) {
    const own = label(random)
    const x = place()
    const y = place()
    lines.push(`  ${own.text}: [${x}, ${y}]`)
    if (x !== 'x' && y !== 'x') out.push(...own.words)
  }
  return { source: lines.join('\n'), words: out }
}

function sankey(random: Random, size = random.int(1, 14)): Chart {
  const lines = ['sankey-beta']
  const out: string[] = []
  const names = Array.from({ length: random.int(2, 6) }, () => label(random))
  for (let at = 0; at < size; at++) {
    const from = random.pick(names)
    const to = random.pick(names)
    const number = at === 0 ? random.pick(NUMBERS) : value(random)
    const quoted = random.next() < 0.3 ? `"${to.text}, x"` : to.text
    lines.push(`${from.text},${quoted},${number}`)
    if (isNumber(number) && number !== '') out.push(...from.words, ...to.words)
  }
  return { source: lines.join('\n'), words: out }
}

function packet(random: Random, size = random.int(1, 12)): Chart {
  const lines = ['packet-beta']
  const out: string[] = []
  let next = 0
  for (let at = 0; at < size; at++) {
    const own = label(random)
    const length = random.pick([1, 1, 2, 3, 4, 8, 16, 24, 32, 40])
    const start = random.next() < 0.1 ? next + random.int(1, 40) : next
    lines.push(
      random.next() < 0.3 && start === next
        ? `  +${length}: "${own.text}"`
        : `  ${start}-${start + length - 1}: "${own.text}"`,
    )
    out.push(...own.words)
    next = start + length
  }
  if (random.next() < 0.1) lines.push('  0-3: "ok"')
  return { source: lines.join('\n'), words: out }
}

function radar(random: Random, axes = random.int(1, 8), curves = random.int(1, 4)): Chart {
  const lines = ['radar-beta']
  const out: string[] = []
  const names = Array.from({ length: axes }, (_, at) => {
    const own = label(random)
    out.push(...own.words)
    return `a${at}["${own.text}"]`
  })
  lines.push(`  axis ${names.join(', ')}`)
  for (let at = 0; at < curves; at++) {
    const own = label(random)
    out.push(...own.words)
    const values = Array.from({ length: axes }, (_, place) =>
      random.next() < 0.3 ? `a${place}: ${value(random)}` : value(random),
    )
    lines.push(`  curve c${at}["${own.text}"]{${values.join(', ')}}`)
  }
  if (random.next() < 0.5) lines.push(`  max ${random.pick(NUMBERS)}`)
  if (random.next() < 0.3) lines.push(`  min ${random.pick(NUMBERS)}`)
  return { source: lines.join('\n'), words: out }
}

function treemap(random: Random, size = random.int(1, 14)): Chart {
  const lines = ['treemap-beta']
  const out: string[] = []
  let depth = 0
  for (let at = 0; at < size; at++) {
    const own = label(random)
    const section = random.next() < 0.4
    const number = value(random)
    const indent = '  '.repeat(depth + 1)
    lines.push(section ? `${indent}"${own.text}"` : `${indent}"${own.text}": ${number}`)
    if (section || isNumber(number)) out.push(...own.words)
    depth = section ? depth + 1 : Math.max(0, depth - random.int(0, 2))
  }
  if (out.length === 0) {
    lines.push('  "ok": 1')
    out.push('ok')
  }
  return { source: lines.join('\n'), words: out }
}

const KINDS: Array<[string, DiagramKind, (random: Random) => Chart]> = [
  ['pie', pieDiagram, (random) => pie(random)],
  ['xychart', xychartDiagram, (random) => xychart(random)],
  ['quadrant', quadrantDiagram, (random) => quadrant(random)],
  ['sankey', sankeyDiagram, (random) => sankey(random)],
  ['packet', packetDiagram, (random) => packet(random)],
  ['radar', radarDiagram, (random) => radar(random)],
  ['treemap', treemapDiagram, (random) => treemap(random)],
]

const linesOf = (kind: DiagramKind, source: string): string[] =>
  kind === treemapDiagram ? treemapLines(source) : diagramLines(source)

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

function holds(kind: DiagramKind, chart: Chart): void {
  const lines = linesOf(kind, chart.source)
  expect(kind.matches(lines[0]!)).toBe(true)
  for (const columns of WIDTHS) {
    const rows = kind.draw(lines, columns)
    expect(rows === null ? chart.source : null).toBeNull()
    const texts = (rows as Line[]).map(lineText)
    const wide = texts.find((text) => width(text) > columns)
    expect(wide === undefined ? undefined : `${columns}: ${wide}`).toBeUndefined()
    expect(texts.find(control)).toBeUndefined()
    // A word a list wraps is cut only at the end of a row: with the spaces gone, it is whole.
    const flat = texts.join('').replace(/\s+/g, '')
    const missing = chart.words.filter((word) => !flat.includes(word))
    expect(missing.length ? `${columns}: ${missing.join(' ')}\n${chart.source}` : '').toBe('')
    expect(kind.draw(lines, columns)).toEqual(rows)
  }
}

describe('any chart', () => {
  for (const [name, kind, make] of KINDS)
    test(name, () => {
      for (let seed = 1; seed <= SEEDS; seed++) holds(kind, make(seeded(seed)))
    })

  test('any text after a header: never throws, never too wide, never a control character', () => {
    const pieces = [
      'a',
      '"',
      "'",
      ':',
      ',',
      '[',
      ']',
      '{',
      '}',
      '-->',
      '-',
      '+',
      ' ',
      '  ',
      '\n',
      '0',
      '1e999',
      '-5',
      '.',
      'title ',
      'bar ',
      'line ',
      'axis ',
      'curve ',
      ':::',
      '\u001b',
      '日',
      '%%',
    ]
    const headers = [
      'pie showData\n',
      'xychart-beta\n',
      'xychart-beta horizontal\n',
      'quadrantChart\n',
      'sankey-beta\n',
      'packet-beta\n',
      'radar-beta\n',
      'treemap-beta\n',
    ]
    for (let seed = 1; seed <= SEEDS * 4; seed++) {
      const random = seeded(seed)
      let source = random.pick(headers)
      for (let size = random.int(1, 80); size > 0; size--) source += random.pick(pieces)
      for (const [, kind] of KINDS) {
        const lines = linesOf(kind, source)
        if (!kind.matches(lines[0] ?? '')) continue
        for (const columns of WIDTHS)
          for (const text of (kind.draw(lines, columns) ?? []).map(lineText)) {
            expect(width(text)).toBeLessThanOrEqual(columns)
            expect(control(text)).toBe(false)
          }
      }
    }
  })
})

describe('time', () => {
  const big: Array<[string, DiagramKind, Chart]> = [
    ['pie of 900 slices', pieDiagram, pie(seeded(1), 900)],
    ['xychart of 3 series of 200', xychartDiagram, xychart(seeded(2), 200, 3)],
    ['quadrant of 900 points', quadrantDiagram, quadrant(seeded(3), 900)],
    ['sankey of 900 flows', sankeyDiagram, sankey(seeded(4), 900)],
    ['packet of 900 fields', packetDiagram, packet(seeded(5), 900)],
    ['radar of 30 axes and 30 curves', radarDiagram, radar(seeded(6), 30, 30)],
    ['treemap of 900 nodes', treemapDiagram, treemap(seeded(7), 900)],
  ]
  for (const [name, kind, chart] of big)
    test(name, () => {
      const lines = linesOf(kind, chart.source)
      for (const columns of [1000, 120, 30]) {
        const start = performance.now()
        const rows = kind.draw(lines, columns)
        expect(performance.now() - start).toBeLessThan(250)
        expect(rows).not.toBeNull()
      }
    })

  test('past the bounds, a chart is not read', () => {
    const many = (header: string, line: (at: number) => string) => [
      header,
      ...Array.from({ length: 1200 }, (_, at) => line(at)),
    ]
    expect(
      pieDiagram.draw(
        many('pie', (at) => `"s${at}" : 1`),
        80,
      ),
    ).toBeNull()
    expect(
      sankeyDiagram.draw(
        many('sankey-beta', (at) => `a,b${at},1`),
        80,
      ),
    ).toBeNull()
    expect(
      quadrantDiagram.draw(
        many('quadrantChart', (at) => `p${at}: [0.5, 0.5]`),
        80,
      ),
    ).toBeNull()
  })
})
