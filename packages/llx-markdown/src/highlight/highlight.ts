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

const highlighter = hljs.newInstance()
for (const [name, grammar] of Object.entries({
  bash,
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
