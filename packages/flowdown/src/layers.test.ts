/**
 * The package's layers, held by a test: what each folder of `src` may import, which packages it
 * may name, and whether it may touch a page.
 *
 *     engine      text to a tree
 *     core        the dialect and what is worked out from a block
 *     document    a growing text as blocks
 *     render      a tree as elements of any kind (a factory), and a whole document as plain ones
 *     ─────────── above: no framework, no page ───────────
 *     static  dom  element  react  tui     targets and bindings: each names only what is under it
 *
 * A target that reached into another, or a layer that reached up, would still build and pass its
 * own tests; it is this file that fails.
 */
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'

const SRC = import.meta.dir

/** What each part of `src` may import from the rest of it. */
const MAY_IMPORT: Record<string, string[]> = {
  engine: [],
  'dialect.ts': [],
  prompt: ['dialect.ts'],
  core: ['engine', 'dialect.ts'],
  document: ['engine', 'core', 'dialect.ts'],
  render: ['engine', 'core', 'document', 'dialect.ts'],
  // Extensions a page passes in: they know the tree, never a target.
  html: ['engine'],
  math: ['engine', 'core'],
  highlight: [],
  // Targets and bindings.
  static: ['engine', 'render'],
  tui: ['engine', 'core', 'document', 'dialect.ts'],
  browser: [],
  dom: ['engine', 'render', 'browser'],
  element: ['dom'],
  react: ['engine', 'core', 'document', 'render', 'browser', 'dialect.ts', 'html', 'mermaid'],
  mermaid: ['core', 'render', 'browser', 'react'],
  // Entries.
  'index.ts': ['engine', 'core', 'react', 'mermaid'],
  'remark.ts': ['core', 'dialect.ts'],
  'stream.ts': ['core'],
}

/** The packages a part may name; a part not listed names none. */
const MAY_NAME: Record<string, string[]> = {
  react: ['react', 'mermaid'],
  mermaid: ['react', 'mermaid'],
  math: ['katex'],
  highlight: ['highlight.js'],
}

/** The parts that run where there may be no page: a server, a worker, a terminal. */
const NO_PAGE = [
  'engine',
  'dialect.ts',
  'prompt',
  'core',
  'document',
  'render',
  'html',
  'math',
  'highlight',
  'static',
  'tui',
  'remark.ts',
  'stream.ts',
]

const PAGE =
  /\b(?:window|navigator|localStorage|sessionStorage|customElements|HTMLElement|ResizeObserver|MutationObserver|requestAnimationFrame)\b|\bdocument\s*\./

const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.|\.d\.ts$/.test(entry.name) ? [path] : []
  })

const partOf = (path: string): string => relative(SRC, path).split('/')[0]!

/** The code of a file: what a comment says of another layer is not an import of it. */
const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

const imports = (source: string): string[] =>
  [...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((hit) => hit[1]!)

const all = files(SRC)

test('every part of src has its place in the table', () => {
  const parts = [...new Set(all.map(partOf))].toSorted()
  expect(parts.filter((part) => !(part in MAY_IMPORT))).toEqual([])
})

test('a part imports only the parts under it', () => {
  const crossings: string[] = []
  for (const path of all) {
    const part = partOf(path)
    const allowed = MAY_IMPORT[part] ?? []
    for (const specifier of imports(code(path))) {
      if (!specifier.startsWith('.')) continue
      const target = relative(SRC, normalize(join(dirname(path), specifier)))
      // `../dialect` is the file, `../engine` the folder: both are named by their first segment.
      const first = target.split('/')[0]!
      const to = first in MAY_IMPORT ? first : `${first}.ts`
      if (to !== part && !allowed.includes(to))
        crossings.push(`${relative(SRC, path)} imports ${specifier} (${part} → ${to})`)
    }
  }
  expect(crossings).toEqual([])
})

test('a package is named only by the part that is about it', () => {
  const named: string[] = []
  for (const path of all) {
    const part = partOf(path)
    const allowed = MAY_NAME[part] ?? []
    for (const specifier of imports(code(path))) {
      if (specifier.startsWith('.') || specifier.startsWith('node:')) continue
      const name = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]!
      // Types only: erased when the package is built.
      if (name === 'mdast' || name === 'hast') continue
      if (!allowed.includes(name)) named.push(`${relative(SRC, path)} imports ${specifier}`)
    }
  }
  expect(named).toEqual([])
})

test('what runs without a page does not reach for one', () => {
  const reaches: string[] = []
  for (const path of all) {
    if (!NO_PAGE.includes(partOf(path))) continue
    // A word in a label ('Fit to window') is not the page.
    const source = code(path).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
    for (const [index, line] of source.split('\n').entries())
      if (PAGE.test(line)) reaches.push(`${relative(SRC, path)}:${index + 1} ${line.trim()}`)
  }
  expect(reaches).toEqual([])
})

test('the table has no way up: nothing under a target imports a target', () => {
  // Followed through the table itself, so a line added to it cannot open a way round.
  const targets = ['static', 'tui', 'dom', 'element', 'react', 'mermaid', 'browser']
  const reachable = (part: string, seen = new Set<string>()): Set<string> => {
    for (const next of MAY_IMPORT[part] ?? [])
      if (!seen.has(next)) {
        seen.add(next)
        reachable(next, seen)
      }
    return seen
  }
  for (const part of [
    'engine',
    'core',
    'document',
    'render',
    'html',
    'math',
    'highlight',
    'prompt',
  ])
    expect(
      [...reachable(part)].filter((to) => targets.includes(to)),
      part,
    ).toEqual([])
  // And the targets that need no page or framework stay clear of the ones that do.
  for (const part of ['static', 'tui'])
    expect(
      [...reachable(part)].filter((to) =>
        ['dom', 'element', 'react', 'mermaid', 'browser'].includes(to),
      ),
      part,
    ).toEqual([])
  expect([...reachable('dom'), ...reachable('element')].filter((to) => to === 'react')).toEqual([])
})
