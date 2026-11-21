/**
 * Ruby: `#{}` in double-quoted strings and heredocs, symbols and hash keys, instance variables,
 * regular expressions where a value starts, `=begin` blocks, and names ending in `?` or `!`.
 */
import type { Grammar, Rule, State } from '../engine'
import { codeRules, literal } from './common'

const INTERPOLATION: Rule = { match: /#\{/, scope: 'subst', push: 'subst' }

const code = codeRules({
  name: 'ruby',
  ident: '[A-Za-z_]\\w*[?!]?',
  line: '#',
  block: false,
  strings: { double: false },
  capitals: true,
  words: {
    literal: 'true false nil',
    // The methods that read as the language's own words, as editors colour them.
    keyword:
      'alias and begin BEGIN break case class def defined? do else elsif end END ensure for if in ' +
      'module next not or redo rescue retry return super then undef unless until when while yield ' +
      'attr_accessor attr_reader attr_writer extend include module_function prepend private ' +
      'protected public raise require require_relative',
    built_in: 'lambda loop print proc puts p pp',
    'variable language_': 'self __FILE__ __LINE__ __method__',
  },
  functions: 'def',
  classes: 'class module',
  first: [
    { match: /^=begin\b.*/, scope: 'comment', push: 'doc' },
    {
      match: /<<[~-]?(?:'[A-Z_]\w*'|"[A-Z_]\w*"|[A-Z_]\w*)/,
      scope: 'string',
      push: 'opener',
      arg: (text) => text.replace(/^<<[~-]?/, ''),
    },
    { match: /"/, scope: 'string', push: 'double' },
    { match: /'(?:[^'\\\n]|\\.)*'?/, scope: 'string' },
    { match: /(?<=\bdef\s+(?:self\.)?)[A-Za-z_]\w*[?!=]?/, scope: 'title function_' },
    {
      match: /(?<![:\w]):(?:[A-Za-z_]\w*[?!=]?|"[^"\n]*")|[A-Za-z_]\w*[?!]?:(?!:)/,
      scope: 'symbol',
    },
    { match: /@@?[A-Za-z_]\w*|\$[A-Za-z_]\w*/, scope: 'variable' },
    {
      match:
        /(?<=(?:^|[(,=~!&|{;]|\b(?:if|unless|when|and|or|not|return))\s*)\/(?![\s/])(?:[^/\\\n]|\\.)*\/[imxo]*/,
      scope: 'regexp',
    },
  ],
})

const double: State = {
  rules: [{ match: /\\[\s\S]?/ }, INTERPOLATION, { match: /"/, scope: 'string', pop: true }],
  fill: 'string',
}

export const ruby: Grammar = {
  name: 'ruby',
  aliases: ['rb', 'gemspec', 'podspec', 'thor', 'irb', 'rake'],
  states: {
    root: { rules: code },
    double,
    subst: {
      rules: [{ match: /\}/, scope: 'subst', pop: true }, { match: /\{/, push: 'brace' }, ...code],
    },
    brace: { rules: [{ match: /\}/, pop: true }, { match: /\{/, push: 'brace' }, ...code] },
    doc: { rules: [{ match: /^=end\b.*/, scope: 'comment', pop: true }], fill: 'comment' },
    opener: { rules: code, line: true, after: 'heredoc' },
    heredoc: {
      rules: (word) => [
        ...(word.startsWith("'") ? [] : [INTERPOLATION]),
        {
          match: new RegExp(`^\\s*${literal(word.replace(/['"]/g, ''))}$`),
          scope: 'string',
          pop: true,
        },
      ],
      fill: 'string',
    },
  },
}
