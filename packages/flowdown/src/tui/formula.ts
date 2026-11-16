/**
 * A formula set on rows of its own as a terminal can draw it. A terminal has one size of letter,
 * but a display formula has the rows a sentence does not: a fraction stands over its rule, a sum
 * has its limits above and below it, a root's bar runs over what it takes, a matrix stands in
 * brackets as tall as its rows.
 *
 *          k
 *     1    ∑  rᵢ        ⎛ a  b ⎞
 *     ── · i=1          ⎝ c  d ⎠
 *     k
 *
 * What a row can say as well stays on it: `x^2` is still `x²`, and a formula with nothing to set
 * on rows is written as `math.ts` writes it, on one. The commands, symbols and small letters are
 * the ones `math.ts` reads, so the two never say different things. It reads any text and never
 * throws; a formula it cannot set within the width is written on one row instead.
 */
import {
  ACCENTS,
  accented,
  DOUBLE,
  DROPPED,
  FUNCTIONS,
  LETTERS,
  MAX_DEPTH,
  script,
  SUB,
  SUPER,
  SYMBOLS,
  TRANSPARENT,
} from './math'
import { width } from './width'

/** A drawn piece: its rows, each `width` columns wide, and the row its baseline is on. */
interface Box {
  rows: string[]
  width: number
  base: number
  /** It stands apart from its neighbours by a space: a fraction, a root, a matrix. */
  apart?: boolean
  /** Its scripts go above and below it, not beside: a sum, a limit. */
  limits?: boolean
}

/** One thing of a run: a character or a word of text, or a drawn piece. */
type Item = string | Box

/** A space that is not run into its neighbours: `\quad`. Written as a space at the end. */
const HARD = ' '

/** Operators whose limits a display formula sets above and below them. */
const LIMITS = new Set([
  '∑',
  '∏',
  '∐',
  '⋃',
  '⋂',
  '⨁',
  '⨂',
  '⨀',
  '⋁',
  '⋀',
  'lim',
  'limsup',
  'liminf',
  'max',
  'min',
  'sup',
  'inf',
  'det',
  'gcd',
  'Pr',
])

/** What a delimiter command stands for. */
const DELIMITERS: Record<string, string> = {
  '{': '{',
  '}': '}',
  '|': '‖',
  lbrace: '{',
  rbrace: '}',
  langle: '⟨',
  rangle: '⟩',
  lvert: '|',
  rvert: '|',
  vert: '|',
  lVert: '‖',
  rVert: '‖',
  Vert: '‖',
  lfloor: '⌊',
  rfloor: '⌋',
  lceil: '⌈',
  rceil: '⌉',
}

/** The brackets of a matrix environment. */
const FENCES: Record<string, [string, string]> = {
  pmatrix: ['(', ')'],
  bmatrix: ['[', ']'],
  Bmatrix: ['{', '}'],
  vmatrix: ['|', '|'],
  Vmatrix: ['‖', '‖'],
}

/** Rows past this are not a formula a terminal shows: the formula is written on one row. */
const MAX_ROWS = 40
const MAX_LENGTH = 4000

const blank = (columns: number): string => ' '.repeat(Math.max(0, columns))
const text = (value: string): Box => ({ rows: [value], width: width(value), base: 0 })
const EMPTY = text('')

/** `box` made `columns` wide, its rows set left, right or in the middle. */
function placed(box: Box, columns: number, align: 'left' | 'center' | 'right'): Box {
  const room = columns - box.width
  if (room <= 0) return box
  const left = align === 'left' ? 0 : align === 'right' ? room : room >> 1
  const rows = box.rows.map((row) => blank(left) + row + blank(room - left))
  return { ...box, rows, width: columns }
}

/** Boxes side by side, their baselines on one row. */
function beside(boxes: Box[]): Box {
  if (boxes.length === 0) return EMPTY
  if (boxes.length === 1) return boxes[0]!
  let above = 0
  let below = 0
  for (const box of boxes) {
    above = Math.max(above, box.base)
    below = Math.max(below, box.rows.length - box.base)
  }
  const rows = Array.from({ length: above + below }, () => '')
  let columns = 0
  for (const box of boxes) {
    const top = above - box.base
    for (let row = 0; row < rows.length; row++) rows[row] += box.rows[row - top] ?? blank(box.width)
    columns += box.width
  }
  return { rows, width: columns, base: above }
}

