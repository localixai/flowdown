/**
 * `bun scripts/references.ts`: clones the references the quality check reads into `.refs/`
 * (ignored): highlight.js, whose markup tests are code each grammar was written against, and the
 * TextMate grammars Shiki and VS Code colour with, whose samples are code in every language. Only
 * the code is read; nothing of theirs is copied into the package.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const REFS = join(import.meta.dir, '..', '.refs')

const REPOSITORIES = {
  'highlight.js': 'https://github.com/highlightjs/highlight.js.git',
  'textmate-grammars-themes': 'https://github.com/shikijs/textmate-grammars-themes.git',
}

if (import.meta.main) {
  mkdirSync(REFS, { recursive: true })
  for (const [name, url] of Object.entries(REPOSITORIES)) {
    const into = join(REFS, name)
    if (existsSync(into)) {
      console.log(`${name}: there`)
      continue
    }
    const clone = Bun.spawnSync(['git', 'clone', '--depth', '1', url, into], { stderr: 'inherit' })
    if (clone.exitCode !== 0) process.exit(clone.exitCode)
    console.log(`${name}: cloned`)
  }
}
