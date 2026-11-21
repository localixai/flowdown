/**
 * TeX as models write it, read into a `MathNode`. It reads any text and never throws: a command it
 * does not know is shown as written, and a formula cut off mid-stream reads as far as it goes, its
 * open groups closed and a missing argument left empty, so every prefix of a stream draws.
 *
 * Every construct read has a bound (`MOST_DEPTH`, `MOST_SOURCE`): no text makes it take time or
 * room beyond its size.
 */
import { ACCENTS, DELIMITERS, FUNCTION_TEXT, FUNCTIONS, SPACES, SYMBOLS, type MathSymbol } from './symbols'
import { EMPTY, row, type MathNode, type OperatorKind, type Variant } from './tree'

/** Past this nesting the rest of a group is read as text: no formula a model writes goes deeper. */
const MOST_DEPTH = 48
/** Past this many characters a formula is not read on. */
export const MOST_SOURCE = 20_000

const VARIANTS: Record<string, Variant> = {
  mathbf: 'bold', textbf: 'bold', bm: 'bold-italic', boldsymbol: 'bold-italic', mathbfit: 'bold-italic',
  mathit: 'italic', textit: 'italic', mathbb: 'double-struck', Bbb: 'double-struck', mathcal: 'script',
  mathscr: 'script', mathfrak: 'fraktur', mathsf: 'sans-serif', textsf: 'sans-serif',
  mathtt: 'monospace', texttt: 'monospace', mathrm: 'normal', textrm: 'normal', mathup: 'normal',
  mathnormal: 'italic', mathbfcal: 'bold-script', mathbfsf: 'bold-sans-serif',
}
const TEXTS = new Set(['text', 'textrm', 'textnormal', 'mbox', 'textbf', 'textit', 'textsf', 'texttt', 'textup', 'hbox'])
const SIZES: Record<string, number> = { big: 1.2, Big: 1.8, bigg: 2.4, Bigg: 3 }
const ESCAPED: Record<string, string> = { '{': '{', '}': '}', '$': '$', '%': '%', '&': '&', '#': '#', '_': '_', '|': '‖' }
const CHAR_OPERATORS: Record<string, [string, OperatorKind]> = {
  '+': ['+', 'bin'], '-': ['−', 'bin'], '*': ['∗', 'bin'], '=': ['=', 'rel'], '<': ['<', 'rel'],
  '>': ['>', 'rel'], ':': [':', 'rel'], ',': [',', 'punct'], ';': [';', 'punct'], '(': ['(', 'open'],
  ')': [')', 'close'], '[': ['[', 'open'], ']': [']', 'close'], '|': ['|', 'fence'], '/': ['/', 'ord'],
  '!': ['!', 'close'], '?': ['?', 'close'], '.': ['.', 'ord'], '@': ['@', 'ord'], '"': ['"', 'ord'],
}
const IGNORED = new Set(['label', 'nonumber', 'notag', 'limits', 'nolimits', 'displaylimits', 'relax', 'allowbreak', 'nobreak', 'strut', 'mathstrut', 'centering', 'left.', 'right.'])
/** Environments and what they are: matrix delimiters, and how cells align. */
const MATRICES: Record<string, [string, string]> = {
  matrix: ['', ''], pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'],
  Vmatrix: ['‖', '‖'], smallmatrix: ['', ''],
}

type Stop = '}' | '&' | '\\\\' | 'end' | 'right' | 'middle' | ']'

class Reader {
  at = 0
  depth = 0
  constructor(readonly text: string) {}

  get done(): boolean {
    return this.at >= this.text.length
  }

  peek(): string {
    return this.text[this.at] ?? ''
  }

  skipSpace(): void {
    while (/\s/.test(this.peek())) this.at++
  }

