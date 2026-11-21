/**
 * `bun scripts/quality.ts [--source=agent,shiki,hljs] [--only=python] [--show=python] [--check]`
 *
 * How close the colours are to the references', character by character: Shiki (the TextMate
 * grammars VS Code colours with) and highlight.js. Each highlighter's output is read as the colour
 * a reader sees, one of a few groups (comment, keyword, string, number, function, type, tag, an
 * added or a removed line, or none): for this package and highlight.js through the classes the
 * stylesheet colours, for Shiki through the TextMate scopes of each token. Whitespace is left out.
 *
 * `--show` prints the runs where this package and Shiki differ, to see what a grammar misses.
 * `--check` fails when a language's agreement with Shiki falls under its floor in
 * `quality.json`, so a grammar change that makes colours worse is seen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import hljs from 'highlight.js'
import { createHighlighter } from 'shiki'
import { highlight } from '../src/index'
import { corpus, type Sample } from './corpus'

type Group =
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'function'
  | 'type'
  | 'tag'
  | 'addition'
  | 'deletion'
  | 'none'

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const sources = (flag('source')?.split(',') ?? ['agent', 'shiki', 'hljs']) as Sample['source'][]
const only = flag('only')?.split(',')
const show = flag('show')

/** The colour a class gives, as `styles/code.css` in flowdown colours highlight.js's classes. */
function groupOfClass(classes: string, language: string): Group | null {
  const names = classes
    .split(/\s+/)
    .filter((name) => name.startsWith('hljs-'))
    .map((name) => name.slice(5))
  const all = classes.split(/\s+/)
  const kind = names[0]
  if (kind === undefined) return null
  if (language === 'diff' && (kind === 'meta' || kind === 'comment')) return 'comment'
  if (kind === 'title' && all.includes('class_')) return 'type'
  switch (kind) {
    case 'comment':
    case 'quote':
      return 'comment'
    case 'keyword':
    case 'selector-tag':
    case 'doctag':
      return 'keyword'
    case 'string':
    case 'regexp':
      return 'string'
    case 'number':
    case 'literal':
    case 'variable':
    case 'template-variable':
    case 'attr':
    case 'attribute':
    case 'symbol':
    case 'bullet':
      return 'number'
    case 'title':
    case 'section':
      return 'function'
    case 'type':
    case 'built_in':
    case 'params':
    case 'meta':
      return 'type'
    case 'tag':
    case 'name':
    case 'selector-id':
    case 'selector-class':
      return 'tag'
    case 'addition':
      return 'addition'
    case 'deletion':
      return 'deletion'
    default:
      return null
  }
}

