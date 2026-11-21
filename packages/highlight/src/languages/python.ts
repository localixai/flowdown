/**
 * Python: strings with their prefixes (`r`, `b`, `f`), triple-quoted ones across lines, the code
 * inside an f-string's braces, decorators, and the names `def` and `class` give.
 */
import type { Grammar, Rule, State } from '../engine'
import { codeRules, literal } from './common'

const KEYWORDS =
  'and as assert async await break case class continue def del elif else except finally for from ' +
  'global if import in is lambda match nonlocal not or pass raise return try type while with yield'
const BUILT_INS =
  'abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr classmethod ' +
  'compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset ' +
  'getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals ' +
  'map max memoryview min next object oct open ord pow print property range repr reversed round ' +
  'set setattr slice sorted staticmethod str sum super tuple type vars zip __import__'

/** A string's opener: its prefix, then one quote or three. The prefix says raw and formatted. */
const OPENER = /(?<![\w])(?:[rRbBuUfF]|[rR][bBfF]|[bBfF][rR])?(?:"""|'''|"|')/

const opener: Rule = {
  match: OPENER,
  scope: 'string',
  push: 'str',
  arg: (text) => {
    const prefix = text.replace(/["']+$/, '').toLowerCase()
    const quote = text.slice(prefix.length)
    return `${prefix.includes('r') ? 'r' : ''}${prefix.includes('f') ? 'f' : ''}${quote}`
  },
}

const code = codeRules({
  name: 'python',
  line: '#',
  block: false,
  strings: { double: false },
  words: {
    keyword: KEYWORDS,
    literal: 'True False None NotImplemented Ellipsis __debug__',
    built_in: BUILT_INS,
    'variable language_': 'self cls',
  },
  functions: 'def',
  classes: 'class',
  first: [opener, { match: /(?<=^\s*)@[\w.]+/, scope: 'title function_' }],
})

/** A string, given `r`, `f` and its quote: escapes unless raw, `{…}` code when formatted. */
const string: State = {
  rules: (arg) => {
    const quote = arg.replace(/^[rf]+/, '')
    return [
      ...(arg.includes('r') ? [] : [{ match: /\\[\s\S]?/ }]),
      ...(arg.includes('f')
        ? [{ match: /\{\{|\}\}/ }, { match: /\{/, scope: 'subst', push: 'subst' }]
        : []),
      // A string of one quote ends at its line's end too: it cannot go on.
      {
        match: new RegExp(quote.length === 1 ? `${literal(quote)}|$` : literal(quote)),
        scope: 'string',
        pop: true,
      },
    ]
  },
  fill: 'string',
}

const subst: State = {
  rules: [
    { match: /\}/, scope: 'subst', pop: true },
    { match: /![rsa](?=[:}])|:[^{}'"]*(?=\})/, scope: 'subst' },
    { match: /\{/, push: 'brace' },
    ...code,
  ],
}

export const python: Grammar = {
  name: 'python',
  aliases: ['py', 'python3', 'py3', 'gyp', 'pyi'],
  states: {
    root: { rules: code },
    str: string,
    subst,
    brace: { rules: [{ match: /\}/, pop: true }, { match: /\{/, push: 'brace' }, ...code] },
  },
}
