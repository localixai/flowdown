/**
 * Styled lines wrapped to a width by display columns, at word boundaries, with a prefix for the
 * first row and another for the rest (a hanging indent): a paragraph never breaks mid-word and
 * its continuation sits under its own start. A word wider than the row is split; nothing is ever
 * wider than `width` while the prefix leaves a column to write in.
 */
import { sgr, type Line, type Span, type Style } from './style'
import { charWidth, width } from './width'

/**
 * A space a row is not broken at while a row holds what it joins: the spaces of code. Drawn as a
 * space, so what is copied from the screen is what was written.
 */
export const NO_BREAK = String.fromCharCode(0xa0)

/** What follows a word. */
const enum After {
  /** A space, where a row may end. */
  Space,
  /** A space that keeps its words on one row when a row holds them. */
  Joint,
  /** The next word, with nothing between: "`code`," or "a**b**". */
  Nothing,
}

interface Word {
  text: string
  style: Style
  after: After
  /** Its columns, measured once. */
  own: number
  /** Where it ends in its span's text. */
  end: number
}

export const lineWidth = (line: Line): number => {
  let columns = 0
  for (const span of line) columns += width(span.text)
  return columns
}

const SPACE = /\s/

/** A line's words, and for each of its spans where its words end and what the last one was then followed by. */
interface Read {
  words: Word[]
  ends: number[]
  afters: Array<After | null>
}

/**
 * The words of `line` with their style and what follows each. The words of its first `from` spans
 * are `base`'s, when `base` read the same spans (`before`); so are the words of span `from` that
 * end before where it changed: a line that grows is read from its last words, not its start.
 */
function words(line: Line, from = 0, base: Read | null = null, before: Line | null = null): Read {
  const out = base ? base.words.slice(0, base.ends[from - 1] ?? 0) : []
  const ends = base ? base.ends.slice(0, from) : []
  const afters = base ? base.afters.slice(0, from) : []
  const previous = out.length
  let resume = 0
  const now = line[from]
  const then = before?.[from]
  if (base && now && then && sameStyle(now.style, then.style)) {
    // The span's words read last time, up to the last one with a space after it that is still
    // there: the text up to that space is compared once, as memory.
    const first = base.ends[from - 1] ?? 0
    let upTo = (base.ends[from] ?? first) - 1
    while (upTo >= first && base.words[upTo]!.end >= then.text.length) upTo--
    const word = base.words[upTo]
    if (
      word &&
      upTo >= first &&
      now.text.slice(0, word.end + 1) === then.text.slice(0, word.end + 1)
    ) {
      for (let at = first; at <= upTo; at++) out.push(base.words[at]!)
      resume = word.end
    }
  }
  // What came after the last word of the spans kept may have been the next span's. Read again
  // from its start, that span says it again; read on from inside it, it said the same last time.
  const last = out[previous - 1]
  const was = afters[from - 1]
  if (resume === 0 && last !== undefined && was != null && last.after !== was)
    out[previous - 1] = { ...last, after: was }
  const kept = out.length
  for (let at = from; at < line.length; at++) {
    const span = line[at]!
    const text = span.text
    let word = ''
    let index = at === from ? resume : 0
    for (const char of at === from && resume > 0 ? text.slice(resume) : text) {
      if (SPACE.test(char)) {
        const after = char === NO_BREAK ? After.Joint : After.Space
        if (word) {
          out.push({ text: word, style: span.style, after, own: width(word), end: index })
          word = ''
        } else if (out.length > 0) {
          // A word of `base` is not changed: its copy is.
          if (out.length <= kept) out[out.length - 1] = { ...out.at(-1)! }
          out.at(-1)!.after = after
        }
      } else word += char
      index += char.length
    }
    if (word)
      out.push({
        text: word,
        style: span.style,
        after: After.Nothing,
        own: width(word),
        end: index,
      })
    ends.push(out.length)
    afters.push(out.at(-1)?.after ?? null)
  }
  return { words: out, ends, afters }
}

/**
 * For each word, the columns kept on one row from it on: the words that run into it, and where a
 * code span starts, the span. A span no row holds is then broken at its spaces, as words are.
 */
function runs(list: Word[]): number[] {
  const out = list.map(() => 0)
  let glued = 0
  let whole = 0
  for (let at = list.length - 1; at >= 0; at--) {
    const { own, after } = list[at]!
    if (after === After.Space) [glued, whole] = [own, own]
    else if (after === After.Joint) [glued, whole] = [own, own + 1 + whole]
    else [glued, whole] = [own + glued, own + whole]
    const before = at > 0 ? list[at - 1]!.after : After.Space
    out[at] = before === After.Space ? whole : before === After.Joint ? glued : 0
  }
  return out
}

/** Where `word` is cut to fit `columns`: its length when it fits. Always past its first character. */
function split(word: string, columns: number): number {
  let used = 0
  let at = 0
  for (const char of word) {
    const own = charWidth(char)
    if (used + own > columns && at > 0) return at
    used += own
    at += char.length
  }
  return word.length
}

/**
 * How the space between two words is drawn: with what both are. Inside a link it is underlined
 * with its words; after the link it is not, and the line under the link ends where the link does.
 */
function shared(before: Style, after: Style): Style {
  if (before === after) return before
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(before))
    if ((after as Record<string, unknown>)[field] === value) out[field] = value
  return out as Style
}

/**
 * The last line wrapped under each pair of prefixes and width: its spans, its words, its rows, and
 * the word each row starts with (-1 for a row that starts inside a word). A paragraph that grows is
 * wrapped again from its last rows: a row that ended before what changed ends where it did.
 */
interface Wrapped {
  line: Line
  read: Read
  kept: number[]
  rows: Line[]
  starts: number[]
}

