/**
 * JavaScript and TypeScript, with JSX: template strings whose `${}` holds code again, regular
 * expressions where a value starts, decorators, and the tags of JSX where an expression starts.
 */
import type { Grammar, Rule, State } from '../engine'
import { codeRules, commentState, JS_IDENT, quoted, type CLike } from './common'

const KEYWORDS =
  'as async await break case catch class const continue debugger default delete do else export ' +
  'extends finally for from function get if import in instanceof let new of return set static ' +
  'switch throw try typeof var void while with yield'
const TS_KEYWORDS =
  'abstract accessor asserts declare enum implements infer interface is keyof module namespace ' +
  'override private protected public readonly satisfies type unique'
const LITERALS = 'true false null undefined NaN Infinity'
const GLOBALS =
  'Array ArrayBuffer BigInt Boolean console DataView Date document Error EvalError exports ' +
  'Float32Array Float64Array Function globalThis Int8Array Int16Array Int32Array Intl JSON Map ' +
  'Math module Number Object process Promise Proxy RangeError ReferenceError Reflect RegExp ' +
  'require Set String Symbol SyntaxError TypeError Uint8Array Uint16Array Uint32Array URIError ' +
  'URL WeakMap WeakSet window'
const TS_TYPES = 'any bigint boolean never number object string symbol unknown void'

/** Where a `/` starts a regular expression, not a division: after an operator or a keyword. */
const REGEX: Rule = {
  match:
    /(?<=(?:^|[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await))\s*)\/(?![*/])(?:[^/\\[\n]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuyv]*/,
  scope: 'regexp',
}

/** A JSX tag, where an expression can start: `return <div>`, `(<Item />)`, `? <a/> : null`. */
const JSX_OPEN: Rule = {
  match: /(?<=(?:^|[(,=:?{}[]|&&|\|\||=>|\breturn)\s*)<(?=[A-Za-z>])/,
  scope: 'tag',
  push: 'tag',
}
const JSX_CLOSE: Rule = { match: /<\/(?=[A-Za-z>])/, scope: 'tag', push: 'tag' }

const jsxTag: State = {
  rules: [
    { match: /(?<=<\/?)[\w.:-]+/, scope: 'name' },
    { match: /[\w:-]+(?=\s*=)|(?<=\s)[\w:-]+/, scope: 'attr' },
    { match: /"[^"\n]*"?|'[^'\n]*'?/, scope: 'string' },
    { match: /\{/, scope: 'subst', push: 'subst' },
    { match: /\/?>/, scope: 'tag', pop: true },
  ],
  fill: 'tag',
}

function grammar(name: string, aliases: string[], typescript: boolean): Grammar {
  const options: CLike = {
    name,
    aliases,
    ident: JS_IDENT,
    words: {
      keyword: typescript ? `${KEYWORDS} ${TS_KEYWORDS}` : KEYWORDS,
      literal: LITERALS,
      built_in: typescript ? `${GLOBALS} ${TS_TYPES}` : GLOBALS,
      'variable language_': 'this super arguments',
    },
    functions: 'function',
    classes: typescript ? 'class extends implements interface type enum new' : 'class extends new',
    capitals: true,
    first: [
      { match: /`/, scope: 'string', push: 'template' },
      JSX_CLOSE,
      JSX_OPEN,
      REGEX,
      ...(typescript ? [{ match: /@[A-Za-z_$][\w$.]*/, scope: 'meta' }] : []),
      // A method's name after `.` is a call or a property, never a keyword (`promise.catch()`).
      { match: /(?<=\.\s*)[A-Za-z_$][\w$]*(?=\s*\()/, scope: 'title function_' },
      { match: /(?<=\.\s*)[A-Za-z_$][\w$]*/ },
    ],
  }
  const code = codeRules(options)
  // Code inside `${}` and inside braces there: the braces counted, so the right one closes it.
  const inner = (closer: Rule): State => ({
    rules: [closer, { match: /\{/, push: 'brace' }, ...code],
  })
  return {
    name,
    aliases,
    states: {
      root: { rules: code },
      comment: commentState('*/'),
      str: { rules: quoted(), fill: 'string', line: true },
      template: {
        rules: [
          { match: /\\[\s\S]?/ },
          { match: /\$\{/, scope: 'subst', push: 'subst' },
          { match: /`/, scope: 'string', pop: true },
        ],
        fill: 'string',
      },
      subst: inner({ match: /\}/, scope: 'subst', pop: true }),
      brace: inner({ match: /\}/, pop: true }),
      tag: jsxTag,
    },
  }
}

export const javascript = grammar('javascript', ['js', 'jsx', 'mjs', 'cjs', 'node'], false)
export const typescript = grammar('typescript', ['ts', 'tsx', 'mts', 'cts'], true)