  /** A command's name after its backslash: letters, or one other character. */
  command(): string {
    const start = this.at
    if (/[a-zA-Z]/.test(this.peek())) {
      while (/[a-zA-Z]/.test(this.peek())) this.at++
      // `\operatorname*` and the starred environments: the star belongs to the name.
      if (this.peek() === '*') this.at++
      return this.text.slice(start, this.at)
    }
    if (this.done) return ''
    this.at++
    return this.text.slice(start, this.at)
  }

  /** Whether the next command is `name` (consumed when it is). */
  lookCommand(name: string): boolean {
    this.skipSpace()
    if (this.text.startsWith(`\\${name}`, this.at) && !/[a-zA-Z]/.test(this.text[this.at + name.length + 1] ?? '')) {
      this.at += name.length + 1
      return true
    }
    return false
  }

  /** `{…}` as raw text, nested braces kept (for `\text`, `\begin`, colours, column specs). */
  rawGroup(): string {
    this.skipSpace()
    if (this.peek() !== '{') {
      if (this.done) return ''
      // One character or one command stands for a group of one.
      if (this.peek() === '\\') {
        this.at++
        return `\\${this.command()}`
      }
      return this.text[this.at++]!
    }
    this.at++
    let depth = 1
    const start = this.at
    while (!this.done) {
      const char = this.text[this.at]!
      if (char === '\\') this.at += 2
      else {
        if (char === '{') depth++
        if (char === '}' && --depth === 0) break
        this.at++
      }
    }
    const inside = this.text.slice(start, Math.min(this.at, this.text.length))
    this.at = Math.min(this.at + 1, this.text.length)
    return inside
  }

  /** `[…]` if one comes next, as raw text. */
  rawOption(): string | null {
    this.skipSpace()
    if (this.peek() !== '[') return null
    const close = this.text.indexOf(']', this.at)
    const end = close < 0 ? this.text.length : close
    const inside = this.text.slice(this.at + 1, end)
    this.at = Math.min(end + 1, this.text.length)
    return inside
  }
}

/** `source` read as one formula. */
export function parse(source: string): MathNode {
  const reader = new Reader(source.slice(0, MOST_SOURCE))
  const lines: MathNode[] = []
  for (;;) {
    const { nodes, stop } = expression(reader, ['\\\\'])
    lines.push(row(nodes))
    if (stop !== '\\\\') break
    reader.rawOption()
  }
  // Lines broken with `\\` outside an environment: a gathered display, one line under the other.
  if (lines.length === 1) return lines[0]!
  return { type: 'table', rows: lines.map((line) => [line]), align: ['center'], kind: 'gather', open: '', close: '', display: true }
}

/**
 * Atoms up to a stop the caller names (a `}` of its group, a cell's `&`, a row's `\\`, `\end`,
 * `\right`), scripts attached to what they follow and `\over` splitting what it divides.
 */
