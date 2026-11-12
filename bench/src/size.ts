/**
 * What a page downloads to render Markdown with each library: its code and every dependency it
 * pulls in, minified and gzipped, the way a bundler ships it. React is left out: the page has it.
 *
 * "At once" is what the page loads with the component; "on demand" is what the library splits off
 * and fetches only when a reply needs it (flowdown's HTML parser, for a reply with raw HTML).
 * Engines a page passes in itself (KaTeX, Mermaid) are not counted for anyone.
 *
 * Writes results/size.md, and fails when flowdown's "at once" passes its budget.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** flowdown's own budget for what loads with `<Markdown>`, in KB gzipped: today and a margin. */
const BUDGET_KB = 88

const CASES = [
  { name: 'flowdown', code: `import { Markdown } from '@localix-ai/flowdown'; console.log(Markdown)` },
  {
    name: 'flowdown + highlight',
    code: `import { Markdown } from '@localix-ai/flowdown'; import { highlight } from '@localix-ai/flowdown/highlight'; console.log(Markdown, highlight)`,
  },
  {
    name: '@localix-ai/flowdown/stream',
    code: `import * as stream from '@localix-ai/flowdown/stream'; console.log(stream)`,
  },
  {
    name: 'react-markdown + remark-gfm',
    code: `import Markdown from 'react-markdown'; import gfm from 'remark-gfm'; console.log(Markdown, gfm)`,
  },
  { name: 'streamdown', code: `import { Streamdown } from 'streamdown'; console.log(Streamdown)` },
  {
    name: 'markdown-to-jsx',
    code: `import Markdown from 'markdown-to-jsx/react'; console.log(Markdown)`,
  },
  {
    name: 'markstream-react',
    code: `import MarkdownRender from 'markstream-react'; console.log(MarkdownRender)`,
  },
  { name: 'marked-react', code: `import Markdown from 'marked-react'; console.log(Markdown)` },
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
      // React is the page's own. The rest are optional peers a renderer imports only when a reply
      // needs them (markstream's diagrams, math and diffs); a page that never installs them never
      // downloads them, and flowdown's KaTeX and Mermaid are left out the same way.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@antv/infographic',
        '@terrastruct/d2',
        'katex',
        'mermaid',
        'stream-diffs',
      ],
      // A production build, as Vite or Next.js makes it: micromark's development build carries
      // assertions and the `debug` package.
      conditions: ['production'],
      define: { 'process.env.NODE_ENV': '"production"' },
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
const figures: Record<string, { atOnce: number; onDemand: number }> = {}
let over = false
for (const { name, code } of CASES) {
  const { atOnce, onDemand, minified } = await measure(code)
  figures[name] = { atOnce: Number(atOnce.toFixed(1)), onDemand: Number(onDemand.toFixed(1)) }
  const budget = name === 'flowdown' ? ` (budget ${BUDGET_KB} KB)` : ''
  if (name === 'flowdown' && atOnce > BUDGET_KB) over = true
  rows.push(
    `| ${name} | ${atOnce.toFixed(1)} KB${budget} | ${onDemand > 0 ? `${onDemand.toFixed(1)} KB` : '—'} | ${minified.toFixed(0)} KB |`,
  )
  console.log(
    `${over && name === 'flowdown' ? '✗' : '✓'} ${name.padEnd(28)} ${atOnce.toFixed(1)} KB at once, ${onDemand.toFixed(1)} KB on demand`,
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
await Bun.write(
  join(import.meta.dir, '../results/size.json'),
  `${JSON.stringify(figures, null, 2)}\n`,
)
if (over) {
  console.error(`flowdown loads more than its ${BUDGET_KB} KB budget at once`)
  process.exit(1)
}
