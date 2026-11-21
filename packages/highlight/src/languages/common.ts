/**
 * What most grammars are made of: comments, strings, numbers, the names a definition gives, calls,
 * and a word list for the rest. A C-like language is these with its own words (`cLike`).
 */
import { words, type Grammar, type Rule, type Scope, type State } from '../engine'

/** `text` as a pattern that matches it literally. */
export const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/**
 * A word in any case as a pattern, `[Rr][Uu][Nn]`: a state's rules share one expression, so a
 * rule cannot carry a flag of its own.
 */
export const anyCase = (text: string): string =>
  text.replace(/[A-Za-z]/g, (letter) => `[${letter.toUpperCase()}${letter.toLowerCase()}]`)

/** An identifier: letters, digits, `_`; `$` where the language allows it. */
export const IDENT = '[A-Za-z_][\\w]*'
export const JS_IDENT = '[A-Za-z_$][\\w$]*'

/** A number in most languages: hex, binary, octal, decimals with `_`, exponents, a type suffix. */
export const NUMBER: Rule = {
  match:
    /(?<![\w$.])(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[A-Za-z\d]*/,
  scope: 'number',
}

/** A line comment from `prefix` to the end of the line. */
export const lineComment = (prefix: string): Rule => ({
  match: new RegExp(`${literal(prefix)}.*`),
  scope: 'comment',
})

/** The tags a doc comment holds (`@param`, `TODO`), drawn apart as highlight.js does. */
const DOC_TAG: Rule = {
  match: /(?<![\w@])@[A-Za-z]+|\b(?:TODO|FIXME|XXX|NOTE|HACK)\b:?/,
  scope: 'doctag',
}

/** A block comment's state: its closer, and its doc tags. */
export const commentState = (close: string, nested?: string): State => ({
  rules: [
    DOC_TAG,
    ...(nested ? [{ match: new RegExp(literal(nested)), scope: 'comment', push: 'comment' }] : []),
    { match: new RegExp(literal(close)), scope: 'comment', pop: true },
  ],
  fill: 'comment',
})

/** Opens a block comment: `/*` enters the state `comment`. */
export const blockComment = (open: string): Rule => ({
  match: new RegExp(literal(open)),
  scope: 'comment',
  push: 'comment',
})

/**
 * A string state for a quote given as the argument: a backslash escapes the next character,
 * the quote ends it. `line` strings end with their line, as in most languages.
 */
export const quoted =
  (options: { escapes?: boolean; extra?: Rule[] } = {}) =>
  (quote: string) => [
    ...(options.escapes === false ? [] : [{ match: /\\[\s\S]?/ }]),
    // What a string holds besides its text (`$name`, `${…}`) is in double quotes only.
    ...(quote === '"' ? (options.extra ?? []) : []),
    { match: new RegExp(literal(quote)), scope: 'string', pop: true } as Rule,
  ]

/** The kind of a word from lists, else `otherwise` (a call's name). */
export type WordLists = Partial<
  Record<'keyword' | 'literal' | 'built_in' | 'type' | 'variable language_', string>
>

export interface CLike {
  name: string
  aliases?: string[]
  words: WordLists
  ignoreCase?: boolean
  /** The pattern of a name. */
  ident?: string
  /** Words that a function's name follows (`function`, `fn`, `def`). */
  functions?: string
  /** Words that a type's name follows (`class`, `struct`, `interface`). */
  classes?: string
  /** A name with a capital is a type's (`new Queue()`, `List<String>`). */
  capitals?: boolean
  /** A name before `(` is a call (default); off where that is a table's name (SQL). */
  calls?: boolean
  /** Comments: the line prefix (`//`, `#`) and the block opener and closer. */
  line?: string | false
  block?: [string, string] | false
  nestedBlock?: boolean
  /** Rules read before the common ones: strings of the language's own, annotations. */
  first?: Rule[]
  /** Rules read after the common ones and before words. */
  last?: Rule[]
  /** States the rules enter. */
  states?: Record<string, State>
  /** Strings with `"` (and `'` when `single` is true). */
  strings?: { double?: boolean; single?: boolean; multiline?: boolean; extra?: Rule[] }
}

/** The rules of a C-like language's code, in the order they are tried at one place. */
export function codeRules(o: CLike): Rule[] {
  const ident = o.ident ?? IDENT
  const table = words(o.words as Record<Scope, string>, { ignoreCase: o.ignoreCase ?? false })
  const strings = o.strings ?? { double: true, single: true }
  const rules: Rule[] = [...(o.first ?? [])]
  if (o.line !== false) rules.push(lineComment(o.line ?? '//'))
  const block = o.block === false ? null : (o.block ?? ['/*', '*/'])
  if (block) rules.push(blockComment(block[0]))
  if (strings.double !== false)
    rules.push({
      match: /"/,
      scope: 'string',
      push: strings.multiline ? 'mstr' : 'str',
      arg: () => '"',
    })
  if (strings.single)
    rules.push({
      match: /'/,
      scope: 'string',
      push: strings.multiline ? 'mstr' : 'str',
      arg: () => "'",
    })
  rules.push(NUMBER)
  if (o.functions)
    rules.push({
      match: new RegExp(`(?<=\\b(?:${o.functions.split(' ').join('|')})\\s+)${ident}`),
      scope: 'title function_',
    })
  if (o.classes)
    rules.push({
      match: new RegExp(`(?<=\\b(?:${o.classes.split(' ').join('|')})\\s+)${ident}`),
      scope: 'title class_',
    })
  rules.push(...(o.last ?? []))
  // A name before `(` is a call, or the function being defined; a keyword stays a keyword.
  if (o.calls !== false)
    rules.push({
      match: new RegExp(`${ident}(?=\\s*\\()`),
      // A built-in that is called is a function (`print(…)`, `len(…)`), as an editor shows it.
      scope: (text) => {
        const kind = table(text)
        if (kind !== undefined && kind !== 'built_in') return kind
        return 'title function_'
      },
    })
  rules.push({
    match: new RegExp(ident),
    scope: (text) =>
      table(text) ?? (o.capitals && /^[A-Z][a-z]/.test(text) ? 'title class_' : undefined),
  })
  return rules
}

/** A C-like language: its code rules, its comments and its strings. */
export function cLike(o: CLike): Grammar {
  const block = o.block === false ? null : (o.block ?? ['/*', '*/'])
  const extra = o.strings?.extra ?? []
  return {
    name: o.name,
    ...(o.aliases ? { aliases: o.aliases } : {}),
    states: {
      root: { rules: codeRules(o) },
      ...(block ? { comment: commentState(block[1], o.nestedBlock ? block[0] : undefined) } : {}),
      str: { rules: quoted({ extra }), fill: 'string', line: true },
      mstr: { rules: quoted({ extra }), fill: 'string' },
      ...o.states,
    },
  }
}
