/**
 * `dist/styles.css`: the five stylesheets in the order they depend on each other (tokens first),
 * as one file a page imports once. Comments stay: they say why a rule is what it is, and a
 * page's bundler minifies.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const parts = ['tokens.css', 'markdown.css', 'forms.css', 'code.css', 'diagram.css']
const header = '/* flowdown styles. Import once: `import "@localix-ai/flowdown/styles.css"`. */\n'
const css = parts
  .map((name) => `/* ${name} */\n${readFileSync(join(root, 'styles', name), 'utf8').trim()}\n`)
  .join('\n')
writeFileSync(join(root, 'dist', 'styles.css'), header + css)
console.log(`dist/styles.css: ${(css.length / 1024).toFixed(1)} KB`)

// `dist/math.css`: the math font and its rules, from `@localix-ai/math`, with the font files beside
// it (the stylesheet names them relative to itself) and their license.
const math = join(root, '..', 'math')
writeFileSync(
  join(root, 'dist', 'math.css'),
  '/* flowdown math: the font formulas are set in. Import once: `import "@localix-ai/flowdown/math.css"`. */\n' +
    readFileSync(join(math, 'src', 'styles.css'), 'utf8'),
)
for (const file of ['math.woff2', 'math-letters.woff2', 'OFL.txt'])
  writeFileSync(
    join(root, 'dist', file === 'OFL.txt' ? 'math-font-OFL.txt' : file),
    readFileSync(join(math, 'fonts', file)),
  )
console.log('dist/math.css, with its fonts')