/** Boxes one under another, as wide as the widest; the baseline is the one of box `at`. */
function under(boxes: Box[], at: number, align: 'left' | 'center' | 'right'): Box {
  const columns = Math.max(0, ...boxes.map((box) => box.width))
  const rows: string[] = []
  let base = 0
  boxes.forEach((box, index) => {
    if (index === at) base = rows.length + box.base
    for (const row of placed(box, columns, align).rows) rows.push(row)
  })
  return { rows, width: columns, base }
}

/** A delimiter `rows` tall, from the pieces Unicode has to build tall brackets of. */
function delimiter(char: string, rows: number, base: number): Box {
  if (char === '.' || char === '')
    return { rows: Array.from({ length: rows }, () => ''), width: 0, base }
  if (rows <= 1) return { ...text(char), base: 0 }
  const tall = (top: string, middle: string, bottom: string) =>
    Array.from({ length: rows }, (_, row) => (row === 0 ? top : row === rows - 1 ? bottom : middle))
  let glyphs: string[]
  switch (char) {
    case '(':
      glyphs = tall('⎛', '⎜', '⎝')
      break
    case ')':
      glyphs = tall('⎞', '⎟', '⎠')
      break
    case '[':
      glyphs = tall('⎡', '⎢', '⎣')
      break
    case ']':
      glyphs = tall('⎤', '⎥', '⎦')
      break
    case '⌈':
      glyphs = tall('⎡', '⎢', '⎢')
      break
    case '⌉':
      glyphs = tall('⎤', '⎥', '⎥')
      break
    case '⌊':
      glyphs = tall('⎢', '⎢', '⎣')
      break
    case '⌋':
      glyphs = tall('⎥', '⎥', '⎦')
      break
    case '{':
    case '}': {
      const left = char === '{'
      // Two rows have no middle for the brace's point: its two halves.
      if (rows === 2) glyphs = left ? ['⎰', '⎱'] : ['⎱', '⎰']
      else {
        const middle = (rows - 1) >> 1
        glyphs = Array.from({ length: rows }, (_, row) =>
          row === 0
            ? left
              ? '⎧'
              : '⎫'
            : row === rows - 1
              ? left
                ? '⎩'
                : '⎭'
              : row === middle
                ? left
                  ? '⎨'
                  : '⎬'
                : '⎪',
        )
      }
      break
    }
    case '⟨':
    case '⟩': {
      const open = char === '⟨'
      const half = rows / 2
      glyphs = Array.from({ length: rows }, (_, row) =>
        rows % 2 === 1 && row === (rows - 1) / 2 ? char : row < half === open ? '╱' : '╲',
      )
      break
    }
    case '‖':
      glyphs = tall('║', '║', '║')
      break
    default:
      glyphs = tall('│', '│', '│')
  }
  return { rows: glyphs, width: 1, base }
}

/** `box` in a pair of delimiters as tall as it is. */
const delimited = (box: Box, left: string, right: string): Box =>
  beside([
    delimiter(left, box.rows.length, box.base),
    box,
    delimiter(right, box.rows.length, box.base),
  ])

/** A fraction: its numerator over a rule as wide as the wider of the two, its denominator under. */
function fraction(over: Box, beneath: Box): Box {
  const columns = Math.max(over.width, beneath.width, 1)
  const rule = text('─'.repeat(columns))
  return { ...under([over, rule, beneath], 1, 'center'), apart: true }
}

/** A root: its bar over what it takes, the sign before it; an index, small, before the sign. */
function root(radicand: Box, index: string): Box {
  const sign = index ? `${script(index, SUPER, '')}√` : '√'
  if (radicand.rows.length === 1) {
    const bar = text(blank(width(sign)) + '_'.repeat(radicand.width))
    return { ...under([bar, beside([text(sign), radicand])], 1, 'left'), apart: true }
  }
  // A tall radicand: a bar along its top and down its side, the sign at the baseline.
  const lead = width(sign)
  const rows = [`${blank(lead)}┌${'─'.repeat(radicand.width + 1)}`]
  radicand.rows.forEach((row, at) =>
    rows.push(`${at === radicand.base ? sign : blank(lead)}│ ${row}`),
  )
  return { rows, width: lead + radicand.width + 2, base: radicand.base + 1, apart: true }
}

/** Text that a script can be written in the small letters of `table`, or null. */
function small(box: Box, table: Map<string, string>): string | null {
  if (box.rows.length !== 1) return null
  const written = script(box.rows[0]!, table, '\u0000')
  return written.startsWith('\u0000') ? null : written
}