function expression(reader: Reader, stops: readonly Stop[]): { nodes: MathNode[]; stop: Stop | null } {
  const nodes: MathNode[] = []
  let over: { kind: 'over' | 'choose' | 'atop'; before: MathNode[] } | null = null
  reader.depth++
  const finish = (stop: Stop | null): { nodes: MathNode[]; stop: Stop | null } => {
    reader.depth--
    if (!over) return { nodes, stop }
    const numerator = row(over.before)
    const denominator = row(nodes)
    const fraction: MathNode = { type: 'fraction', numerator, denominator, rule: over.kind === 'over' }
    return { nodes: [over.kind === 'choose' ? { type: 'fenced', open: '(', close: ')', body: fraction } : fraction], stop }
  }
  if (reader.depth > MOST_DEPTH) {
    nodes.push({ type: 'text', text: reader.text.slice(reader.at) })
    reader.at = reader.text.length
    return finish(null)
  }
  while (!reader.done) {
    reader.skipSpace()
    if (reader.done) break
    const char = reader.peek()
    if (char === '}' && stops.includes('}')) {
      reader.at++
      return finish('}')
    }
    if (char === ']' && stops.includes(']')) {
      reader.at++
      return finish(']')
    }
    if (char === '&' && stops.includes('&')) {
      reader.at++
      return finish('&')
    }
    if (char === '\\') {
      const mark = reader.at
      reader.at++
      const name = reader.command()
      if (name === '\\' || name === 'newline' || name === 'cr') {
        if (stops.includes('\\\\')) return finish('\\\\')
        continue
      }
      if (name === 'end' && stops.includes('end')) {
        reader.rawGroup()
        return finish('end')
      }
      if (name === 'right' && stops.includes('right')) return finish('right')
      if (name === 'middle' && stops.includes('middle')) return finish('middle')
      if (name === 'over' || name === 'choose' || name === 'atop') {
        over = { kind: name, before: nodes.splice(0) }
        continue
      }
      if (name === 'limits' || name === 'nolimits') {
        const last = nodes.at(-1)
        const target = last?.type === 'scripts' ? last.base : last
        if (target?.type === 'operator' || target?.type === 'function') target.limits = name === 'limits'
        continue
      }
      reader.at = mark
    }
    if (char === '^' || char === '_') {
      reader.at++
      attachScript(reader, nodes, char)
      continue
    }
    if (char === "'") {
      let primes = 0
      while (reader.peek() === "'") {
        primes++
        reader.at++
      }
      // A prime sits after its letter at the letter's own height, as the font draws it: set as a
      // superscript it would ride a second time above the line.
      nodes.push({ type: 'operator', text: ['′', '″', '‴', '⁗'][Math.min(primes, 4) - 1]!, kind: 'ord' })
      continue
    }
    const atom = readAtom(reader, stops)
    if (atom) nodes.push(atom)
  }
  return finish(null)
}

/** The script after `^` or `_`, set on the atom before it (an empty one when there is none). */
function attachScript(reader: Reader, nodes: MathNode[], mark: '^' | '_'): void {
  reader.skipSpace()
  const script = argument(reader)
  attach(nodes, mark === '^' ? 'sup' : 'sub', script)
}

function attach(nodes: MathNode[], place: 'sup' | 'sub', script: MathNode): void {
  const last = nodes.pop()
  if (last?.type === 'scripts' && last[place] === undefined) {
    last[place] = script
    nodes.push(last)
    return
  }
  // A prime then a power: `f'^2` puts both above, as TeX does.
  if (last?.type === 'scripts' && place === 'sup' && last.sup) {
    last.sup = row([last.sup, script])
    nodes.push(last)
    return
  }
  const base = last ?? EMPTY
  const limits = base.type === 'operator' || base.type === 'function' ? base.limits : base.type === 'accent' && base.stretchy && /[⏞⏟⏜⏝⎴⎵]/.test(base.char) ? true : undefined
  const scripts: MathNode = { type: 'scripts', base, [place]: script }
  if (limits !== undefined && scripts.type === 'scripts') scripts.limits = limits
  nodes.push(scripts)
}

/** A command's argument: a group, or the one atom that follows. Empty when the text ends. */
function argument(reader: Reader): MathNode {
  reader.skipSpace()
  if (reader.done) return EMPTY
  if (reader.peek() === '{') {
    reader.at++
    return row(expression(reader, ['}']).nodes)
  }
  // Without braces an argument is one character, as in TeX: `\frac12` is a half.
  if (/[0-9]/.test(reader.peek())) return { type: 'number', text: reader.text[reader.at++]! }
  return readAtom(reader, []) ?? EMPTY
}

/** `[…]` read as math, when one comes next. */
function optional(reader: Reader): MathNode | null {
  reader.skipSpace()
  if (reader.peek() !== '[') return null
  reader.at++
  return row(expression(reader, [']']).nodes)
}

