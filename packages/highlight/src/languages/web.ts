/**
 * The page: CSS (and SCSS, Less) with selectors outside braces and properties inside them, and
 * HTML or XML with tags, attributes, comments, and the scripts and styles they hold coloured as
 * TypeScript and CSS.
 */
import type { Grammar, Rule, State } from '../engine'
import { commentState } from './common'
import { typescript } from './javascript'

const CSS_STRING: Rule = { match: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/, scope: 'string' }
const CSS_COMMENT: Rule = { match: /\/\*/, scope: 'comment', push: 'comment' }

function css(name: string, aliases: string[], sass: boolean): Grammar {
  const variables: Rule[] = sass
    ? [
        { match: /(?<![\w-])\/\/.*/, scope: 'comment' },
        { match: /[$@][\w-]+/, scope: 'variable' },
      ]
    : [{ match: /--[\w-]+/, scope: 'variable' }]
  const selectors: Rule[] = [
    CSS_COMMENT,
    ...variables,
    CSS_STRING,
    { match: /@[\w-]+/, scope: 'keyword' },
    { match: /\.-?[A-Za-z_][\w-]*/, scope: 'selector-class' },
    { match: /#[\w-]+/, scope: 'selector-id' },
    { match: /::?[\w-]+/, scope: 'selector-pseudo' },
    { match: /\[[^\]\n]*\]?/, scope: 'selector-attr' },
    { match: /(?<![\w-])(?:[A-Za-z][\w-]*|\*)/, scope: 'selector-tag' },
    { match: /&/, scope: 'selector-tag' },
    { match: /\{/, push: 'block' },
    // A media query's conditions read as declarations: `(max-width: 600px)`.
    { match: /\(/, push: 'query' },
  ]
  const declarations: Rule[] = [
    CSS_COMMENT,
    { match: /\}/, pop: true },
    // A nested rule: a selector, then its own braces.
    {
      match: /(?<=^\s*)(?:&|[.#:][\w-]|[A-Za-z][\w-]*(?=[^:;{}\n]*\{))[^;{}\n]*(?=\{)/,
      scope: (text) =>
        text[0] === '.' ? 'selector-class' : text[0] === '#' ? 'selector-id' : 'selector-tag',
    },
    { match: /\{/, push: 'block' },
    { match: /(?<=^\s*|[{;(]\s*)-{0,2}[A-Za-z_][\w-]*(?=\s*:)/, scope: 'attribute' },
    ...variables,
    CSS_STRING,
    { match: /@[\w-]+/, scope: 'keyword' },
    { match: /#[\da-fA-F]{3,8}\b/, scope: 'number' },
    { match: /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?:%|[A-Za-z]+)?/, scope: 'number' },
    { match: /!important\b/, scope: 'keyword' },
    { match: /[\w-]+(?=\()/, scope: 'title function_' },
  ]
  return {
    name,
    aliases,
    states: {
      root: { rules: selectors },
      block: { rules: declarations },
      query: { rules: [{ match: /\)/, pop: true }, ...declarations.slice(2)] },
      comment: commentState('*/'),
    },
  }
}

export const cssGrammar = css('css', [], false)
export const scss = css('scss', ['sass', 'less', 'postcss', 'stylus'], true)

/** A tag: its name, its attributes and their values, until `>`. `then` is what follows it. */
const tag = (then?: string): State => ({
  rules: [
    { match: /(?<=<\/?)[\w:.-]+/, scope: 'name' },
    { match: /"[^"]*"?|'[^']*'?/, scope: 'string' },
    { match: /[^\s"'<>/=]+/, scope: 'attr' },
    { match: /\/?>/, scope: 'tag', ...(then ? { next: then } : { pop: true as const }) },
  ],
  fill: 'tag',
})

const script = typescript.states
const styles = cssGrammar.states

export const xml: Grammar = {
  name: 'xml',
  aliases: [
    'html',
    'xhtml',
    'htm',
    'svg',
    'rss',
    'atom',
    'xsl',
    'xsd',
    'plist',
    'vue',
    'svelte',
    'mathml',
  ],
  states: {
    root: {
      rules: [
        { match: /<!--/, scope: 'comment', push: 'markup-comment' },
        { match: /<!\[CDATA\[/, scope: 'string', push: 'cdata' },
        { match: /<![A-Za-z][^>\n]*>?|<\?[\w-]+[^?\n]*(?:\?>)?/, scope: 'meta' },
        { match: /<(?=script\b)/, scope: 'tag', push: 'script-tag' },
        { match: /<(?=style\b)/, scope: 'tag', push: 'style-tag' },
        { match: /<\/?(?=[\w:.-])/, scope: 'tag', push: 'tag' },
        { match: /&(?:#\d+|#x[\da-fA-F]+|[A-Za-z][\w]*);/, scope: 'symbol' },
      ],
    },
    tag: tag(),
    'markup-comment': { rules: [{ match: /-->/, scope: 'comment', pop: true }], fill: 'comment' },
    cdata: { rules: [{ match: /\]\]>/, scope: 'string', pop: true }], fill: 'string' },
    'script-tag': tag('script'),
    'style-tag': tag('style'),
    // A script's text is TypeScript (JavaScript reads the same), up to `</script>`.
    script: {
      rules: [
        { match: /<\/script\s*>/, scope: 'tag', pop: true },
        ...(script.root!.rules as Rule[]),
      ],
    },
    style: {
      rules: [
        { match: /<\/style\s*>/, scope: 'tag', pop: true },
        ...(styles.root!.rules as Rule[]),
      ],
    },
    // The states a script and a style enter: TypeScript's and CSS's (their comments close alike).
    ...Object.fromEntries(
      Object.entries(script).filter(([key]) => key !== 'root' && key !== 'tag'),
    ),
    block: styles.block!,
    query: styles.query!,
  },
}