/** `base` with its scripts: small letters on its row where Unicode has them, set above and below where not. */
function scripted(base: Item | undefined, sup: Box | null, sub: Box | null): Item {
  const box = base === undefined ? EMPTY : typeof base === 'string' ? text(base) : base
  if (box.limits) {
    const parts = [...(sup ? [sup] : []), box, ...(sub ? [sub] : [])]
    return under(parts, sup ? 1 : 0, 'center')
  }
  const high = sup ? small(sup, SUPER) : ''
  const low = sub ? small(sub, SUB) : ''
  if (high !== null && low !== null) {
    if (box.rows.length === 1) return text(box.rows[0]! + low + high)
    // Beside a tall piece the small letters stand at its top and its foot: `⎛a⎞²`.
    const last = box.rows.length - 1
    const columns = Math.max(width(high), width(low))
    const rows = box.rows.map((row, at) => {
      const mark = at === 0 && high ? high : at === last && low ? low : ''
      return row + mark + blank(columns - width(mark))
    })
    return { ...box, rows, width: box.width + columns }
  }
  // On a row of its own: over a letter its last row stands right above it; beside a tall piece,
  // level with its top. Under it, the same, below.
  const tall = box.rows.length > 1
  const supTop = sup ? (tall ? 1 - sup.rows.length : -sup.rows.length) : 0
  const subTop = sub ? (tall ? box.rows.length - 1 : 1) : 0
  const top = Math.min(0, supTop)
  const bottom = Math.max(box.rows.length, sub ? subTop + sub.rows.length : 0)
  const scripts = Math.max(sup?.width ?? 0, sub?.width ?? 0)
  const rows: string[] = []
  for (let row = top; row < bottom; row++) {
    let line = box.rows[row] ?? blank(box.width)
    const up = sup ? sup.rows[row - supTop] : undefined
    const down = sub ? sub.rows[row - subTop] : undefined
    line += (up ?? down ?? '') + blank(scripts - width(up ?? down ?? ''))
    rows.push(line)
  }
  return { rows, width: box.width + scripts, base: box.base - top }
}

/** Where a run of a formula ends. */
type Stop = 'end' | 'group' | 'cell' | 'right' | 'index' | 'row'

const OPENS = new Set(['(', '[', '⟨', '⌊', '⌈'])
const CLOSES = new Set([')', ']', '⟩', '⌋', '⌉', ','])
const PAIRS: Record<string, string> = { ')': '(', ']': '[' }

/**
 * When `close` closes a bracket opened among `items` around something tall, the pair as one box
 * as tall as what it holds, taken out of `items`; else null and `items` as they were.
 */
function grownPair(items: Item[], close: string): Box | null {
  const open = PAIRS[close]
  if (open === undefined) return null
  let depth = 0
  for (let at = items.length - 1; at >= 0; at--) {
    const item = items[at]
    if (item === close) depth++
    else if (item === open && depth-- === 0) {
      const inside = items.slice(at + 1)
      if (!inside.some((part) => typeof part !== 'string' && part.rows.length > 1)) return null
      items.length = at
      return delimited(assemble(inside), open, close)
    }
  }
  return null
}

/** A run's items as one box: its spaces tidied, its tall brackets grown, its text joined. */
function assemble(items: Item[]): Box {
  // One space between things, none at the ends and none inside a bracket, as `math.ts` writes them.
  const tidy: Item[] = []
  for (const item of items) {
    const last = tidy.at(-1)
    if (
      item === ' ' &&
      (last === undefined || last === ' ' || (typeof last === 'string' && OPENS.has(last)))
    )
      continue
    if (typeof item === 'string' && CLOSES.has(item) && last === ' ') tidy.pop()
    tidy.push(item)
  }
  while (tidy.at(-1) === ' ') tidy.pop()
  // A pair of brackets around something tall is as tall as it is.
  const grown: Item[] = []
  const opened: number[] = []
  for (const item of tidy) {
    const pair = typeof item === 'string' ? PAIRS[item] : undefined
    if (pair !== undefined) {
      let from = opened.length - 1
      while (from >= 0 && grown[opened[from]!] !== pair) from--
      if (from >= 0) {
        const start = opened[from]!
        opened.length = from
        const inside = grown.slice(start + 1)
        if (inside.some((part) => typeof part !== 'string' && part.rows.length > 1)) {
          grown.length = start
          grown.push(delimited(assemble(inside), pair, item as string))
          continue
        }
      }
    }
    if (typeof item === 'string' && (item === '(' || item === '[')) opened.push(grown.length)
    grown.push(item)
  }
  // Text joined into words; a piece that stands apart, a space from what touches it.
  const parts: Box[] = []
  let run = ''
  const flush = () => {
    if (run) parts.push(text(run.normalize('NFC').replaceAll(HARD, ' ')))
    run = ''
  }
  grown.forEach((item, index) => {
    if (typeof item === 'string') {
      run += item
      return
    }
    if (item.apart && run && !run.endsWith(' ') && !run.endsWith(HARD)) run += ' '
    flush()
    parts.push(item)
    const next = grown[index + 1]
    if (item.apart && next !== undefined && next !== ' ' && next !== HARD) run = ' '
  })
  flush()
  return beside(parts)
}

