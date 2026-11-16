/**
 * `bun src/growth.ts [--only=code,table] [--label=before] [--no-write]`
 *
 * One block that grows on every token, in each target: the shape a reply takes when an agent
 * writes a file (one fence), prints results (one table), or lists files (one list). The streaming
 * benchmark (`run.ts`) measures replies of many blocks, where each block is short, so a block whose
 * cost grows with its own length goes unseen there.
 *
 * Each shape is streamed at two sizes four times apart, 20 characters an update and then the
 * finished text, by the build of the package (`dist`). The exponent is log(t4 / t1) / log 4: 1 is
 * an update that costs the end of the block, 2 is one that reads the whole block again. Best of
 * three runs. Writes results/growth.md and results/growth.json, or results/growth-<label>.* with
 * `--label` (a run before a change, to set the one after beside).
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { cpus } from 'node:os'
import { prefixes } from '../../packages/flowdown/test/chunks'

GlobalRegistrator.register({ url: 'https://bench.test/' })
const { createTerminalView } = await import('@localix-ai/flowdown/tui')
const { mount } = await import('@localix-ai/flowdown/dom')
const { highlight } = await import('@localix-ai/flowdown/highlight')

const flag = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const only = flag('only')?.split(',')
const name = flag('label') ? `growth-${flag('label')}` : 'growth'

const words = 'the cache request worker session token reply stream block parser layout value'.split(
  ' ',
)
const sentence = (i: number) =>
  Array.from({ length: 12 }, (_, j) => words[(i * 7 + j * 3) % words.length]).join(' ')

/** Each shape as a function of its size, and its two sizes. */
const SHAPES: Record<string, { make: (n: number) => string; sizes: [number, number] }> = {
  code: {
    make: (n) =>
      `File:\n\n\`\`\`ts\n${Array.from({ length: n }, (_, i) => `  const value${i} = await stream(value, ${i}) // note`).join('\n')}\n\`\`\`\n\nDone.`,
    sizes: [225, 900],
  },
  table: {
    make: (n) =>
      `Results:\n\n| step | status | time | note |\n| --- | --- | ---: | --- |\n${Array.from({ length: n }, (_, i) => `| step${i} | ok | ${i * 7} ms | ${sentence(i)} |`).join('\n')}`,
    sizes: [40, 160],
  },
  list: {
    make: (n) => Array.from({ length: n }, (_, i) => `- **Item ${i}**: ${sentence(i)}.`).join('\n'),
    sizes: [60, 240],
  },
  quote: {
    make: (n) => Array.from({ length: n }, (_, i) => `> ${sentence(i)}.`).join('\n>\n'),
    sizes: [40, 160],
  },
  paragraph: {
    make: (n) => Array.from({ length: n }, (_, i) => `${sentence(i)}.`).join(' '),
    sizes: [60, 240],
  },
}

type Target = (steps: string[], text: string) => void
const TARGETS: Record<string, { run: Target; shapes?: string[] }> = {
  tui: {
    run(steps, text) {
      const view = createTerminalView({ width: 96 })
      for (const step of steps) view.render(step, { streaming: true })
      view.render(text)
    },
  },
  'tui + highlight': {
    shapes: ['code'],
    run(steps, text) {
      const view = createTerminalView({ width: 96, highlight })
      for (const step of steps) view.render(step, { streaming: true })
      view.render(text)
    },
  },
  dom: {
    run(steps, text) {
      const page = mount(document.createElement('div'))
      for (const step of steps) page.update(step, { streaming: true })
      page.update(text)
      page.destroy()
    },
  },
  'dom + highlight': {
    shapes: ['code'],
    run(steps, text) {
      const page = mount(document.createElement('div'), { highlight })
      for (const step of steps) page.update(step, { streaming: true })
      page.update(text)
      page.destroy()
    },
  },
}

const best = (run: () => void) =>
  Math.min(
    ...[0, 1, 2].map(() => {
      Bun.gc(true)
      const start = Bun.nanoseconds()
      run()
      return (Bun.nanoseconds() - start) / 1e6
    }),
  )

const rows: Array<{
  shape: string
  target: string
  chars: [number, number]
  ms: [number, number]
  exponent: number
}> = []
for (const [shape, { make, sizes }] of Object.entries(SHAPES)) {
  if (only && !only.includes(shape)) continue
  for (const [target, { run, shapes }] of Object.entries(TARGETS)) {
    if (shapes && !shapes.includes(shape)) continue
    const [small, large] = sizes.map((n) => {
      const text = make(n)
      const steps = prefixes(text, 'frame')
      run(steps.slice(0, 100), text)
      return { chars: text.length, ms: best(() => run(steps, text)) }
    })
    const row = {
      shape,
      target,
      chars: [small!.chars, large!.chars] as [number, number],
      ms: [+small!.ms.toFixed(1), +large!.ms.toFixed(1)] as [number, number],
      exponent: +(Math.log(large!.ms / small!.ms) / Math.log(4)).toFixed(2),
    }
    rows.push(row)
    console.log(
      `${shape.padEnd(10)} ${target.padEnd(16)} ${row.ms[0]} → ${row.ms[1]} ms  exponent ${row.exponent}`,
    )
  }
}

if (!process.argv.includes('--no-write')) {
  const version = (await Bun.file('../packages/flowdown/package.json').json()).version
  const machine = `${cpus()[0]?.model ?? 'unknown'}, ${process.platform}, bun ${Bun.version}`
  const md = [
    '# One block that grows',
    '',
    `flowdown ${version}, ${machine}, ${new Date().toISOString().slice(0, 10)}. From`,
    '[`src/growth.ts`](../src/growth.ts): each shape streamed at two sizes four times apart, 20',
    'characters an update; the exponent is 1 when an update costs the end of the block, 2 when it',
    'reads the whole block again.',
    '',
    '| Shape | Target | Characters | Whole stream | Exponent |',
    '| --- | --- | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${row.shape} | ${row.target} | ${row.chars[0]} → ${row.chars[1]} | ${row.ms[0]} → ${row.ms[1]} ms | ${row.exponent} |`,
    ),
    '',
  ].join('\n')
  await Bun.write(`results/${name}.md`, md)
  await Bun.write(`results/${name}.json`, `${JSON.stringify({ version, machine, rows }, null, 2)}\n`)
}
process.exit(0)
