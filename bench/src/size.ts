/**
 * What a page downloads to render Markdown with each library: its code and every dependency it
 * pulls in, minified and gzipped, the way a bundler ships it. React is left out: the page has it.
 *
 * "At once" is what the page loads with the component; "on demand" is what the library splits off
 * and fetches only when a reply needs it (llx-markdown's HTML parser, for a reply with raw HTML).
 * Engines a page passes in itself (KaTeX, Mermaid) are not counted for anyone.
 *
 * Writes results/size.md, and fails when llx-markdown's "at once" passes its budget.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** llx-markdown's own budget for what loads with `<Markdown>`, in KB gzipped: today and a margin. */
const BUDGET_KB = 95

const CASES = [
  { name: 'llx-markdown', code: `import { Markdown } from 'llx-markdown'; console.log(Markdown)` },
  {
    name: 'llx-markdown + highlight',
    code: `import { Markdown } from 'llx-markdown'; import { highlight } from 'llx-markdown/highlight'; console.log(Markdown, highlight)`,
  },
  {
    name: 'llx-markdown/stream',
    code: `import * as stream from 'llx-markdown/stream'; console.log(stream)`,
  },
  {
    name: 'react-markdown + remark-gfm',
    code: `import Markdown from 'react-markdown'; import gfm from 'remark-gfm'; console.log(Markdown, gfm)`,
  },
  { name: 'streamdown', code: `import { Streamdown } from 'streamdown'; console.log(Streamdown)` },
]

const kb = (bytes: number) => bytes / 1024
const gzip = (text: string) => gzipSync(text, { level: 9 }).length

/** The chunks a file imports statically: they load with it. A dynamic `import()` does not. */
const STATIC_IMPORT =
  /(?:import|export)[^"'()]*?from\s*["']\.\/([^"']+)["']|import\s*["']\.\/([^"']+)["']/g

async function measure(code: string) {
  const dir = await mkdtemp(join(import.meta.dir, '../.size-'))
  try {
    const entry = join(dir, 'entry.tsx')
    await Bun.write(entry, code)
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: join(dir, 'out'),
      minify: true,
      splitting: true,
      target: 'browser',
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      throw: false,
    })
    if (!result.success) throw new AggregateError(result.logs, 'could not bundle')
    const chunks = new Map<string, string>()
    for (const output of result.outputs)
      if (output.path.endsWith('.js')) chunks.set(basename(output.path), await output.text())

    const eager = new Set<string>()
    const pending = ['entry.js']
    while (pending.length > 0) {
      const name = pending.pop()!
      if (eager.has(name)) continue
      eager.add(name)
      for (const match of chunks.get(name)!.matchAll(STATIC_IMPORT))
        pending.push(match[1] ?? match[2]!)
    }
    const size = (names: string[]) =>
      kb(names.reduce((sum, name) => sum + gzip(chunks.get(name)!), 0))
    return {
      atOnce: size([...eager]),
      onDemand: size([...chunks.keys()].filter((name) => !eager.has(name))),
      minified: kb([...chunks.values()].reduce((sum, text) => sum + text.length, 0)),
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const rows: string[] = []
let over = false
for (const { name, code } of CASES) {
  const { atOnce, onDemand, minified } = await measure(code)
  const budget = name === 'llx-markdown' ? ` (budget ${BUDGET_KB} KB)` : ''
  if (name === 'llx-markdown' && atOnce > BUDGET_KB) over = true
  rows.push(
    `| ${name} | ${atOnce.toFixed(1)} KB${budget} | ${onDemand > 0 ? `${onDemand.toFixed(1)} KB` : '—'} | ${minified.toFixed(0)} KB |`,
  )
  console.log(
    `${over && name === 'llx-markdown' ? '✗' : '✓'} ${name.padEnd(28)} ${atOnce.toFixed(1)} KB at once, ${onDemand.toFixed(1)} KB on demand`,
  )
}

const table = [
  '| | At once (gzip) | On demand (gzip) | Minified, all |',
  '| --- | --- | --- | --- |',
  ...rows,
].join('\n')
await Bun.write(
  join(import.meta.dir, '../results/size.md'),
  `# Bundle size\n\nWhat a page downloads for each library, without React. \`bun run size\` in bench/ writes this file; [src/size.ts](../src/size.ts) says how it is measured.\n\n${table}\n`,
)
if (over) {
  console.error(`llx-markdown loads more than its ${BUDGET_KB} KB budget at once`)
  process.exit(1)
}
