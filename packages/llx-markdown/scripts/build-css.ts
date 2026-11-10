/**
 * `dist/styles.css`: the five stylesheets in the order they depend on each other (tokens first),
 * as one file a page imports once. Comments stay: they say why a rule is what it is, and a
 * page's bundler minifies.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const parts = ['tokens.css', 'markdown.css', 'forms.css', 'code.css', 'diagram.css']
const header = '/* llx-markdown styles. Import once: `import "llx-markdown/styles.css"`. */\n'
const css = parts
  .map((name) => `/* ${name} */\n${readFileSync(join(root, 'styles', name), 'utf8').trim()}\n`)
  .join('\n')
writeFileSync(join(root, 'dist', 'styles.css'), header + css)
console.log(`dist/styles.css: ${(css.length / 1024).toFixed(1)} KB`)