function symbolNode(symbol: MathSymbol): MathNode {
  switch (symbol.kind) {
    case 'ord':
      return { type: 'identifier', text: symbol.char }
    case 'upright':
      return { type: 'identifier', text: symbol.char, upright: true }
    case 'dots':
      return { type: 'operator', text: symbol.char, kind: 'ord' }
    case 'op':
      return symbol.limits === false
        ? { type: 'operator', text: symbol.char, kind: 'op', limits: false }
        : { type: 'operator', text: symbol.char, kind: 'op' }
    default:
      return { type: 'operator', text: symbol.char, kind: symbol.kind }
  }
}

function readAtom(reader: Reader, stops: readonly Stop[]): MathNode | null {
  const char = reader.peek()
  if (char === '{') {
    reader.at++
    return row(expression(reader, ['}']).nodes)
  }
  if (char === '}') {
    // A brace that closes nothing: shown, as TeX would complain of it.
    reader.at++
    return { type: 'operator', text: '}', kind: 'close' }
  }
  if (char === '\\') {
    reader.at++
    return readCommand(reader, reader.command(), stops)
  }
  if (/[0-9]/.test(char)) {
    const start = reader.at
    while (/[0-9]/.test(reader.peek()) || (reader.peek() === '.' && /[0-9]/.test(reader.text[reader.at + 1] ?? ''))) reader.at++
    return { type: 'number', text: reader.text.slice(start, reader.at) }
  }
  reader.at++
  if (/[a-zA-Z]/.test(char)) return { type: 'identifier', text: char }
  if (char === '~') return { type: 'space', width: 0.25 }
  if (char === '&') return { type: 'operator', text: '&', kind: 'ord' }
  if (char === '$') return null
  const operator = CHAR_OPERATORS[char]
  if (operator) return { type: 'operator', text: operator[0], kind: operator[1] }
  // Any other character (a letter of another script, an emoji): an identifier, as written.
  const code = char.codePointAt(0) ?? 0
  const whole = code > 0xffff ? String.fromCodePoint(code) : char
  if (whole.length === 2) reader.at++
  return { type: 'identifier', text: whole }
}

