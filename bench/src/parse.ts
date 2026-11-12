/**
 * `bun src/parse.ts [--quick] [--runs=3] [--runtimes=bun,node] [--parsers=marked,micromark]
 * [--no-write]`
 *
 * The parser alone, with no React and no DOM: how long each Markdown parser takes to read a whole
 * text once, into its tree or its HTML. The streaming benchmark (`run.ts`) measures what a page
 * pays per update, React and the DOM included; this one isolates the step every renderer starts
 * with.
 *
 * The texts are the streaming benchmark's replies (the same seeds) and the CommonMark spec, the
 * corpus markdown-it's and micromark's own benchmarks read. `parse-cell.ts` is bundled once, with
 * the `production` export condition (micromark's development build carries assertions), and run
 * under Bun (JavaScriptCore, Safari's engine) and Node (V8, Chrome's), one process per parser and
 * run. Writes results/parse.md and results/parse.json.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus, platform, release, tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaling, scenarios } from '../../packages/flowdown/test/replies'
import { hash } from '../../packages/flowdown/test/random'
import { PARSERS } from './parsers'

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const quick = process.argv.includes('--quick')
const runs = Number(flag('runs') ?? (quick ? 1 : 3))
const parsers = PARSERS.filter(
  (p) => !flag('parsers') || flag('parsers')!.split(',').includes(p.name),
)
const wantedRuntimes = flag('runtimes')?.split(',') ?? ['bun', 'node']
const partial = quick || flag('parsers') !== undefined || flag('runtimes') !== undefined

const require = createRequire(import.meta.url)
const spec = readFileSync(require.resolve('commonmark-spec/spec.txt'), 'utf8')
const corpus = [
  ...scenarios()
    .filter((s) => s.history === undefined)
    .map((s) => ({ name: s.name, text: s.text })),
  ...scaling().map((s) => ({ name: s.name, text: s.text })),
  { name: 'commonmark-spec', text: spec },
]
const bytes = (text: string) => Buffer.byteLength(text, 'utf8')

const versionOf = (pkg: string) =>
  pkg === 'flowdown'
    ? (
        JSON.parse(
          readFileSync(join(import.meta.dir, '../../packages/flowdown/package.json'), 'utf8'),
        ) as { version: string }
      ).version
    : (
        JSON.parse(
          readFileSync(join(import.meta.dir, '../node_modules', pkg, 'package.json'), 'utf8'),
        ) as { version: string }
      ).version

const which = (command: string) => {
  try {
    return execSync(`command -v ${command}`, { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}
const runtimes = wantedRuntimes
  .map((name) => {
    const path = name === 'bun' ? process.execPath : which(name)
    if (!path) {
      console.warn(`${name} is not installed: skipped`)
      return null
    }
    const version = execSync(`"${path}" --version`, { encoding: 'utf8' }).trim().replace(/^v/, '')
    return { name, path, version, engine: name === 'bun' ? 'JavaScriptCore' : 'V8' }
  })
  .filter((r) => r !== null)

const work = mkdtempSync(join(tmpdir(), 'fd-parse-'))
try {
  const corpusPath = join(work, 'corpus.json')
  writeFileSync(corpusPath, JSON.stringify(corpus))
  const build = await Bun.build({
    entrypoints: [join(import.meta.dir, 'parse-cell.ts')],
    outdir: work,
    target: 'node',
    format: 'esm',
    conditions: ['production'],
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  if (!build.success) throw new AggregateError(build.logs, 'could not bundle parse-cell.ts')
  const cellPath = join(work, 'parse-cell.js')

  type CellResult = {
    parser: string
    results: { name: string; counts: Record<string, number>; batch: number; samples: number[] }[]
  }
  const cell = (runtime: string, parser: string): CellResult => {
    const child = Bun.spawnSync([runtime, cellPath, corpusPath, parser, quick ? 'quick' : 'full'], {
      stderr: 'inherit',
    })
    if (child.exitCode !== 0) throw new Error(`${runtime} ${parser}: exit ${child.exitCode}`)
    return JSON.parse(child.stdout.toString().trim().split('\n').at(-1)!) as CellResult
  }

  const median = (values: number[]) => {
    const sorted = values.toSorted((a, b) => a - b)
    const mid = sorted.length / 2
    return sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  }

  interface Row {
    runtime: string
    parser: string
    text: string
    bytes: number
    /** The median parse, the median over the runs of each run's median. */
    ms: number
    /** The runs' medians, fastest and slowest: how far apart the runs landed. */
    spread: [number, number]
    mbPerS: number
    counts: Record<string, number>
  }
  const rows: Row[] = []
  for (const runtime of runtimes) {
    // Runs outermost, so a slow minute of the machine falls on every parser, not on one.
    const byRun: CellResult[][] = []
    for (let run = 0; run < runs; run++) {
      byRun.push(parsers.map((parser) => cell(runtime.path, parser.name)))
      console.log(`${runtime.name} run ${run + 1}/${runs} done`)
    }
    for (const [index, parser] of parsers.entries()) {
      for (const text of corpus) {
        const perRun = byRun.map((cells) => {
          const result = cells[index]!.results.find((r) => r.name === text.name)!
          return { median: median(result.samples), counts: result.counts }
        })
        const ms = median(perRun.map((r) => r.median))
        const size = bytes(text.text)
        rows.push({
          runtime: runtime.name,
          parser: parser.name,
          text: text.name,
          bytes: size,
          ms,
          spread: [
            Math.min(...perRun.map((r) => r.median)),
            Math.max(...perRun.map((r) => r.median)),
          ],
          mbPerS: size / 2 ** 20 / (ms / 1000),
          counts: perRun[0]!.counts,
        })
      }
    }
  }

  // ---- The report ---------------------------------------------------------------------------

  const fmt = (ms: number) =>
    ms >= 100 ? `${ms.toFixed(0)} ms` : ms >= 10 ? `${ms.toFixed(1)} ms` : `${ms.toFixed(2)} ms`
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`
  const row = (runtime: string, parser: string, text: string) =>
    rows.find((r) => r.runtime === runtime && r.parser === parser && r.text === text)

  /** Throughput over the whole corpus: every byte read, over every millisecond spent. */
  const overall = (runtime: string, parser: string) => {
    const mine = rows.filter((r) => r.runtime === runtime && r.parser === parser)
    const size = mine.reduce((sum, r) => sum + r.bytes, 0)
    const ms = mine.reduce((sum, r) => sum + r.ms, 0)
    return size / 2 ** 20 / (ms / 1000)
  }

  const summary = runtimes.map((runtime) => {
    const base = overall(runtime.name, 'flowdown')
    const lines = parsers
      .map((p) => ({ p, speed: overall(runtime.name, p.name) }))
      .toSorted((a, b) => b.speed - a.speed)
      .map(
        ({ p, speed }) =>
          `| \`${p.name}\` | ${p.output} | ${speed.toFixed(0)} MB/s | ${
            p.name === 'flowdown' ? '1.0×' : `${(base / speed).toFixed(1)}×`
          } |`,
      )
    return `### ${runtime.name} ${runtime.version} (${runtime.engine})

| Parser | Output | Throughput | flowdown is faster by |
| --- | --- | ---: | ---: |
${lines.join('\n')}`
  })

  const perText = runtimes.map((runtime) => {
    const head = `| Text | Size | ${parsers.map((p) => `\`${p.name}\``).join(' | ')} |`
    const rule = `| --- | ---: | ${parsers.map(() => '---:').join(' | ')} |`
    const lines = corpus.map((text) => {
      const cells = parsers.map((p) => {
        const r = row(runtime.name, p.name, text.name)
        return r ? fmt(r.ms) : '–'
      })
      return `| ${text.name} | ${kb(bytes(text.text))} | ${cells.join(' | ')} |`
    })
    return `### ${runtime.name} ${runtime.version}\n\n${[head, rule, ...lines].join('\n')}`
  })

  // What each parser drew, against flowdown's tree: a parser that skipped part of a text, or
  // read it differently, shows here rather than as a speed it did not earn.
  const firstRuntime = runtimes[0]!.name
  const differences: string[] = []
  for (const text of corpus) {
    const base = row(firstRuntime, 'flowdown', text.name)?.counts
    if (!base) continue
    for (const p of parsers) {
      if (p.name === 'flowdown') continue
      const counts = row(firstRuntime, p.name, text.name)!.counts
      const off = Object.keys(base)
        .filter((key) => counts[key] !== base[key])
        .map((key) => `${key} ${counts[key]} vs ${base[key]}`)
      if (off.length > 0) differences.push(`| ${text.name} | \`${p.name}\` | ${off.join(', ')} |`)
    }
  }

  const git = (command: string) => {
    try {
      return execSync(`git ${command}`, { cwd: import.meta.dir, encoding: 'utf8' }).trim()
    } catch {
      return 'unknown'
    }
  }
  const meta = {
    date: new Date().toISOString(),
    commit: git('rev-parse --short HEAD'),
    dirty: git('status --porcelain') !== '',
    cpu: cpus()[0]?.model ?? 'unknown',
    cores: cpus().length,
    os: `${platform()} ${release()}`,
    runtimes: runtimes.map((r) => `${r.name} ${r.version} (${r.engine})`),
    runs,
    quick,
    parsers: Object.fromEntries(parsers.map((p) => [p.name, versionOf(p.pkg)])),
    corpus: Object.fromEntries(corpus.map((t) => [t.name, hash(t.text)])),
  }

  const markdown = `# Parser speed

The parser alone, with no React and no DOM: how long each one takes to read a whole text once.
\`bun run parse\` in bench/ writes this file; [src/parse.ts](../src/parse.ts) says how it is
measured and [src/parsers.ts](../src/parsers.ts) how each parser is set up. The streaming
benchmark, React and the DOM included, is [latest.md](latest.md).

- **date:** ${meta.date}
- **commit:** ${meta.commit}${meta.dirty ? ' (with uncommitted changes)' : ''}
- **cpu:** ${meta.cpu}, ${meta.cores} cores, ${meta.os}
- **runtimes:** ${meta.runtimes.join(', ')}
- **runs:** ${runs}, one process per parser and run; the median of the runs' median parse

## Throughput

Every text of the corpus read once, its bytes over its time, in MB (2²⁰ bytes) a second. Higher is
better.

${summary.join('\n\n')}

## Each text

The median time of one whole parse.

${perText.join('\n\n')}

## The parsers

| Parser | Version | Output | What it reads, set up as here |
| --- | --- | --- | --- |
${parsers.map((p) => `| \`${p.name}\` | ${versionOf(p.pkg)} | ${p.output} | ${p.reads} |`).join('\n')}

