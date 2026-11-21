/**
 * The code the quality check and the benchmark read: what an agent writes (`test/agent/`, this
 * package's own), the samples of the TextMate grammars and highlight.js's markup tests (in
 * `.refs/`, from `scripts/references.ts`). Each file says which language each highlighter reads
 * it as.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { REFS } from './references'

export interface Sample {
  /** Where it comes from: `agent`, `shiki` or `hljs`. */
  source: 'agent' | 'shiki' | 'hljs'
  file: string
  /** The language for this package, for Shiki and for highlight.js. */
  language: string
  shiki: string
  hljs: string
  code: string
}

/** This package's language, Shiki's and highlight.js's, by the name a fence gives. */
const LANGUAGES: Record<string, [ours: string, shiki: string, hljs: string]> = {
  bash: ['bash', 'shellscript', 'bash'],
  console: ['console', 'shellsession', 'shell'],
  c: ['c', 'c', 'c'],
  cpp: ['cpp', 'cpp', 'cpp'],
  csharp: ['csharp', 'csharp', 'csharp'],
  css: ['css', 'css', 'css'],
  scss: ['scss', 'scss', 'scss'],
  diff: ['diff', 'diff', 'diff'],
  dockerfile: ['dockerfile', 'docker', 'dockerfile'],
  go: ['go', 'go', 'go'],
  ini: ['ini', 'ini', 'ini'],
  java: ['java', 'java', 'java'],
  javascript: ['javascript', 'javascript', 'javascript'],
  jsx: ['javascript', 'jsx', 'javascript'],
  json: ['json', 'jsonc', 'json'],
  kotlin: ['kotlin', 'kotlin', 'kotlin'],
  markdown: ['markdown', 'markdown', 'markdown'],
  php: ['php', 'php', 'php'],
  python: ['python', 'python', 'python'],
  ruby: ['ruby', 'ruby', 'ruby'],
  rust: ['rust', 'rust', 'rust'],
  sql: ['sql', 'sql', 'sql'],
  swift: ['swift', 'swift', 'swift'],
  toml: ['toml', 'toml', 'ini'],
  typescript: ['typescript', 'typescript', 'typescript'],
  tsx: ['typescript', 'tsx', 'typescript'],
  html: ['xml', 'html', 'xml'],
  xml: ['xml', 'xml', 'xml'],
  yaml: ['yaml', 'yaml', 'yaml'],
}

/** Shiki's sample names that are not the fence's. */
const SHIKI_FILES: Record<string, string> = {
  bash: 'shellscript',
  console: 'shellsession',
  dockerfile: 'docker',
  json: 'jsonc',
}

const sample = (source: Sample['source'], key: string, file: string): Sample => {
  const [language, shiki, hljs] = LANGUAGES[key]!
  return {
    source,
    file,
    language,
    shiki,
    hljs,
    code: readFileSync(file, 'utf8').replace(/\n$/, ''),
  }
}

export function corpus(
  sources: readonly Sample['source'][] = ['agent', 'shiki', 'hljs'],
): Sample[] {
  const samples: Sample[] = []
  const agent = join(import.meta.dir, '..', 'test', 'agent')
  if (sources.includes('agent') && existsSync(agent))
    for (const name of readdirSync(agent).toSorted()) {
      const key = name.slice(0, -extname(name).length).replace(/-.*$/, '')
      if (LANGUAGES[key]) samples.push(sample('agent', key, join(agent, name)))
    }
  const shiki = join(REFS, 'textmate-grammars-themes', 'samples')
  if (sources.includes('shiki') && existsSync(shiki))
    for (const key of Object.keys(LANGUAGES)) {
      const file = join(shiki, `${SHIKI_FILES[key] ?? key}.sample`)
      if (existsSync(file)) samples.push(sample('shiki', key, file))
    }
  const hljs = join(REFS, 'highlight.js', 'test', 'markup')
  if (sources.includes('hljs') && existsSync(hljs))
    for (const key of Object.keys(LANGUAGES)) {
      const [, , name] = LANGUAGES[key]!
      // jsx, tsx, html and toml have no tests of their own there: their language's are read once.
      if (key !== name && key !== 'console') continue
      const dir = join(hljs, name)
      if (!existsSync(dir)) continue
      for (const file of readdirSync(dir).toSorted())
        if (file.endsWith('.txt') && !file.endsWith('.expect.txt'))
          samples.push(sample('hljs', key, join(dir, file)))
    }
  return samples
}