function readCommand(reader: Reader, name: string, stops: readonly Stop[]): MathNode | null {
  if (name === '') return null
  const escaped = ESCAPED[name]
  if (escaped !== undefined) return escaped === '‖' ? { type: 'operator', text: '‖', kind: 'fence' } : { type: 'operator', text: escaped, kind: escaped === '{' ? 'open' : escaped === '}' ? 'close' : 'ord' }
  const space = SPACES[name]
  if (space !== undefined) return { type: 'space', width: space }
  const symbol = SYMBOLS.get(name)
  if (symbol) return symbolNode(symbol)
  if (FUNCTIONS.has(name)) return { type: 'function', text: FUNCTION_TEXT[name] ?? name, limits: FUNCTIONS.get(name)! }
  const accent = ACCENTS[name]
  if (accent) return { type: 'accent', base: argument(reader), char: accent.char, stretchy: accent.stretchy, under: accent.under === true }
  const variant = VARIANTS[name]
  if (variant && !TEXTS.has(name)) return { type: 'variant', variant, body: argument(reader) }
  if (TEXTS.has(name)) {
    const text: MathNode = { type: 'text', text: textOf(reader.rawGroup()) }
    return variant && variant !== 'normal' ? { type: 'variant', variant, body: text } : text
  }
  if (IGNORED.has(name)) {
    if (name === 'label') reader.rawGroup()
    return null
  }
  if (name in SIZES || /^[bB]igg?[lrm]$/.test(name)) {
    const size = SIZES[name.replace(/[lrm]$/, '')] ?? 1.2
    const delimiter = delimiterAfter(reader)
    const kind: OperatorKind = name.endsWith('l') ? 'open' : name.endsWith('r') ? 'close' : 'fence'
    return { type: 'operator', text: delimiter, kind, stretchy: true, size }
  }
  switch (name) {
    case 'frac':
    case 'dfrac':
    case 'tfrac':
    case 'cfrac': {
      const numerator = argument(reader)
      const denominator = argument(reader)
      const fraction: MathNode = { type: 'fraction', numerator, denominator, rule: true }
      if (name === 'dfrac' || name === 'cfrac') fraction.style = 'display'
      if (name === 'tfrac') fraction.style = 'text'
      return fraction
    }
    case 'binom':
    case 'dbinom':
    case 'tbinom': {
      const numerator = argument(reader)
      const denominator = argument(reader)
      const fraction: MathNode = { type: 'fraction', numerator, denominator, rule: false }
      if (name === 'dbinom') fraction.style = 'display'
      if (name === 'tbinom') fraction.style = 'text'
      return { type: 'fenced', open: '(', close: ')', body: fraction }
    }
    case 'sqrt': {
      const index = optional(reader)
      const body = argument(reader)
      return index ? { type: 'root', body, index } : { type: 'root', body }
    }
    case 'left':
      return fenced(reader)
    case 'operatorname':
    case 'operatorname*':
    case 'mathop': {
      const inside = parse(reader.rawGroup())
      const text = plainText(inside)
      if (text !== null && name !== 'mathop') return { type: 'function', text, limits: name.endsWith('*') }
      return name === 'mathop' && text !== null ? { type: 'operator', text, kind: 'op', limits: true } : inside
    }
    case 'overset':
    case 'stackrel': {
      const over = argument(reader)
      return { type: 'stack', base: argument(reader), over }
    }
    case 'underset': {
      const under = argument(reader)
      return { type: 'stack', base: argument(reader), under }
    }
    case 'xrightarrow':
    case 'xleftarrow':
    case 'xRightarrow':
    case 'xLeftarrow':
    case 'xleftrightarrow':
    case 'xLeftrightarrow':
    case 'xmapsto':
    case 'xhookrightarrow':
    case 'xtwoheadrightarrow': {
      const under = optional(reader)
      const over = argument(reader)
      const arrow = SYMBOLS.get(name.slice(1).replace(/^(.)/, (first) => first))?.char ?? ARROWS[name] ?? '→'
      const stack: MathNode = { type: 'stack', base: { type: 'operator', text: arrow, kind: 'rel', stretchy: true }, over }
      if (under && stack.type === 'stack') stack.under = under
      return stack
    }
    case 'begin':
      return environment(reader, reader.rawGroup().trim())
    case 'color': {
      const color = safeColor(reader.rawGroup())
      // `\color{red}` colours the rest of its group.
      const { nodes, stop } = expression(reader, stops)
      if (stop === '}') reader.at--
      else if (stop === '&') reader.at--
      else if (stop === '\\\\') reader.at -= 2
      return color ? { type: 'color', color, body: row(nodes) } : row(nodes)
    }
    case 'textcolor':
    case 'colorbox': {
      const color = safeColor(reader.rawGroup())
      const body = argument(reader)
      return color && name === 'textcolor' ? { type: 'color', color, body } : body
    }
    case 'boxed':
    case 'fbox':
      return { type: 'boxed', body: argument(reader) }
    case 'phantom':
    case 'hphantom':
    case 'vphantom':
      return { type: 'phantom', body: argument(reader) }
    case 'displaystyle':
    case 'textstyle':
    case 'scriptstyle': {
      const { nodes, stop } = expression(reader, stops)
      if (stop === '}' || stop === '&') reader.at--
      else if (stop === '\\\\') reader.at -= 2
      return { type: 'style', style: name === 'displaystyle' ? 'display' : name === 'textstyle' ? 'text' : 'script', body: row(nodes) }
    }
    case 'not': {
      const next = argument(reader)
      if (next.type === 'operator' || next.type === 'identifier') return { ...next, text: `${next.text}\u0338` }
      return next
    }
    case 'pmod':
      return row([{ type: 'space', width: 1 }, { type: 'operator', text: '(', kind: 'open' }, { type: 'function', text: 'mod', limits: false }, argument(reader), { type: 'operator', text: ')', kind: 'close' }])
    case 'bmod':
      return { type: 'operator', text: 'mod', kind: 'bin' }
    case 'mod':
      return row([{ type: 'space', width: 1 }, { type: 'function', text: 'mod', limits: false }])
    case 'tag':
    case 'tag*': {
      const tag = reader.rawGroup()
      return row([{ type: 'space', width: 2 }, { type: 'text', text: name === 'tag' ? `(${textOf(tag)})` : textOf(tag) }])
    }
    case 'hspace':
    case 'hspace*':
    case 'mspace':
    case 'hskip':
    case 'mskip':
    case 'kern':
    case 'mkern':
      return { type: 'space', width: length(name.startsWith('h') || name.startsWith('m') && name !== 'mkern' && name !== 'mskip' ? reader.rawGroup() : reader.rawGroup()) }
    case 'cancel':
    case 'bcancel':
    case 'xcancel':
    case 'sout':
    case 'smash':
    case 'mathrlap':
    case 'mathllap':
    case 'mathclap':
    case 'rlap':
    case 'llap':
      return argument(reader)
    case 'substack': {
      reader.skipSpace()
      if (reader.peek() !== '{') return argument(reader)
      reader.at++
      const rows: MathNode[][] = []
      for (;;) {
        const { nodes, stop } = expression(reader, ['}', '\\\\'])
        rows.push([row(nodes)])
        if (stop !== '\\\\') break
      }
      return { type: 'table', rows, align: ['center'], kind: 'small', open: '', close: '', display: false }
    }
    case 'dots':
      return { type: 'operator', text: '…', kind: 'ord' }
    default:
      return { type: 'error', text: `\\${name}` }
  }
}