class Layout {
  private at = 0
  private depth = 0

  constructor(private readonly source: string) {}

  /** Whether the run is at a `\\` that breaks the formula's rows; reads past it if so. */
  rowBreak(): boolean {
    if (!this.source.startsWith('\\\\', this.at)) return false
    this.at += 2
    this.skipLength()
    return true
  }

  done(): boolean {
    return this.at >= this.source.length
  }

  /** The run from here to its stop, as one box. */
  run(stop: Stop): Box {
    const items: Item[] = []
    while (this.at < this.source.length && !this.stopsAt(stop)) {
      const char = this.source[this.at]
      if (char === '^' || char === '_') {
        let sup: Box | null = null
        let sub: Box | null = null
        // A letter's two scripts, in either order, are set together.
        for (let taken = 0; taken < 2; taken++) {
          const mark = this.source[this.at]
          if (mark === '^' && sup === null) {
            this.at++
            sup = this.argument()
          } else if (mark === '_' && sub === null) {
            this.at++
            sub = this.argument()
          } else break
        }
        // A script after a bracket that closes something tall belongs to the grown pair.
        const base = items.pop()
        items.push(
          scripted(typeof base === 'string' ? (grownPair(items, base) ?? base) : base, sup, sub),
        )
        continue
      }
      for (const item of this.piece()) items.push(item)
    }
    return assemble(items)
  }

  private stopsAt(stop: Stop): boolean {
    const char = this.source[this.at]
    switch (stop) {
      case 'group':
        return char === '}'
      case 'index':
        return char === ']' || char === '}'
      case 'cell':
        return char === '&' || this.source.startsWith('\\\\', this.at) || this.endsEnvironment()
      case 'right':
        return this.startsCommand('right')
      case 'row':
        return this.source.startsWith('\\\\', this.at)
      default:
        return false
    }
  }

  private startsCommand(name: string): boolean {
    if (!this.source.startsWith(`\\${name}`, this.at)) return false
    const after = this.source[this.at + name.length + 1]
    return after === undefined || !/[a-zA-Z]/.test(after)
  }

  private endsEnvironment(): boolean {
    return this.startsCommand('end')
  }

  /** The `[2em]` a row break may carry, read past. */
  private skipLength(): void {
    if (this.source[this.at] !== '[') return
    const close = this.source.indexOf(']', this.at)
    if (close !== -1 && close - this.at < 20) this.at = close + 1
  }

  /** The next thing, as the items it is. Always moves on. */
  private piece(): Item[] {
    const char = String.fromCodePoint(this.source.codePointAt(this.at)!)
    this.at += char.length
    switch (char) {
      case '\\':
        return this.command()
      case '{':
        return [this.group()]
      case '&':
      case '}':
        // Outside a group or a cell they are not text: `math.ts` writes nothing for them either.
        return char === '}' ? ['}'] : []
      case '~':
        return [' ']
      case '\n':
      case '\r':
      case '\t':
        return [' ']
      default:
        return [char]
    }
  }

  private group(): Box {
    if (this.depth >= MAX_DEPTH) return text('{')
    this.depth++
    const inside = this.run('group')
    this.depth--
    if (this.source[this.at] === '}') this.at++
    return inside
  }

  /** What a command or a script takes: a group, or the one thing that comes next. */
  private argument(): Box {
    while (this.source[this.at] === ' ') this.at++
    const next = this.source[this.at]
    if (next === undefined || next === '}' || this.depth >= MAX_DEPTH) return EMPTY
    if (next === '{') {
      this.at++
      return this.group()
    }
    this.depth++
    const one = assemble(this.piece())
    this.depth--
    return one
  }

