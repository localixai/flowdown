/**
 * ZenUML in a terminal: its common subset read into the model a sequence diagram is read into,
 * and drawn as one (`drawSequence`). A call `B.method()` is a message from whoever is running to
 * `B`, and the calls inside its `{ }` are made by `B`; `x = B.method()` and `return x` come back
 * as dotted replies. `A->B: text` is an asynchronous message, `if`/`else`, `while`, `opt`, `par`
 * and `try`/`catch` are frames, and `@Actor A` and its kind declare a participant.
 *
 * A call made at the top, outside every block, comes from the diagram's starter: the participant
 * `@Starter(A)` names, or one called `Starter` when none is named, as ZenUML's own word for it.
 */
import type { DiagramKind } from './kind'
import { para } from './kit'
import { drawSequence } from './sequence'
import type { Sequence, Step } from './sequence-parse'
import { labelLines } from './text'
import { BOLD } from '../style'
import { span } from '../wrap'

/** Past these a diagram is not read on. */
const MOST_PARTICIPANTS = 500
const MOST_STEPS = 10000
const MOST_DEPTH = 200

type Frame =
  | { kind: 'call'; caller: number; callee: number; reply: string | null }
  | { kind: 'block'; keyword: string }
  | { kind: 'plain' }

export const zenumlDiagram: DiagramKind = {
  matches: (header) => /^zenuml\b/.test(header),
  draw(lines, columns) {
    const read = parseZenuml(lines)
    if (!read || !(columns >= 2)) return null
    const room = Math.floor(columns)
    const drawn = drawSequence(read.chart, room)
    if (!drawn) return null
    const title = read.title.flatMap((line) => para([span(line, BOLD)], room, 0))
    return title.length > 0 ? [...title, [], ...drawn] : drawn
  },
}

/** The statements of a body: each with whether a `{` follows it, and each `}` on its own. */
function statements(text: string): Array<{ text: string; opens: boolean } | 'close'> {
  const out: Array<{ text: string; opens: boolean } | 'close'> = []
  let current = ''
  let depth = 0
  let quote = ''
  const flush = (opens: boolean) => {
    const own = current.trim()
    if (own !== '' || opens) out.push({ text: own, opens })
    current = ''
  }
  for (const char of text) {
    if (quote) {
      current += char
      if (char === quote || char === '\n') quote = ''
      continue
    }
    if (char === '"') quote = char
    if (char === '(') depth++
    if (char === ')') depth = Math.max(0, depth - 1)
    // A newline ends a statement even inside an unclosed `(`: a line is never read into the next.
    if (char === '\n') depth = 0
    if (depth === 0 && (char === '{' || char === '}' || char === ';' || char === '\n')) {
      flush(char === '{')
      if (char === '}') out.push('close')
      continue
    }
    current += char
  }
  flush(false)
  return out
}

const CONTROL =
  /^(if|else\s+if|else|while|for|foreach|loop|opt|par|try|catch|finally|critical)\b\s*(?:\((.*)\))?\s*$/i
const ASYNC = /^("[^"]+"|[^\s.:>"-]+)\s*->\s*("[^"]+"|[^\s.:"]+)\s*:(.*)$/
const CALL = /^(?:("[^"]+"|[^\s.:"]+)\s*->\s*)?("[^"]+"|[^\s.(="]+)\.([^\s.(]+)\s*\((.*)\)$/
const ASSIGN = /^(?:[\w<>[\],]+\s+)?([\w$]+)\s*=\s*(.+)$/
const NEW = /^new\s+("[^"]+"|[^\s(]+)\s*(?:\((.*)\))?$/
const RETURN = /^(?:return|@return|@reply)\b\s*(.*)$/i
const STARTER = /^@Starter\s*\(\s*([^)]+?)\s*\)$/i
const ANNOTATED = /^@(\w+)\s+("[^"]+"|\S+)$/
const NAMES = /^(?:"[^"]+"|[A-Za-z_][\w]*)(?:\s+(?:"[^"]+"|[A-Za-z_][\w]*))*$/
const KEYWORDS: Record<string, string> = { foreach: 'loop', for: 'loop' }

