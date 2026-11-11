/**
 * `<runtime> parse-cell.js <corpus.json> <parser> <quick>`: one parser through every text of the
 * corpus, in a process of its own, so no parser runs on code another one warmed. `parse.ts` bundles
 * this file once and starts it under each runtime (Bun and Node), for each parser.
 *
 * For each text: the parser is warmed up on it, then timed one parse at a time (several in a row
 * when one is shorter than a millisecond, so the clock's resolution does not count), with garbage
 * collection left in: it is part of what a parse costs. Prints one line of JSON: the samples, and
 * what the output holds, so a parser that read less shows it.
 */
import { readFileSync } from 'node:fs'
import { PARSERS } from './parsers'

interface Text {
  name: string
  text: string
}

const [corpusPath, parserName, quickArg] = process.argv.slice(2)
const quick = quickArg === 'quick'
const corpus = JSON.parse(readFileSync(corpusPath!, 'utf8')) as Text[]
const parser = PARSERS.find((p) => p.name === parserName)
if (!parser) {
  console.error(`unknown parser: ${parserName}`)
  process.exit(2)
}

const WARM_MS = quick ? 100 : 300
const MEASURE_MS = quick ? 300 : 1000
const MIN_SAMPLES = quick ? 10 : 40
/** A sample is at least this long: below it, the clock's resolution would show in the result. */
const SAMPLE_MS = 2

/** Keeps every result reachable, so no engine can drop a parse whose output nobody reads. */
let sink = 0
const keep = (value: unknown) => {
  sink += typeof value === 'string' ? value.length : value === null ? 0 : 1
}

/** How many of each element the output holds, counted the same way for trees and for HTML. */
type Counts = Record<string, number>

const HTML_PATTERNS: Record<string, RegExp> = {
  headings: /<h[1-6][\s>]/g,
  codeBlocks: /<pre[\s>]/g,
  tables: /<table[\s>]/g,
  rows: /<tr[\s>]/g,
  listItems: /<li[\s>]/g,
  strong: /<strong>/g,
  emphasis: /<em>/g,
  strikethrough: /<(?:del|s)>/g,
  footnoteRefs: /<sup[\s>]/g,
  checkboxes: /<input[^>]*type="checkbox"/g,
}

const TREE_TYPES: Record<string, string> = {
  heading: 'headings',
  code: 'codeBlocks',
  table: 'tables',
  tableRow: 'rows',
  listItem: 'listItems',
  strong: 'strong',
  emphasis: 'emphasis',
  delete: 'strikethrough',
  footnoteReference: 'footnoteRefs',
}

const count = (output: unknown): Counts => {
  const counts: Counts = Object.fromEntries(Object.keys(HTML_PATTERNS).map((key) => [key, 0]))
  if (typeof output === 'string') {
    for (const [key, pattern] of Object.entries(HTML_PATTERNS))
      counts[key] = output.match(pattern)?.length ?? 0
    return counts
  }
  type Tree = { type: string; checked?: boolean | null; children?: Tree[] }
  const walk = (node: Tree) => {
    const key = TREE_TYPES[node.type]
    if (key) counts[key]! += 1
    if (node.type === 'listItem' && typeof node.checked === 'boolean') counts.checkboxes! += 1
    for (const child of node.children ?? []) walk(child)
  }
  walk(output as Tree)
  return counts
}

const now = () => performance.now()

const results = corpus.map(({ name, text }) => {
  const run = parser.make()
  const counts = count(run(text))

  // Warm up: the engine compiles the hot paths for this text before the clock runs.
  let warmed = 0
  const warmStart = now()
  while (now() - warmStart < WARM_MS || warmed < 5) {
    keep(run(text))
    warmed++
  }
  const estimate = (now() - warmStart) / warmed
  const batch = Math.max(1, Math.ceil(SAMPLE_MS / Math.max(estimate, 1e-3)))

  const samples: number[] = []
  const measureStart = now()
  while (now() - measureStart < MEASURE_MS || samples.length < MIN_SAMPLES) {
    const start = now()
    for (let i = 0; i < batch; i++) keep(run(text))
    samples.push((now() - start) / batch)
  }
  return { name, counts, batch, samples }
})

console.log(JSON.stringify({ parser: parser.name, sink, results }))