  /** An argument as its text on one row, for what is written and not set: an accent's letters. */
  private argumentText(): string {
    const box = this.argument()
    return box.rows.length === 1 ? box.rows[0]!.trim() : box.rows.join(' ').trim()
  }

  private index(): string {
    if (this.source[this.at] !== '[' || this.depth >= MAX_DEPTH) return ''
    this.at++
    this.depth++
    const inside = this.run('index')
    this.depth--
    if (this.source[this.at] === ']') this.at++
    return inside.rows.length === 1 ? inside.rows[0]!.trim() : ''
  }

  /** The `{name}` after `\begin` or `\end`, read past. */
  private name(): string {
    if (this.source[this.at] !== '{') return ''
    const from = this.at + 1
    const close = this.source.indexOf('}', from)
    this.at = close === -1 ? this.source.length : close + 1
    return this.source.slice(from, close === -1 ? undefined : close).trim()
  }

  /** The delimiter after `\left`, `\right` or `\big`: a character, or a command that is one. */
  private delimiterAfter(): string {
    while (this.source[this.at] === ' ') this.at++
    const char = this.source[this.at]
    if (char === undefined) return ''
    if (char !== '\\') {
      this.at += char.length
      return char
    }
    this.at++
    LETTERS.lastIndex = this.at
    const name = LETTERS.exec(this.source)?.[0]
    if (name === undefined) {
      const escaped = this.source[this.at] ?? ''
      this.at += escaped.length
      return DELIMITERS[escaped] ?? escaped
    }
    this.at += name.length
    return DELIMITERS[name] ?? SYMBOLS.get(name) ?? ''
  }

  /** The command whose backslash was just read. */
  private command(): Item[] {
    LETTERS.lastIndex = this.at
    const name = LETTERS.exec(this.source)?.[0]
    if (name === undefined) return this.escaped()
    this.at += name.length
    if (name === 'left') {
      const open = this.delimiterAfter()
      if (this.depth >= MAX_DEPTH) return [open]
      this.depth++
      const inside = this.run('right')
      this.depth--
      let close = ''
      if (this.startsCommand('right')) {
        this.at += 6
        close = this.delimiterAfter()
      }
      return [delimited(inside, open, close)]
    }
    const symbol = SYMBOLS.get(name)
    if (symbol !== undefined)
      return [LIMITS.has(symbol) ? { ...text(symbol), limits: true } : symbol]
    if (FUNCTIONS.has(name)) return [LIMITS.has(name) ? { ...text(name), limits: true } : name]
    const accent = ACCENTS[name]
    if (accent !== undefined) return [accented(this.argumentText(), accent)]
    if (TRANSPARENT.has(name)) return [this.argument()]
    if (DROPPED.has(name)) {
      if (name === 'right' && this.source[this.at] === '.') this.at++
      return []
    }
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac':
      case 'cfrac': {
        const over = this.argument()
        return [fraction(over, this.argument())]
      }
      case 'binom':
      case 'dbinom':
      case 'tbinom': {
        const from = this.argument()
        const pick = this.argument()
        return [{ ...delimited(under([from, pick], 0, 'center'), '(', ')'), apart: true }]
      }
      case 'sqrt': {
        const index = this.index()
        return [root(this.argument(), index)]
      }
      case 'mathbb':
        return [[...this.argumentText()].map((char) => DOUBLE.get(char) ?? char).join('')]
      case 'not':
        return [`${this.argumentText()}̸`]
      case 'tag':
        return [HARD, HARD, `(${this.argumentText()})`]
      case 'pmod':
        return [' ', `(mod ${this.argumentText()})`]
      case 'quad':
        return [HARD, HARD]
      case 'qquad':
        return [HARD, HARD, HARD, HARD]
      case 'begin':
        return [this.environment(this.name())]
      case 'end':
        this.name()
        return []
    }
    // Not known: as it was written, with what it took.
    let out = `\\${name}`
    while (this.source[this.at] === '{' && this.depth < MAX_DEPTH) {
      this.at++
      const inside = this.group()
      out += `{${inside.rows.length === 1 ? inside.rows[0] : inside.rows.join(' ')}}`
    }
    return [out]
  }

  private escaped(): Item[] {
    const char = this.source[this.at]
    if (char === undefined) return ['\\']
    // A row break ends the run that holds it: it is read by whoever asked for the run.
    if (char === '\\') return ['\\']
    this.at++
    if (char === ',' || char === ';' || char === ':' || char === ' ') return [' ']
    if (char === '!') return []
    if (char === '|') return ['‖']
    if ('{}%$&_#'.includes(char)) return [char]
    return [`\\${char}`]
  }

  /** An environment's rows and columns, laid out as its kind is: a matrix, cases, an alignment. */
  private environment(name: string): Box {
    if (this.depth >= MAX_DEPTH) return text(name)
    // An array says how its columns stand; the rest of what it says is lines, not drawn here.
    const spec = name === 'array' ? this.name().replace(/[^lcr]/g, '') : ''
    this.depth++
    const grid: Box[][] = []
    let row: Box[] = []
    for (;;) {
      row.push(this.run('cell'))
      if (this.source[this.at] === '&') {
        this.at++
        continue
      }
      if (this.rowBreak()) {
        grid.push(row)
        row = []
        continue
      }
      grid.push(row)
      if (this.endsEnvironment()) {
        this.at += 4
        this.name()
      }
      break
    }
    this.depth--
    // A last `\\` before `\end` makes no row.
    const last = grid.at(-1)
    if (grid.length > 1 && last?.length === 1 && last[0]!.width === 0) grid.pop()
    const box = layoutGrid(grid, name, spec)
    if (name === 'cases') return { ...delimited(box, '{', '.'), apart: true }
    const fence = FENCES[name]
    return { ...(fence ? delimited(box, fence[0], fence[1]) : box), apart: true }
  }
}

