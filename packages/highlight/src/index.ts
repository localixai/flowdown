/**
 * `@localix-ai/highlight`: syntax highlighting for code that streams.
 *
 * An agent writes a file, a patch or a shell session a token at a time. A highlighter that colours
 * a whole text colours it again on every token, and the cost of a file grows with its square. This
 * one reads a line from the state the line above ended in (inside a comment, a string, a template),
 * so a line is coloured once, the line still being written costs only itself, and what streams is
 * coloured exactly as the finished text is.
 *
 * The HTML uses highlight.js's class names (`hljs-keyword`, `hljs-string`, …): its themes apply.
 * The code is escaped. A language it does not know is `null`, never a guess.
 */
import { escapeHtml, Tokenizer, type Grammar, type Line } from './engine'
import { GRAMMARS } from './languages'

export {
  escapeHtml,
  Tokenizer,
  words,
  type Grammar,
  type Line,
  type Rule,
  type Scope,
  type State,
} from './engine'

const byName = new Map<string, Grammar>()
for (const grammar of GRAMMARS) {
  byName.set(grammar.name, grammar)
  for (const alias of grammar.aliases ?? []) byName.set(alias, grammar)
}
const tokenizers = new Map<Grammar, Tokenizer>()

/** The tokenizer for a fence's language (`ts`, `Python`, `c++`), or null for one it does not know. */
export function tokenizer(language: string): Tokenizer | null {
  const grammar = byName.get(language.trim().toLowerCase())
  if (!grammar) return null
  let known = tokenizers.get(grammar)
  if (!known) {
    known = new Tokenizer(grammar, tokenizer)
    tokenizers.set(grammar, known)
  }
  return known
}

/** The name a language goes by (`ts` is `typescript`), or null for one it does not know. */
export function languageOf(language: string): string | null {
  return byName.get(language.trim().toLowerCase())?.name ?? null
}

/** Every language, by its name. */
export const languages: readonly string[] = GRAMMARS.map((grammar) => grammar.name)

/** Every name a fence may give, aliases included. */
export const names: readonly string[] = [...byName.keys()]

/**
 * Reads lines one at a time: `line(text, state)` colours one line from the state the line above
 * ended in and gives the state it ends in. `start` is a file's first state. Lines cost only
 * themselves, so a page keeps each complete line's HTML and colours only the line being written.
 */
export interface LineHighlighter {
  start: string
  line(text: string, state?: string): Line
}

/** Line by line, for a language; null for one it does not know. */
export function lines(language: string): LineHighlighter | null {
  const known = tokenizer(language)
  if (!known) return null
  return { start: known.start, line: (text, state) => known.line(text, state) }
}

/**
 * Highlighted HTML for `code`, or null for a language it does not know: the shape a renderer takes
 * (`<Markdown highlight={highlight}>`). It carries `lines`, so a renderer that knows can colour a
 * growing block line by line.
 */
export const highlight: ((code: string, language: string) => string | null) & {
  lines: typeof lines
} = Object.assign(
  (code: string, language: string): string | null => tokenizer(language)?.highlight(code) ?? null,
  { lines },
)

/** Highlighted HTML for `code`; a language it does not know comes back escaped, as plain text. */
export function highlightCode(code: string, language = 'text'): string {
  return tokenizer(language)?.highlight(code) ?? escapeHtml(code)
}

/** What a stream gives after each piece of text: the lines it completed, and the one being written. */
export interface StreamUpdate {
  /** The HTML of each line the text completed, in order: draw each once. */
  done: string[]
  /** The HTML of the last line, still being written: drawn again on every update. */
  current: string
}

/**
 * Code that arrives in pieces, as an agent writes it: `write(piece)` gives the HTML of the lines
 * the piece completed and of the line still open. Each line is read once it is complete and the
 * open one again on each piece, so a file costs its length, not its length times its pieces.
 * Null for a language it does not know.
 */
export function createStream(language: string): {
  write(piece: string): StreamUpdate
  /** All the text written so far. */
  readonly text: string
} | null {
  const known = tokenizer(language)
  if (!known) return null
  let state = known.start
  let open = ''
  let text = ''
  return {
    get text() {
      return text
    },
    write(piece) {
      text += piece
      open += piece
      const done: string[] = []
      let from = 0
      for (let end = open.indexOf('\n'); end !== -1; end = open.indexOf('\n', from)) {
        const read = known.line(open.slice(from, end), state)
        done.push(read.html)
        state = read.end
        from = end + 1
      }
      open = open.slice(from)
      return { done, current: known.line(open, state).html }
    },
  }
}

export default highlight
