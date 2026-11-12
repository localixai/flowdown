/**
 * What publint and attw do not check about the published files:
 *   - every `exports` target exists;
 *   - `llx-markdown/stream`, `/remark`, `/prompt`, `/engine`, `/document`, `/static`, `/dom`,
 *     `/element` and `/tui` never import React, and all of them but `/stream` and `/remark`
 *     import no package at all, so a server, a worker, a terminal or a page of another framework
 *     can use them;
 *   - every React module that uses hooks keeps its `'use client'`;
 *   - nothing imports KaTeX, highlight.js or Mermaid except the entry that is about it.
 * Run after `build`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { packageOf, reach as reachFile } from './graph'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
}
const failures: string[] = []

for (const [path, target] of Object.entries(manifest.exports)) {
  if (!existsSync(join(root, target))) failures.push(`exports["${path}"] → ${target} is missing`)
}

const reach = (target: string, options?: { dynamic?: boolean }) => {
  const graph = reachFile(join(root, target), options)
  return { files: graph.files, packages: new Set([...graph.packages].map(packageOf)) }
}

const reactFree = [
  './stream',
  './remark',
  './prompt',
  './engine',
  './document',
  './static',
  './dom',
  './element',
  './tui',
]
for (const path of reactFree) {
  const { packages } = reach(manifest.exports[path]!)
  for (const name of ['react', 'react-dom', 'react-markdown'])
    if (packages.has(name)) failures.push(`${path} imports ${name}`)
}
for (const path of [
  './prompt',
  './engine',
  './document',
  './static',
  './dom',
  './element',
  './tui',
]) {
  const { packages } = reach(manifest.exports[path]!)
  if (packages.size > 0) failures.push(`${path} imports ${[...packages].join(', ')}`)
}

const owners: Record<string, string> = {
  katex: './math',
  'highlight.js': './highlight',
  mermaid: '',
}
for (const [path, target] of Object.entries(manifest.exports)) {
  if (!target.endsWith('.js')) continue
  const { packages } = reach(target, { dynamic: false })
  for (const [name, owner] of Object.entries(owners))
    if (packages.has(name) && owner !== path) failures.push(`${path} imports ${name}`)
}

// What loads with the renderer itself: the HTML parser and the heavy engines are chunks of their
// own, fetched when a document needs them.
const eager = reach(manifest.exports['.']!, { dynamic: false })
for (const name of ['rehype-raw', 'katex', 'highlight.js', 'mermaid'])
  if (eager.packages.has(name)) failures.push(`. loads ${name} with the renderer`)

const main = reach(manifest.exports['.']!)
for (const file of main.files) {
  const source = readFileSync(file, 'utf8')
  const hooks = /\buse(?:State|Effect|Memo|Ref|Id|Context|SyncExternalStore)\b/.test(source)
  if (hooks && !/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(source))
    failures.push(`${file.slice(root.length + 1)} uses hooks without 'use client'`)
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'))
  process.exit(1)
}
console.log(
  `✓ package: ${Object.keys(manifest.exports).length} exports, entry isolation, 'use client'`,
)