/** The columns of an environment's grid, each as wide as its widest cell, aligned as its kind is. */
function layoutGrid(grid: Box[][], name: string, spec: string): Box {
  const count = Math.max(...grid.map((row) => row.length))
  const widths = Array.from({ length: count }, (_, column) =>
    Math.max(0, ...grid.map((row) => row[column]?.width ?? 0)),
  )
  // An alignment's columns go in pairs, right then left, the pair's halves meeting at the `&`.
  const aligned = /^(?:aligned|align\*?|alignedat|alignat\*?|split|eqnarray\*?|flalign\*?)$/.test(
    name,
  )
  const gathered = /^(?:gather\*?|gathered)$/.test(name)
  const alignOf = (column: number): 'left' | 'center' | 'right' => {
    if (spec) return spec[column] === 'l' ? 'left' : spec[column] === 'r' ? 'right' : 'center'
    if (aligned) return column % 2 === 0 ? 'right' : 'left'
    if (name === 'cases') return 'left'
    return gathered ? 'center' : 'center'
  }
  // The halves of an alignment's pair meet at the `&`, a space apart: `a = b`.
  const gapBefore = (column: number): number =>
    column === 0 ? 0 : aligned && column % 2 === 1 ? 1 : 2
  const rows = grid.map((row) =>
    beside(
      widths.flatMap((columns, column) => {
        const cell = placed(row[column] ?? EMPTY, columns, alignOf(column))
        return column === 0 ? [cell] : [text(blank(gapBefore(column))), cell]
      }),
    ),
  )
  // Rows that hold something tall are set a row apart, as a matrix of fractions needs to be read.
  const spaced: Box[] = []
  rows.forEach((row, at) => {
    const previous = rows[at - 1]
    if (previous && (previous.rows.length > 1 || row.rows.length > 1)) spaced.push(text(''))
    spaced.push(row)
  })
  const box = under(spaced, 0, 'left')
  return { ...box, base: (box.rows.length - 1) >> 1 }
}

/**
 * A display formula as rows set as a terminal can, or null when it has nothing to set on more
 * than one row, or cannot be set within `columns`: then it is written on one row (`mathRows`).
 */
export function formulaRows(source: string, columns: number): string[] | null {
  if (source.length > MAX_LENGTH || !/[\\^_]/.test(source)) return null
  const layout = new Layout(source)
  const boxes: Box[] = []
  for (;;) {
    const box = layout.run('row')
    if (box.width > 0) boxes.push(box)
    if (!layout.rowBreak()) {
      if (layout.done()) break
      // A stray `}` or `\right` at the top: read it as text, and go on.
      const rest = layout.run('end')
      if (rest.width > 0) boxes.push(rest)
      break
    }
  }
  if (boxes.every((box) => box.rows.length === 1)) return null
  const box = under(boxes, 0, 'left')
  if (box.width > columns || box.rows.length > MAX_ROWS) return null
  return box.rows.map((row) => row.replace(/\s+$/, ''))
}