const ARROWS: Record<string, string> = {
  xrightarrow: '→', xleftarrow: '←', xRightarrow: '⇒', xLeftarrow: '⇐', xleftrightarrow: '↔',
  xLeftrightarrow: '⇔', xmapsto: '↦', xhookrightarrow: '↪', xtwoheadrightarrow: '↠',
}

/** The delimiter after `\left`, `\big` and the like: one character or one command. */
function delimiterAfter(reader: Reader): string {
  reader.skipSpace()
  if (reader.peek() === '\\') {
    const mark = reader.at
    reader.at++
    const name = `\\${reader.command()}`
    const known = DELIMITERS[name]
    if (known !== undefined) return known
    reader.at = mark
    return ''
  }
  const char = reader.peek()
  if (char === '') return ''
  reader.at++
  return DELIMITERS[char] ?? char
}

/** `\left( … \middle| … \right)`: the delimiters grow with what they enclose. */
function fenced(reader: Reader): MathNode {
  const open = delimiterAfter(reader)
  const parts: MathNode[] = []
  for (;;) {
    const { nodes, stop } = expression(reader, ['right', 'middle'])
    parts.push(row(nodes))
    if (stop === 'middle') {
      parts.push({ type: 'operator', text: delimiterAfter(reader), kind: 'fence', stretchy: true })
      continue
    }
    // A stream cut before `\right` closes with nothing, so what is there still draws.
    const close = stop === 'right' ? delimiterAfter(reader) : ''
    return { type: 'fenced', open, close, body: row(parts) }
  }
}

