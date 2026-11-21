/**
 * The tokenizer: a grammar is states, each a list of rules; a line is read from the state the line
 * above ended in, and ends in a state of its own. That is what lets code that streams be coloured
 * a line at a time: a line that is complete is never read again, and the line still being written
 * is read from where the one above it stopped, so a comment or a string opened twenty lines up is
 * still one while the text arrives.
 *
 * A state's rules are joined into one regular expression, searched forward from where the last
 * token ended (what highlight.js does too): the first rule to match at the leftmost place wins.
 * Text between two matches is the state's `fill`, plain in code and string inside a string.
 */

/**
 * A token's kind, as highlight.js names it (`keyword`, `string`, `title function_`), so its
 * themes, flowdown's styles and its terminal colours apply as they are.
 */
export type Scope = string

export interface Rule {
  /** A pattern with no capturing group and no flags: a state's rules become one alternation. */
  match: RegExp
  /** The token's kind, or a function of its text (a word list). None: the state's fill. */
  scope?: Scope | ((text: string) => Scope | undefined) | undefined
  /** Enters this state after the token. */
  push?: string
  /**
   * For a state made for its opener (a heredoc's word, a raw string's `#`s): its argument, from
   * the token and the line it is on (a YAML block's indent).
   */
  arg?: (text: string, line: string) => string
  /** Leaves the state after the token. */
  pop?: true
  /** Replaces the state with this one after the token. */
  next?: string
}

export interface State {
  /** The rules, or rules made for an argument the opening token gave. */
  rules: readonly Rule[] | ((arg: string) => readonly Rule[])
  /** The kind of the text no rule matches: `string` inside a string. */
  fill?: Scope
  /** The state ends with its line (a preprocessor line, a shell command's words). */
  line?: true
  /**
   * With `line`: the state it becomes when its line ends, with the same argument. A heredoc's
   * text starts on the line after `<<EOF`, whatever that line goes on to say.
   */
  after?: string
  /**
   * The lines of the state are another language's (a fence in Markdown): a line its rules do not
   * end the state with is read by that language's grammar, from the state its last line ended
   * in. The state's argument is its own (the fence's marker), then {@link EMBED} and the language.
   */
  embed?: true
}

/** Parts the argument of an embedding state: its own, the language, the language's state. */
export const EMBED = '\u0002'
/** Stands for a space in the state of an embedded language, inside the state of this one. */
const SPACE = '\u0001'

export interface Grammar {
  /** The name a fence uses, and the others it is known by. */
  name: string
  aliases?: readonly string[]
  /** `root` is where a file starts. */
  states: Readonly<Record<string, State>>
}

/** A line's result: its HTML, and the state the next line starts in. */
export interface Line {
  html: string
  end: string
}

/** How deep states nest (`${` in a template in a `${`…): past it, an opener is read as text. */
const DEPTH = 24

interface Compiled {
  search: RegExp
  rules: readonly Rule[]
  fill: Scope | undefined
  line: boolean
  after: string | undefined
  embed: boolean
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** `<`, `>`, `&` and quotes as entities: the HTML goes into a page as it is. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character]!)
}

const classes = new Map<string, string>()
/** `title function_` as highlight.js writes it: `hljs-title function_`. */
function classOf(scope: Scope): string {
  let name = classes.get(scope)
  if (name === undefined) {
    name = `hljs-${scope}`
    classes.set(scope, name)
  }
  return name
}

/** A grammar ready to read lines: its states compiled the first time each is entered. */
export class Tokenizer {
  readonly name: string
  private readonly grammar: Grammar
  private readonly compiled = new Map<string, Compiled>()

  private readonly resolve: (language: string) => Tokenizer | null

  /** `resolve` finds the tokenizer of a language another one embeds (a Markdown fence's). */
  constructor(grammar: Grammar, resolve: (language: string) => Tokenizer | null = () => null) {
    this.name = grammar.name
    this.grammar = grammar
    this.resolve = resolve
    if (!grammar.states.root) throw new Error(`${grammar.name}: no root state`)
  }

  /** The state a file starts in. */
  readonly start = 'root'

  private state(full: string): Compiled {
    // An embedding state is compiled for its own argument, whatever the language's state is.
    const cut = full.indexOf(EMBED)
    const key = cut === -1 ? full : full.slice(0, cut)
    const known = this.compiled.get(key)
    if (known) return known
    const colon = key.indexOf(':')
    const name = colon === -1 ? key : key.slice(0, colon)
    const state = this.grammar.states[name] ?? this.grammar.states.root!
    const rules =
      typeof state.rules === 'function' ? state.rules(key.slice(colon + 1)) : state.rules
    const compiled: Compiled = {
      // An empty alternation never matches, where `()` would match everywhere.
      search: new RegExp(
        rules.length ? rules.map((rule) => `(${rule.match.source})`).join('|') : '(?!)',
        'g',
      ),
      rules,
      fill: state.fill,
      line: state.line === true,
      after: state.after,
      embed: state.embed === true,
    }
    // States made for an argument are as many as the file's heredocs: keep the cache bounded.
    if (this.compiled.size > 256) this.compiled.clear()
    this.compiled.set(key, compiled)
    return compiled
  }

