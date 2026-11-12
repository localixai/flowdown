/**
 * What each entry costs a page, minified and gzipped: the code it loads at once, and beside it
 * what it fetches on demand (the HTML stage, the rarer character references) and the peer
 * packages it imports (a page may already have them). The package has no dependencies, so this is
 * all of it. Fails when an entry grows past its budget, so a change that bloats the renderer is a
 * decision, not an accident. Run after `build`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { packageOf, reach } from './graph'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
}

/** Budgets for what each entry loads at once, minified and gzipped, in KB: today's size and a margin. */
const BUDGET: Record<string, number> = {
  // The parser is the package's own now (it was react-markdown's, 52 KB of dependencies). Counted
  // with the chunk the entry shares with what it loads on demand: 4.5 KB that this script used to
  // leave out, which is why the figure is past the 30 it was held to.
  '.': 32.5,
  // The renderer with no framework under it: as HTML text, on a page, as an element of the page's.
  './static': 29,
  './dom': 30.5,
  './element': 30.5,
  // The renderer for a terminal: the parser, the dialect, and rows wrapped by their columns.
  './tui': 31,
  // A growing text as blocks with the dialect to parse them by (2.6 KB of the figure, and a page
  // that imports only `createDocument` does not ship it), and the parser alone.
  './document': 20.5,
  './engine': 13,
  // The plugin and the helpers; `extractHeadings` reads Markdown, so the parser is here too.
  './remark': 19.5,
  './stream': 4.5,
  './prompt': 2,
  // The HTML reader and sanitizer, and every HTML5 character reference (11.7 KB of it).
  './html': 16.5,
  './math': 1.5,
  // Past 0.8 KB since a shell line shows its command, flags and numbers (highlight.ts).
  './highlight': 1.1,
  // Past 5 KB since a drawn diagram has a toolbar and an enlarged viewer (`diagram.css`).
  './styles.css': 5.5,
}

/** The entry's bundle, and the chunks it imports on demand (split out, as a page's bundler does). */
async function minified(target: string) {
  const result = await Bun.build({
    entrypoints: [join(root, target)],
    minify: true,
    splitting: true,
    packages: 'external',
    target: 'browser',
    throw: false,
  })
  if (!result.success) throw new AggregateError(result.logs, `could not bundle ${target}`)
  // A stylesheet is an asset, not an entry point: it is the one output there is.
  const entry = result.outputs.find((output) => output.kind === 'entry-point') ?? result.outputs[0]
  if (!entry) throw new Error(`no entry in the bundle of ${target}`)
  const name = (path: string) => `./${path.split('/').pop()!}`
  const texts = new Map<string, string>()
  for (const output of result.outputs) texts.set(name(output.path), await output.text())
  // What loads at once is the entry and every chunk it imports statically, through any number of
  // chunks: code two entries share is split into a chunk of its own, and it is still loaded with
  // the page. Only what is behind an `import()` waits.
  const atOnce = new Set<string>()
  const follow = (chunk: string) => {
    if (atOnce.has(chunk)) return
    atOnce.add(chunk)
    for (const hit of (texts.get(chunk) ?? '').matchAll(/(?:\bfrom|\bimport)\s*"(\.\/[^"]+)"/g))
      if (texts.has(hit[1]!)) follow(hit[1]!)
  }
  follow(name(entry.path))
  const text = (chunks: string[]) => chunks.map((chunk) => texts.get(chunk)!).join('\n')
  return {
    atOnce: text([...atOnce]),
    onDemand: text([...texts.keys()].filter((chunk) => !atOnce.has(chunk))),
  }
}
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
let over = false
for (const [path, target] of Object.entries(manifest.exports)) {
  const budget = BUDGET[path]
  if (budget === undefined) continue
  const { atOnce, onDemand } = await minified(target)
  const size = gzipSync(atOnce).length
  const lazy = onDemand ? gzipSync(onDemand).length : 0
  const imports = target.endsWith('.css')
    ? []
    : [...new Set([...reach(join(root, target)).packages].map(packageOf))].toSorted()
  const fits = size <= budget * 1024
  over ||= !fits
  console.log(
    `${fits ? '✓' : '✗'} ${path.padEnd(13)} ${kb(size).padStart(8)} / ${String(budget).padEnd(4)} KB  ${(lazy ? `+${kb(lazy)} on demand` : '').padEnd(20)} ${imports.join(', ')}`,
  )
}
if (over) process.exit(1)