/** `\begin{name} … \end{name}`: the cells, read row by row. */
function environment(reader: Reader, name: string): MathNode {
  const bare = name.replace(/\*$/, '')
  let align: Array<'left' | 'center' | 'right'> = []
  if (bare === 'array' || bare === 'subarray') align = columns(reader.rawGroup())
  if (name.endsWith('matrix*')) {
    const spec = reader.rawOption()
    if (spec) align = columns(spec)
  }
  if (bare === 'alignat' || bare === 'alignedat') reader.rawGroup()
  const rows: MathNode[][] = [[]]
  for (;;) {
    const { nodes, stop } = expression(reader, ['&', '\\\\', 'end'])
    rows.at(-1)!.push(row(nodes))
    if (stop === '&') continue
    if (stop === '\\\\') {
      reader.rawOption()
      rows.push([])
      continue
    }
    break
  }
  // A trailing `\\` leaves an empty last row: TeX draws none.
  const last = rows.at(-1)!
  if (rows.length > 1 && last.length === 1 && last[0]!.type === 'row' && last[0]!.children.length === 0) rows.pop()

  const matrix = MATRICES[bare]
  if (matrix) {
    return { type: 'table', rows, align: align.length ? align : ['center'], kind: bare === 'smallmatrix' ? 'small' : 'matrix', open: matrix[0], close: matrix[1], display: false }
  }
  if (bare === 'cases' || bare === 'dcases' || bare === 'rcases' || bare === 'drcases') {
    const right = bare.includes('r')
    return { type: 'table', rows, align: ['left', 'left'], kind: 'cases', open: right ? '' : '{', close: right ? '}' : '', display: bare.startsWith('d') }
  }
  if (['aligned', 'align', 'alignat', 'alignedat', 'split', 'eqnarray', 'flalign'].includes(bare)) {
    return { type: 'table', rows, align: ['right', 'left'], kind: 'aligned', open: '', close: '', display: true }
  }
  if (bare === 'gather' || bare === 'gathered' || bare === 'multline') {
    return { type: 'table', rows, align: ['center'], kind: 'gather', open: '', close: '', display: true }
  }
  if (bare === 'array' || bare === 'subarray') {
    return { type: 'table', rows, align: align.length ? align : ['center'], kind: 'array', open: '', close: '', display: false }
  }
  // `equation` and any other: its one cell as it is.
  return rows.length === 1 && rows[0]!.length === 1 ? rows[0]![0]! : { type: 'table', rows, align: ['center'], kind: 'gather', open: '', close: '', display: true }
}

function columns(spec: string): Array<'left' | 'center' | 'right'> {
  const out: Array<'left' | 'center' | 'right'> = []
  for (const char of spec) {
    if (char === 'l') out.push('left')
    else if (char === 'c') out.push('center')
    else if (char === 'r') out.push('right')
  }
  return out
}

/** A colour name or a hex colour; anything else (a `url(`, an expression) is dropped. */
function safeColor(text: string): string | null {
  const color = text.trim()
  if (/^[a-zA-Z]{1,20}$/.test(color)) return color
  if (/^#?[0-9a-fA-F]{3,8}$/.test(color)) return color.startsWith('#') ? color : `#${color}`
  return null
}

/** A TeX length in em: `1em`, `2mu`, `3pt`, `0.5ex`. */
function length(text: string): number {
  const hit = /^\s*(-?[0-9.]+)\s*(em|ex|mu|pt|px|mm|cm|in)?/.exec(text)
  if (!hit) return 0
  const value = Number(hit[1])
  if (!Number.isFinite(value)) return 0
  const unit = hit[2] ?? 'em'
  const em = { em: 1, ex: 0.43, mu: 1 / 18, pt: 0.1, px: 0.0625, mm: 0.284, cm: 2.84, in: 7.2 }[unit] ?? 1
  return Math.max(-10, Math.min(10, value * em))
}

/** `\text{…}`'s inside: its escapes undone, and math in `$…$` left as written. */
function textOf(raw: string): string {
  return raw.replace(/\\([{}$%&#_ ])/g, '$1').replace(/\\textbackslash\b/g, '\\').replace(/~/g, '\u00a0')
}

/** A node's letters when it holds nothing but letters (what `\operatorname` names). */
function plainText(node: MathNode): string | null {
  if (node.type === 'identifier' || node.type === 'number') return node.text
  if (node.type === 'text') return node.text
  if (node.type === 'operator' && node.kind === 'ord') return node.text
  if (node.type === 'operator' && node.text === '−') return '-'
  if (node.type === 'row') {
    let text = ''
    for (const child of node.children) {
      const part = plainText(child)
      if (part === null) return null
      text += part
    }
    return text
  }
  return null
}