  /** One line (no `\n` in it), read from `start`: its HTML and the state it ends in. */
  line(text: string, start: string = this.start): Line {
    const stack = start.split(' ')
    const top = stack[stack.length - 1]!
    const embedding = this.state(top)
    if (embedding.embed) {
      // A line that does not end the state is the embedded language's, read from where it was.
      embedding.search.lastIndex = 0
      const ends = embedding.search.exec(text)
      const [own = '', language = '', ...rest] = top.split(EMBED)
      const inner = rest.join(EMBED)
      const other = ends && ends.index === 0 ? null : this.resolve(language)
      // A language does not embed itself: its states would be nested in their own.
      if (other && other.name !== this.name) {
        const read = other.line(text, inner ? inner.split(SPACE).join(' ') : other.start)
        stack[stack.length - 1] = [own, language, read.end.split(' ').join(SPACE)].join(EMBED)
        return { html: read.html, end: stack.join(' ') }
      }
    }
    let html = ''
    let open: Scope | undefined
    let pending = ''
    const flush = () => {
      if (!pending) return
      const escaped = escapeHtml(pending)
      html += open === undefined ? escaped : `<span class="${classOf(open)}">${escaped}</span>`
      pending = ''
    }
    const emit = (part: string, scope: Scope | undefined) => {
      if (!part) return
      if (scope !== open) {
        flush()
        open = scope
      }
      pending += part
    }

    let at = 0
    let still = 0
    while (at <= text.length) {
      const state = this.state(stack[stack.length - 1]!)
      state.search.lastIndex = at
      const found = state.search.exec(text)
      if (!found) {
        emit(text.slice(at), state.fill)
        break
      }
      if (found.index > at) emit(text.slice(at, found.index), state.fill)
      let index = 1
      while (found[index] === undefined) index++
      const rule = state.rules[index - 1]!
      const token = found[0]
      const scope = typeof rule.scope === 'function' ? rule.scope(token) : rule.scope
      emit(token, scope ?? state.fill)
      if (rule.pop) {
        if (stack.length > 1) stack.pop()
      } else if (rule.next) {
        stack[stack.length - 1] = rule.arg ? `${rule.next}:${rule.arg(token, text)}` : rule.next
      } else if (rule.push && stack.length < DEPTH) {
        stack.push(rule.arg ? `${rule.push}:${rule.arg(token, text)}` : rule.push)
      }
      at = found.index + token.length
      // A rule that matches nothing moves no text: a few in a row are state changes (a lookahead
      // that ends a state), more would be a loop, so the character is read as the state's text.
      // At the line's end that also ends the reading.
      if (token !== '') still = 0
      else if (++still > 8) {
        emit(text[at] ?? '', state.fill)
        at += 1
        still = 0
      }
    }
    flush()
    while (stack.length > 1) {
      const key = stack[stack.length - 1]!
      const state = this.state(key)
      if (!state.line) break
      if (state.after) {
        const colon = key.indexOf(':')
        stack[stack.length - 1] = colon === -1 ? state.after : `${state.after}${key.slice(colon)}`
        break
      }
      stack.pop()
    }
    return { html, end: stack.join(' ') }
  }

  /** A whole text: its lines read one after the other, joined by the newlines between them. */
  highlight(code: string): string {
    let state = this.start
    let html = ''
    let from = 0
    for (;;) {
      const end = code.indexOf('\n', from)
      const read = this.line(end === -1 ? code.slice(from) : code.slice(from, end), state)
      html += read.html
      state = read.end
      if (end === -1) return html
      html += '\n'
      from = end + 1
    }
  }
}

/**
 * A word list as a scope function: `words({ keyword: 'if else', literal: 'true false' })`. With
 * `ignoreCase`, `SELECT` is `select` (SQL, Dockerfile).
 */
export function words(
  groups: Readonly<Record<Scope, string>>,
  options: { ignoreCase?: boolean; otherwise?: Scope } = {},
): (text: string) => Scope | undefined {
  let table: Map<string, Scope> | undefined
  return (text) => {
    if (!table) {
      table = new Map()
      for (const [scope, list] of Object.entries(groups))
        for (const word of list.split(/\s+/))
          if (word) table.set(options.ignoreCase ? word.toLowerCase() : word, scope)
    }
    return table.get(options.ignoreCase ? text.toLowerCase() : text) ?? options.otherwise
  }
}