const WRAPPED = new Map<string, Wrapped>()

/** Forgets every line wrapped: a test holds the rows against a wrap from the start. */
export const forgetWrapped = (): void => WRAPPED.clear()

const sameStyle = (a: Style, b: Style): boolean => a === b || sgr(a) === sgr(b)
const sameWord = (a: Word, b: Word): boolean =>
  a === b || (a.text === b.text && a.after === b.after && sameStyle(a.style, b.style))
const signature = (line: Line): string =>
  line.map((span) => `${span.text}\u0002${sgr(span.style)}`).join('\u0003')

/** `line` wrapped to `columns`: the first row starts with `first`, the others with `rest`. */
export function wrap(line: Line, columns: number, first: Line, rest: Line): Line[] {
  const indent = lineWidth(rest)
  const room = Math.max(columns, indent + 1)
  const key = `${room}\u0001${signature(first)}\u0001${signature(rest)}`
  const was = WRAPPED.get(key)
  let same = 0
  if (was) {
    const most = Math.min(line.length, was.line.length)
    while (
      same < most &&
      line[same]!.text === was.line[same]!.text &&
      sameStyle(line[same]!.style, was.line[same]!.style)
    )
      same++
  }
  const read = was ? words(line, same, was.read, was.line) : words(line)
  const list = read.words
  const kept = runs(list)

  // Where to go on from: the last row of the line wrapped before that starts with a whole word,
  // two words before the first that changed, with every word up to it running as it did.
  let resume = 0
  if (was) {
    let common = 0
    const most = Math.min(list.length, was.read.words.length)
    while (common < most && sameWord(list[common]!, was.read.words[common]!)) common++
    let ran = 0
    while (ran < common && kept[ran] === was.kept[ran]) ran++
    for (let at = was.starts.length - 1; at >= 1; at--) {
      const start = was.starts[at]!
      // The row before it ended at that word by what runs into the word: that must run the same too.
      if (start >= 0 && start + 2 <= common && start < ran) {
        resume = at
        break
      }
    }
  }

  const rows: Line[] = was && resume > 0 ? was.rows.slice(0, resume) : []
  const starts: number[] = was && resume > 0 ? was.starts.slice(0, resume) : []
  const from = was && resume > 0 ? was.starts[resume]! : 0
  let row: Line = resume > 0 ? [...rest] : [...first]
  let used = resume > 0 ? indent : lineWidth(first)
  let fresh = true
  let pending: Style | null = null
  if (from > 0) {
    const before = list[from - 1]!
    pending = before.after === After.Nothing ? null : before.style
  }
  starts.push(from)
  const next = (at: number) => {
    rows.push(row)
    row = [...rest]
    used = indent
    fresh = true
    starts.push(at)
  }
  for (let at = from; at < list.length; at++) {
    const { style, after } = list[at]!
    let word = list[at]!.text
    const run = kept[at]!
    // A word and what runs into it ("`code`," or "(**b**)"), and the words of a code span, go
    // to the next row together when a row holds them: no row starts with the comma.
    if (!fresh && used + (pending ? 1 : 0) + run > room && indent + run <= room) next(at)
    // Measured once, and less each piece cut off: a word of a megabyte is not measured per row.
    let own = list[at]!.own
    for (;;) {
      const gap = pending && !fresh ? 1 : 0
      if (used + gap + own <= room) {
        if (gap) row.push({ text: ' ', style: shared(pending!, style) })
        row.push({ text: word, style })
        used += gap + own
        fresh = false
        break
      }
      if (!fresh) {
        next(at)
        continue
      }
      const head = word.slice(0, split(word, Math.max(1, room - used)))
      row.push({ text: head, style })
      word = word.slice(head.length)
      own -= width(head)
      // The row after starts inside this word: no line is wrapped again from it.
      next(-1)
      if (!word) break
    }
    pending = after === After.Nothing ? null : style
  }
  if (!fresh || rows.length === 0) rows.push(row)
  starts.length = rows.length
  if (WRAPPED.size >= 64) WRAPPED.clear()
  WRAPPED.set(key, { line, read, kept, rows: [...rows], starts })
  return rows
}

/**
 * A line of code with each tab run out to the next fourth column: a terminal's own stops are
 * eight wide, and an escaped tab is not what was written.
 */
export function untabbed(line: string): string {
  if (!line.includes('\t')) return line
  const pads = tabPads(line)
  return line
    .split('\t')
    .map((piece, at) => (at > 0 ? ' '.repeat(pads[at - 1]!) : '') + piece)
    .join('')
}

/** The spaces each tab of `line` stands for, in order: what {@link untabbed} writes in its place. */
export function tabPads(line: string): number[] {
  const pads: number[] = []
  let column = 0
  line.split('\t').forEach((piece, at) => {
    if (at > 0) {
      const pad = 4 - (column % 4)
      pads.push(pad)
      column += pad
    }
    column += width(piece)
  })
  return pads
}

/**
 * `line` in rows of at most `columns`, broken anywhere with its styles and its spaces kept: for
 * code, whose indentation and alignment mean something.
 */
export function fit(line: Line, columns: number): Line[] {
  const room = Math.max(1, columns)
  if (lineWidth(line) <= room) return [line]
  const rows: Line[] = [[]]
  let used = 0
  for (const span of line) {
    let text = ''
    for (const char of span.text) {
      const own = charWidth(char)
      if (used + own > room && used > 0) {
        rows.at(-1)!.push({ text, style: span.style })
        text = ''
        rows.push([])
        used = 0
      }
      text += char
      used += own
    }
    rows.at(-1)!.push({ text, style: span.style })
  }
  return rows
}

export const span = (text: string, style: Style): Span => ({ text, style })