/** The group of every character of highlighted HTML: the innermost span that colours it. */
function groupsOfHtml(html: string, language: string): Group[] {
  const out: Group[] = []
  const stack: Array<Group | null> = []
  const current = () => {
    for (let index = stack.length - 1; index >= 0; index--) if (stack[index]) return stack[index]!
    return 'none'
  }
  for (const part of html.split(/(<span class="[^"]*">|<\/span>|&[#\w]+;)/)) {
    if (!part) continue
    if (part.startsWith('<span'))
      stack.push(groupOfClass(/class="([^"]*)"/.exec(part)![1]!, language))
    else if (part === '</span>') stack.pop()
    else if (part.startsWith('&') && part.endsWith(';')) out.push(current())
    else for (const _ of part) out.push(current())
  }
  return out
}

/** TextMate scopes, innermost first, to a group; `none` stops the search, null goes outward. */
const SCOPES: Array<[RegExp, Group]> = [
  // Where a grammar and highlight.js only name the same thing differently: a key (YAML's are
  // tags, INI's keywords), a number's or a string's prefix, a flag. Read as what they are.
  [
    /^(?:entity\.name\.tag\.yaml|keyword\.other\.definition\.ini|variable\.other\.key|storage\.type\.number|storage\.type\.imaginary)/,
    'number',
  ],
  // The marks of a heading, a section, a list item: part of what they mark.
  [/^punctuation\.definition\.(?:heading|section)/, 'function'],
  [/^punctuation\.definition\.list/, 'number'],
  [/^punctuation\.definition\.quote/, 'comment'],
  [/^punctuation\.definition\.(?:constant|variable)\.ruby/, 'number'],
  [/^punctuation\.definition\.entity\.css/, 'tag'],
  [/^markup\.list/, 'none'],
  // A class used as a type in Java is `storage.type`: a type, as in every other grammar.
  [/^storage\.type(?:\.[\w-]+)*\.java/, 'type'],
  [/^storage\.type\.string\.python/, 'string'],
  [/^constant\.other\.option/, 'number'],
  [/^string\.unquoted\.argument/, 'none'],
  [/^punctuation\.definition\.(?:inserted)/, 'addition'],
  [/^punctuation\.definition\.(?:deleted)/, 'deletion'],
  [/^punctuation\.definition\.(?:from-file|to-file|range|separator)\.diff/, 'comment'],
  [/^meta\.function-call\.generic/, 'function'],
  [/^(?:comment|punctuation\.definition\.comment)/, 'comment'],
  [/^markup\.inserted/, 'addition'],
  [/^markup\.deleted/, 'deletion'],
  [
    /^(?:meta\.diff\.(?:header|range|index)|meta\.separator\.diff|meta\.toc-list\.line-number\.diff)/,
    'comment',
  ],
  [/^(?:string|punctuation\.definition\.string|constant\.character\.escape)/, 'string'],
  [
    /^(?:constant\.(?:numeric|language|character|other\.symbol|other\.color|other\.date|other\.time)|keyword\.other\.unit)/,
    'number',
  ],
  [/^variable\.language/, 'number'],
  [
    /^(?:variable\.other\.(?:normal|special|positional|bracket)\.shell|variable\.other\.php|variable\.other\.readwrite\.(?:instance|class|global)\.ruby|variable\.other\.(?:dollar|env))/,
    'number',
  ],
  [
    /^(?:support\.type\.property-name|entity\.other\.attribute-name(?!\.(?:class|id|pseudo))|meta\.property-name)/,
    'number',
  ],
  [/^entity\.other\.attribute-name\.(?:class|id)/, 'tag'],
  [/^(?:entity\.name\.tag|punctuation\.definition\.tag)/, 'tag'],
  [/^(?:entity\.name\.section|markup\.heading)/, 'function'],
  [/^markup\.quote/, 'comment'],
  [/^(?:markup\.list|punctuation\.definition\.list)/, 'number'],
  [/^(?:entity\.name\.function|support\.function)/, 'function'],
  [
    /^(?:storage\.type\.(?:primitive|built-in|basic)|support\.type|support\.class|entity\.name\.(?:type|class|namespace|struct|enum|interface|trait)|entity\.other\.inherited-class)/,
    'type',
  ],
  [
    /^keyword\.operator\.(?:new|expression|logical\.python|wordlike|sizeof|alignof|typeid|cast|delete|instanceof|in\b|of\b|type)/,
    'keyword',
  ],
  [/^(?:keyword\.operator|punctuation|meta\.brace)/, 'none'],
  [/^(?:keyword|storage)/, 'keyword'],
  [/^(?:variable|entity\.name\.variable|support\.variable)/, 'none'],
]

function groupOfScopes(scopes: string[]): Group {
  for (let index = scopes.length - 1; index >= 0; index--) {
    for (const [pattern, group] of SCOPES) if (pattern.test(scopes[index]!)) return group
  }
  return 'none'
}

const samples = corpus(sources).filter((sample) => !only || only.includes(sample.language))
const shiki = await createHighlighter({
  themes: ['github-dark'],
  langs: [...new Set(samples.map((sample) => sample.shiki))],
})

function shikiGroups(sample: Sample): Group[] {
  const { tokens } = shiki.codeToTokens(sample.code, {
    lang: sample.shiki as never,
    theme: 'github-dark',
    includeExplanation: true,
  })
  const out: Group[] = []
  tokens.forEach((line, index) => {
    if (index > 0) out.push('none')
    for (const token of line)
      for (const piece of token.explanation ?? [{ content: token.content, scopes: [] }]) {
        const group = groupOfScopes(piece.scopes.map((scope) => scope.scopeName))
        for (const _ of piece.content) out.push(group)
      }
  })
  return out
}

interface Tally {
  chars: number
  shiki: number
  hljs: number
  hljsShiki: number
}
const byLanguage = new Map<string, Tally>()
const differences: string[] = []

for (const sample of samples) {
  const chars = [...sample.code]
  const ours = groupsOfHtml(highlight(sample.code, sample.language)!, sample.language)
  const theirs = shikiGroups(sample)
  const known = hljs.getLanguage(sample.hljs)
  const reference = known
    ? groupsOfHtml(
        hljs.highlight(sample.code, { language: sample.hljs, ignoreIllegals: true }).value,
        sample.language,
      )
    : null
  if (ours.length !== chars.length || theirs.length !== chars.length) {
    console.error(
      `${sample.file}: lengths differ (${chars.length} / ours ${ours.length} / shiki ${theirs.length})`,
    )
    continue
  }
  const tally = byLanguage.get(sample.language) ?? { chars: 0, shiki: 0, hljs: 0, hljsShiki: 0 }
  let run = ''
  let runKey = ''
  const flush = () => {
    if (run.trim() && show === sample.language)
      differences.push(`${runKey}  ${JSON.stringify(run)}`)
    run = ''
    runKey = ''
  }
  chars.forEach((character, index) => {
    if (/\s/.test(character)) {
      if (run) run += character
      return
    }
    tally.chars += 1
    if (ours[index] === theirs[index]) tally.shiki += 1
    if (reference && reference[index] === ours[index]) tally.hljs += 1
    if (reference && reference[index] === theirs[index]) tally.hljsShiki += 1
    const key = ours[index] === theirs[index] ? '' : `ours ${ours[index]} · shiki ${theirs[index]}`
    if (key !== runKey) flush()
    if (key) {
      runKey = key
      run += character
    }
  })
  flush()
  byLanguage.set(sample.language, tally)
}

const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`
const rows = [...byLanguage.entries()].toSorted(([a], [b]) => a.localeCompare(b))
console.log(
  `${'language'.padEnd(12)} ${'chars'.padStart(7)}  ${'=shiki'.padStart(7)}  ${'=hljs'.padStart(7)}  ${'hljs=shiki'.padStart(10)}`,
)
let total: Tally = { chars: 0, shiki: 0, hljs: 0, hljsShiki: 0 }
for (const [language, tally] of rows) {
  console.log(
    `${language.padEnd(12)} ${String(tally.chars).padStart(7)}  ${percent(tally.shiki, tally.chars).padStart(7)}  ${percent(tally.hljs, tally.chars).padStart(7)}  ${percent(tally.hljsShiki, tally.chars).padStart(10)}`,
  )
  total = {
    chars: total.chars + tally.chars,
    shiki: total.shiki + tally.shiki,
    hljs: total.hljs + tally.hljs,
    hljsShiki: total.hljsShiki + tally.hljsShiki,
  }
}
console.log(
  `${'all'.padEnd(12)} ${String(total.chars).padStart(7)}  ${percent(total.shiki, total.chars).padStart(7)}  ${percent(total.hljs, total.chars).padStart(7)}  ${percent(total.hljsShiki, total.chars).padStart(10)}`,
)

if (show) {
  const counts = new Map<string, number>()
  for (const line of differences) counts.set(line, (counts.get(line) ?? 0) + 1)
  console.log(`\n${show}: where this package and Shiki differ (most frequent first)`)
  for (const [line, count] of [...counts.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, 80))
    console.log(`${String(count).padStart(4)}  ${line.slice(0, 150)}`)
}

if (!process.argv.includes('--no-write') && !only && !flag('source')) {
  const lines = [
    '# Colours against the references',
    '',
    'The share of characters (whitespace left out) coloured as Shiki colours them: this package, and',
    'highlight.js beside it. `bun scripts/quality.ts` writes this page.',
    '',
    '| Language | Characters | `@localix-ai/highlight` | highlight.js |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map(
      ([language, tally]) =>
        `| ${language} | ${tally.chars} | ${percent(tally.shiki, tally.chars)} | ${percent(tally.hljsShiki, tally.chars)} |`,
    ),
    `| all | ${total.chars} | ${percent(total.shiki, total.chars)} | ${percent(total.hljsShiki, total.chars)} |`,
    '',
  ]
  writeFileSync(join(import.meta.dir, '..', 'bench', 'results', 'quality.md'), lines.join('\n'))
}

// The floors of the agent corpus alone (this package's, always there) and of every source (with
// the references cloned): a check holds the corpus it read to the floors of that corpus.
const floors = join(import.meta.dir, 'quality.json')
const corpusKey = samples.some((sample) => sample.source !== 'agent') ? 'all' : 'agent'
const known = JSON.parse(readFileSync(floors, 'utf8')) as Record<string, Record<string, number>>
if (process.argv.includes('--write')) {
  known[corpusKey] = Object.fromEntries(
    rows.map(([language, tally]) => [
      language,
      Math.floor((tally.shiki / tally.chars) * 1000) / 10 - 1,
    ]),
  )
  writeFileSync(floors, `${JSON.stringify(known, null, 2)}\n`)
}
if (process.argv.includes('--check')) {
  const floor = known[corpusKey] ?? {}
  const failed = rows.filter(
    ([language, tally]) => (tally.shiki / tally.chars) * 100 < (floor[language] ?? 0),
  )
  for (const [language, tally] of failed)
    console.error(
      `✗ ${language}: ${percent(tally.shiki, tally.chars)} of characters as Shiki colours them, under ${floor[language]}%`,
    )
  if (failed.length) process.exit(1)
  console.log(`✓ every language at or above its floor (${corpusKey} corpus)`)
}
