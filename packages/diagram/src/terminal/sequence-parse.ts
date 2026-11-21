/**
 * A sequence diagram's source read into participants and steps: messages, notes, and the blocks
 * (`loop`, `alt` … `end`) around them, and when each participant is active (`activate`, and the
 * `+` and `-` after a message's arrow). What a terminal cannot show (colours, boxes of
 * participants, links) is passed over, and a line this does not read is left out alone.
 */
import type { Ink } from './canvas'
import { labelLines } from './text'

export interface Participant {
  id: string
  label: string[]
  actor: boolean
}

/** What a message's end at its receiver is drawn with. */
export type Tip = 'arrow' | 'async' | 'cross' | 'none'

export type Step =
  | {
      kind: 'message'
      from: number
      to: number
      label: string[]
      ink: Ink
      tip: Tip
      /** Whether its sender's end has an arrow too (`<<->>`). */
      both: boolean
    }
  | { kind: 'note'; side: 'left' | 'right' | 'over'; from: number; to: number; label: string[] }
  /** A block's start (`loop`) or the start of another of its parts (`else`). */
  | { kind: 'open' | 'part'; keyword: string; title: string[] }
  | { kind: 'close' }
  /**
   * A participant made active (`on`) or no longer: from the arrow of the message before it, as
   * Mermaid starts its bar there. Activations nest, each `deactivate` ending the latest.
   */
  | { kind: 'activate'; who: number; on: boolean }

export interface Sequence {
  participants: Participant[]
  steps: Step[]
}

/** Past these a diagram is not read on: one that long is written as an outline in any case. */
const MOST_PARTICIPANTS = 500
const MOST_STEPS = 10000

const HEADER = /^sequenceDiagram\b/
const PARTICIPANT = /^(?:create\s+)?(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i
const MESSAGE =
  /^([^:]+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*([^:]+?)\s*(?::(.*))?$/
const NOTE = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:(.*)$/i
const OPEN = /^(loop|alt|opt|par_over|par|critical|break)\b(.*)$/i
const PART = /^(else|and|option)\b(.*)$/i
// Blocks that only colour or group what they hold: their `end` closes nothing drawn.
const PLAIN_BLOCK = /^(?:rect|box)\b/i
const AUTONUMBER = /^autonumber\b(.*)$/i
const ACTIVATE = /^(activate|deactivate)\s+(.+)$/i

const ARROWS: Record<string, { ink: Ink; tip: Tip; both: boolean }> = {
  '->': { ink: 'solid', tip: 'none', both: false },
  '-->': { ink: 'dotted', tip: 'none', both: false },
  '->>': { ink: 'solid', tip: 'arrow', both: false },
  '-->>': { ink: 'dotted', tip: 'arrow', both: false },
  '-x': { ink: 'solid', tip: 'cross', both: false },
  '--x': { ink: 'dotted', tip: 'cross', both: false },
  '-)': { ink: 'solid', tip: 'async', both: false },
  '--)': { ink: 'dotted', tip: 'async', both: false },
  '<<->>': { ink: 'solid', tip: 'arrow', both: true },
  '<<-->>': { ink: 'dotted', tip: 'arrow', both: true },
}

/** Whether `line` opens a sequence diagram. */
export const isSequence = (line: string): boolean => HEADER.test(line)

/** The diagram `lines` write (the first is its header), or null when it has no participant. */
export function parseSequence(lines: readonly string[]): Sequence | null {
  if (!HEADER.test(lines[0] ?? '')) return null
  const chart: Sequence = { participants: [], steps: [] }
  const ids = new Map<string, number>()
  const who = (raw: string): number => {
    const id = raw.trim().replace(/^"(.*)"$/, '$1')
    let at = ids.get(id)
    if (at === undefined && chart.participants.length < MOST_PARTICIPANTS) {
      at = chart.participants.length
      ids.set(id, at)
      chart.participants.push({ id, label: labelOf(id, id), actor: false })
    }
    return at ?? -1
  }
  // What each open block is: one drawn, or one that only groups.
  const open: boolean[] = []
  let number: { next: number; step: number } | null = null
  for (const line of lines.slice(1)) {
    if (chart.steps.length >= MOST_STEPS) break
    const participant = PARTICIPANT.exec(line)
    if (participant) {
      const at = who(participant[2]!)
      if (at < 0) continue
      const own = chart.participants[at]!
      own.actor = participant[1]!.toLowerCase() === 'actor'
      if (participant[3] !== undefined) own.label = labelOf(participant[3], own.id)
      continue
    }
    const note = NOTE.exec(line)
    if (note) {
      const names = note[2]!.split(',').map(who)
      if (names.some((at) => at < 0)) continue
      chart.steps.push({
        kind: 'note',
        side: note[1]!.toLowerCase().startsWith('left')
          ? 'left'
          : note[1]!.toLowerCase().startsWith('right')
            ? 'right'
            : 'over',
        from: Math.min(...names),
        to: Math.max(...names),
        label: labelLines(note[3]!),
      })
      continue
    }
    if (/^end$/i.test(line)) {
      if (open.pop()) chart.steps.push({ kind: 'close' })
      continue
    }
    if (PLAIN_BLOCK.test(line)) {
      open.push(false)
      continue
    }
    const block = OPEN.exec(line)
    if (block) {
      open.push(true)
      chart.steps.push({ kind: 'open', keyword: keyword(block[1]!), title: labelLines(block[2]!) })
      continue
    }
    const part = PART.exec(line)
    if (part) {
      if (open.at(-1))
        chart.steps.push({
          kind: 'part',
          keyword: part[1]!.toLowerCase(),
          title: labelLines(part[2]!),
        })
      continue
    }
    const autonumber = AUTONUMBER.exec(line)
    if (autonumber) {
      const words = autonumber[1]!.trim().split(/\s+/)
      const start = /^\d{1,9}$/.test(words[0] ?? '') ? Number(words[0]) : 1
      const step = /^\d{1,9}$/.test(words[1] ?? '') ? Number(words[1]) : 1
      number =
        words[0] === 'off'
          ? null
          : {
              next: start,
              step,
            }
      continue
    }
    const activate = ACTIVATE.exec(line)
    if (activate) {
      const at = who(activate[2]!)
      const on = activate[1]!.toLowerCase() === 'activate'
      if (at >= 0) chart.steps.push({ kind: 'activate', who: at, on })
      continue
    }
    const message = MESSAGE.exec(line)
    if (message) {
      const from = who(message[1]!)
      const to = who(message[4]!)
      if (from < 0 || to < 0) continue
      const label = labelLines(message[5] ?? '')
      if (number) {
        label.splice(0, 1, `${number.next}. ${label[0] ?? ''}`.trimEnd())
        number.next += number.step
      }
      chart.steps.push({ kind: 'message', from, to, label, ...ARROWS[message[2]!]! })
      // `+` makes the receiver active, `-` ends the sender's latest activation.
      if (message[3] === '+') chart.steps.push({ kind: 'activate', who: to, on: true })
      if (message[3] === '-') chart.steps.push({ kind: 'activate', who: from, on: false })
    }
  }
  // A block still open at the end is closed there.
  for (const drawn of open.toReversed()) if (drawn) chart.steps.push({ kind: 'close' })
  return chart.participants.length > 0 ? chart : null
}

function labelOf(raw: string, id: string): string[] {
  const lines = labelLines(raw)
  return lines.length > 0 ? lines : labelLines(id).length > 0 ? labelLines(id) : ['?']
}

const keyword = (word: string): string =>
  word.toLowerCase() === 'par_over' ? 'par' : word.toLowerCase()