function parseZenuml(lines: readonly string[]): { chart: Sequence; title: string[] } | null {
  if (!/^zenuml\b/.test(lines[0]?.trim() ?? '')) return null
  const chart: Sequence = { participants: [], steps: [] }
  const ids = new Map<string, number>()
  let title: string[] = []
  let starter = -1
  let implicit = false
  const who = (raw: string): number => {
    const id = raw.trim().replace(/^"(.*)"$/, '$1')
    let at = ids.get(id)
    if (at === undefined && chart.participants.length < MOST_PARTICIPANTS && id !== '') {
      at = chart.participants.length
      ids.set(id, at)
      const label = labelLines(id)
      chart.participants.push({ id, label: label.length > 0 ? label : ['?'], actor: false })
    }
    return at ?? -1
  }
  const frames: Frame[] = []
  // A block of `if` or `try` closed but perhaps not done: an `else` or `catch` may follow.
  let pending = false
  const push = (step: Step) => {
    if (chart.steps.length < MOST_STEPS) chart.steps.push(step)
  }
  const caller = (): number => {
    for (let at = frames.length - 1; at >= 0; at--) {
      const frame = frames[at]!
      if (frame.kind === 'call') return frame.callee
    }
    if (starter < 0) {
      starter = who('Starter')
      implicit = true
    }
    return starter
  }
  const message = (from: number, to: number, label: string, dotted: boolean, async = false) => {
    if (from < 0 || to < 0) return
    push({
      kind: 'message',
      from,
      to,
      label: labelLines(label),
      ink: dotted ? 'dotted' : 'solid',
      tip: async ? 'async' : 'arrow',
      both: false,
    })
  }
  const open = (frame: Frame) => {
    if (frames.length < MOST_DEPTH) frames.push(frame)
  }
  const settle = () => {
    if (pending) push({ kind: 'close' })
    pending = false
  }
  const body = lines
    .slice(1)
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  for (const statement of statements(body)) {
    if (chart.steps.length >= MOST_STEPS) break
    if (statement === 'close') {
      settle()
      const frame = frames.pop()
      if (!frame) continue
      if (frame.kind === 'call' && frame.reply !== null)
        message(frame.callee, frame.caller, frame.reply, true)
      if (frame.kind === 'block') {
        if (/^(?:if|else|try|catch)$/.test(frame.keyword)) pending = true
        else push({ kind: 'close' })
      }
      continue
    }
    const text = statement.text
    const control = CONTROL.exec(text)
    const keyword = control ? control[1]!.toLowerCase().replace(/\s+/g, ' ') : ''
    if (pending && control && /^(?:else if|else|catch|finally)$/.test(keyword)) {
      pending = false
      push({
        kind: 'part',
        keyword: keyword === 'else if' ? 'else' : keyword,
        title: labelLines(control[2] ?? ''),
      })
      if (statement.opens) open({ kind: 'block', keyword: keyword === 'else if' ? 'if' : keyword })
      continue
    }
    settle()
    let match: RegExpExecArray | null
    if (control) {
      const own = KEYWORDS[keyword] ?? keyword
      push({ kind: 'open', keyword: own, title: labelLines(control[2] ?? '') })
      // A frame with no `{` holds nothing: it is closed where it opened.
      if (statement.opens) open({ kind: 'block', keyword: own })
      else push({ kind: 'close' })
      continue
    }
    if ((match = /^title\s+(.*)$/i.exec(text))) title = labelLines(match[1]!)
    else if ((match = STARTER.exec(text))) starter = who(match[1]!)
    else if ((match = RETURN.exec(text))) {
      const frame = frames.findLast((own) => own.kind === 'call')
      if (frame?.kind === 'call') {
        message(frame.callee, frame.caller, match[1]!, true)
        // The call has its reply: the name it was assigned to does not come back a second time.
        frame.reply = null
      }
    } else if ((match = ANNOTATED.exec(text))) {
      const at = who(match[2]!)
      if (at >= 0 && match[1]!.toLowerCase() === 'actor') chart.participants[at]!.actor = true
    } else if ((match = ASYNC.exec(text)))
      message(who(match[1]!), who(match[2]!), match[3]!, false, true)
    else {
      const assign = ASSIGN.exec(text)
      const call = assign ? assign[2]!.trim() : text
      const reply = assign ? assign[1]! : null
      const made = NEW.exec(call)
      const sync = made ? null : CALL.exec(call)
      if (made || sync) {
        const from = sync?.[1] !== undefined ? who(sync[1]) : caller()
        const to = who(made ? made[1]! : sync![2]!)
        message(from, to, made ? '«create»' : `${sync![3]}(${sync![4]})`, false)
        if (statement.opens) open({ kind: 'call', caller: from, callee: to, reply })
        else if (reply !== null) message(to, from, reply, true)
        continue
      }
      // Participants declared by name alone (`A B "C D"`), as the diagram's first lines do.
      if (!assign && NAMES.test(text))
        for (const name of text.match(/"[^"]+"|\S+/g) ?? []) who(name)
    }
    if (statement.opens) open({ kind: 'plain' })
  }
  settle()
  for (const frame of frames.toReversed()) {
    if (frame.kind === 'call' && frame.reply !== null)
      message(frame.callee, frame.caller, frame.reply, true)
    if (frame.kind === 'block') push({ kind: 'close' })
  }
  if (implicit && starter > 0) first(chart, starter)
  return chart.participants.length > 0 ? { chart, title } : null
}

/**
 * The participant at `at` moved to the left of the others: a starter made up when the first call
 * was met stands where the calls start, not where it happened to be read.
 */
function first(chart: Sequence, at: number): void {
  const moved = (own: number) => (own === at ? 0 : own < at ? own + 1 : own)
  chart.participants.unshift(...chart.participants.splice(at, 1))
  for (const step of chart.steps)
    if (step.kind === 'message' || step.kind === 'note') {
      step.from = moved(step.from)
      step.to = moved(step.to)
    }
}