Raw HTML is passed through by all of them; none sanitizes. \`flowdown\` is the engine
\`<Markdown>\` runs, called directly: it is not a public entry of the package.
\`mdast-util-from-markdown\` is remark's parser, the one react-markdown and Streamdown run.
The two trees differ in one way that costs time: mdast gives every node its position in the
source, inline ones too, where flowdown's tree gives positions to blocks only.

## What each one read

Headings, code blocks, tables, rows, list items, strong, emphasis, strikethrough, footnote
references and checkboxes in each output, counted on the tree or the HTML, against
flowdown's tree. Only the differences are listed. In HTML a footnote's definition is a list
item, one more than a tree counts, and micromark heads the footnotes with a heading of its own;
marked reads no footnotes.

${
  differences.length === 0
    ? 'None: every parser found the same elements in every text.'
    : `| Text | Parser | Counted vs flowdown |\n| --- | --- | --- |\n${differences.join('\n')}`
}
`

  console.log(`\n${summary.join('\n\n')}`)
  if (differences.length > 0) console.log(`\nDifferences:\n${differences.join('\n')}`)

  if (!process.argv.includes('--no-write')) {
    if (partial) {
      console.log('\nA quick or partial run: results/parse.md is left as it was.')
    } else {
      const dir = join(import.meta.dir, '../results')
      writeFileSync(join(dir, 'parse.md'), markdown)
      writeFileSync(join(dir, 'parse.json'), `${JSON.stringify({ meta, rows }, null, 2)}\n`)
      console.log('\nwrote results/parse.md and results/parse.json')
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
