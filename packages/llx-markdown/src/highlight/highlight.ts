import type { LanguageFn, Mode } from 'highlight.js'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/** Words that open or close a shell construct: never a command's name. */
const SHELL_KEYWORDS =
  'if|then|else|elif|fi|for|while|until|in|do|done|case|esac|function|select|time'

/**
 * highlight.js's Bash knows the shell's own words (`cd`, `echo`, `export`), strings, variables and
 * comments, but not the programs a line runs: `bun add llx-markdown --dev`, the line a README is
 * made of, came out in one colour. These modes add what Shiki's grammar shows: the command, the
 * first word after a line's start (or a `$ ` prompt), a `|`, `&&`, `;`, `(` or a `then`/`do`; its
 * flags; and bare numbers. An assignment before a command (`NODE_ENV=production bun test`) is not
 * the command, and a keyword stays a keyword. The shell's own words are coloured only where a
 * command stands, so the `test` of `bun test` is an argument, not the `test` built-in.
 */
const SHELL_COMMAND: Mode = {
  scope: 'built_in',
  match: new RegExp(
    `(?<=(?:^[ \\t]*(?:\\$[ \\t]+)?|[|&;(][ \\t]*|\\b(?:then|do|else|time)[ \\t]+)(?:[A-Za-z_]\\w*=[^ \\t]*[ \\t]+)*)` +
      `(?!(?:${SHELL_KEYWORDS})(?![\\w.-]))(?![\\w./-]*=)[A-Za-z_./][\\w./-]*`,
  ),
}
const SHELL_FLAG: Mode = { scope: 'attr', match: /(?<=[ \t])--?[A-Za-z][\w-]*/ }
const SHELL_NUMBER: Mode = { scope: 'number', match: /(?<=[ \t=])\d+(?:\.\d+)*(?![\w./-])/ }

const shell: LanguageFn = (api) => {
  const grammar = bash(api)
  const keywords = typeof grammar.keywords === 'object' ? grammar.keywords : {}
  return {
    ...grammar,
    keywords: { ...keywords, built_in: [] },
    contains: [SHELL_COMMAND, SHELL_FLAG, SHELL_NUMBER, ...(grammar.contains ?? [])],
  }
}

const highlighter = hljs.newInstance()
for (const [name, grammar] of Object.entries({
  bash: shell,
  css,
  javascript,
  json,
  markdown,
  sql,
  typescript,
  xml,
  yaml,
})) {
  highlighter.registerLanguage(name, grammar)
}

const aliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  md: 'markdown',
  yml: 'yaml',
}

function escapeHtml(source: string): string {
  return source.replace(/[&<>"']/g, (character) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!
  })
}

export function highlightCode(source: string, fenceLanguage?: string): string
export function highlightCode(
  source: string,
  fenceLanguage: string | undefined,
  options: { unknown: 'null' },
): string | null
/**
 * Highlighted HTML for the fence's language. Only a language the fence names is highlighted, never
 * a guessed one: an unknown or plain-text fence comes back escaped (or null, when asked).
 */
export function highlightCode(
  source: string,
  fenceLanguage = 'text',
  options?: { unknown: 'null' },
): string | null {
  const normalized = fenceLanguage.toLowerCase()
  const language = aliases[normalized] ?? normalized
  if (!highlighter.getLanguage(language)) return options ? null : escapeHtml(source)
  return highlighter.highlight(source, { language, ignoreIllegals: true }).value
}
