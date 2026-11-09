/**
 * Replies the way an agent writes them, generated from a seed: prose with inline marks, headings,
 * lists, code, tables, callouts, the dialect's forms, file trees and math. Every scenario is a
 * pure function of its seed, so its text, and its hash, never change between runs.
 */
import { type Random, seeded } from './random'

const WORDS =
  'the a migration table index query cache request worker session token reply stream block parser renderer layout value config build release test agent model tool file branch commit review error retry timeout queue lock write read'.split(
    ' ',
  )

const sentence = (r: Random) => {
  const words = Array.from({ length: r.int(6, 18) }, () => r.pick(WORDS))
  const at = r.int(0, words.length - 1)
  const mark = r.int(0, 9)
  if (mark === 0) words[at] = `**${words[at]}**`
  else if (mark === 1) words[at] = `\`${words[at]}()\``
  else if (mark === 2) words[at] = `[${words[at]}](https://example.com/${words[at]})`
  else if (mark === 3) words[at] = `_${words[at]}_`
  else if (mark === 4) words[at] = `$${r.int(2, 99)}`
  const text = words.join(' ')
  return `${text[0]?.toUpperCase()}${text.slice(1)}.`
}

const paragraph = (r: Random) => Array.from({ length: r.int(2, 5) }, () => sentence(r)).join(' ')

const list = (r: Random, ordered: boolean) =>
  Array.from(
    { length: r.int(3, 7) },
    (_, i) => `${ordered ? `${i + 1}.` : '-'} ${sentence(r)}`,
  ).join('\n')

const code = (r: Random, lines = r.int(6, 30)) => {
  const language = r.pick(['ts', 'py', 'sh', 'json', 'rust'])
  const body = Array.from({ length: lines }, (_, i) => {
    const name = r.pick(WORDS)
    return `${'  '.repeat(r.int(0, 3))}const ${name}${i} = await ${r.pick(WORDS)}(${name}, ${r.int(0, 999)}) // ${r.pick(WORDS)}`
  })
  return `\`\`\`${language}\n${body.join('\n')}\n\`\`\``
}

const table = (r: Random, rows = r.int(3, 8)) => {
  const head = '| Name | Status | Time | Note |\n| --- | --- | --- | --- |'
  const body = Array.from(
    { length: rows },
    () =>
      `| ${r.pick(WORDS)} | ${r.pick(['ok', 'failed', 'skipped'])} | ${r.int(1, 900)} ms | ${sentence(r)} |`,
  )
  return [head, ...body].join('\n')
}

const callout = (r: Random) =>
  `> [!${r.pick(['NOTE', 'TIP', 'WARNING', 'IMPORTANT', 'CAUTION'])}]\n> ${sentence(r)}\n> ${sentence(r)}`

const steps = (r: Random) =>
  `> [!STEPS]\n${Array.from(
    { length: r.int(3, 5) },
    (_, i) => `${i + 1}. **${sentence(r).slice(0, 30)}**\n   *Day ${i + 1}*\n   ${sentence(r)}`,
  ).join('\n')}`

const tabs = (r: Random) =>
  `> [!TABS]\n${['macOS', 'Linux', 'Windows']
    .map((label) => `#### ${label}\n${code(r, r.int(2, 5))}`)
    .join('\n')}`

const stats = (r: Random) =>
  `> [!STATS]\n${Array.from({ length: 3 }, () => `- **${r.int(2, 99)}%** ${sentence(r).slice(0, 40)}`).join('\n')}`

const verdicts = (r: Random) => `> [!PROS]\n${list(r, false)}\n\n> [!CONS]\n${list(r, false)}`

const tree = (r: Random) =>
  `\`\`\`tree\n${Array.from({ length: r.int(4, 10) }, () => `${'  '.repeat(r.int(0, 3))}${r.pick(WORDS)}.${r.pick(['ts', 'md', 'json'])}`).join('\n')}\n\`\`\``

const math = (r: Random) =>
  `$$\n\\sum_{i=1}^{${r.int(2, 9)}} x_i^2 = \\frac{${r.int(1, 9)}}{${r.int(2, 9)}}\n$$`

type Part = (r: Random) => string
const MIXED: Part[] = [
  paragraph,
  paragraph,
  paragraph,
  (r) => list(r, false),
  (r) => list(r, true),
  code,
  table,
  callout,
  (r) => `## ${sentence(r).slice(0, 40)}`,
  (r) => `### ${sentence(r).slice(0, 30)}`,
]
const FORMS: Part[] = [
  paragraph,
  steps,
  tabs,
  stats,
  verdicts,
  callout,
  tree,
  (r) => `## ${sentence(r).slice(0, 40)}`,
]
const PROSE: Part[] = [
  paragraph,
  paragraph,
  (r) => list(r, false),
  (r) => `## ${sentence(r).slice(0, 40)}`,
]

/** Blocks from `parts` until the reply reaches `size` characters. */
function reply(seed: number, size: number, parts: readonly Part[]): string {
  const r = seeded(seed)
  const blocks = [`# ${sentence(r).slice(0, 40)}`]
  let length = blocks[0]!.length
  while (length < size) {
    const block = r.pick(parts)(r)
    blocks.push(block)
    length += block.length + 2
  }
  return blocks.join('\n\n')
}

export interface Scenario {
  name: string
  /** What the scenario stands for, for the README. */
  about: string
  /** Replies already finished above the one streaming, as in a long conversation. */
  history?: string[]
  text: string
}

export function scenarios(): Scenario[] {
  return [
    {
      name: 'chat-5k',
      about: 'A short chat answer: prose and lists.',
      text: reply(1, 5_000, PROSE),
    },
    {
      name: 'answer-20k',
      about: 'A typical agent answer: prose, lists, code, tables, callouts.',
      text: reply(2, 20_000, MIXED),
    },
    {
      name: 'forms-20k',
      about: 'Dense dialect: steps, tabs, stats, pros and cons, trees.',
      text: reply(3, 20_000, FORMS),
    },
    {
      name: 'math-20k',
      about: 'Prose with formulas and literal dollars.',
      text: reply(4, 20_000, [...MIXED, math, math]),
    },
    {
      name: 'code-50k',
      about: 'An agent writing a file: one code fence that keeps growing.',
      text: `Here is the file:\n\n${code(seeded(5), 900)}\n\nDone.`,
    },
    {
      name: 'table-20k',
      about: 'One table that keeps growing: a single block reparsed on every token.',
      text: `Results:\n\n${table(seeded(6), 160)}`,
    },
    { name: 'long-100k', about: 'A long report.', text: reply(7, 100_000, MIXED) },
    {
      name: 'crlf-20k',
      about: 'Windows line endings, which some models and proxies send.',
      text: reply(8, 20_000, MIXED).replaceAll('\n', '\r\n'),
    },
    {
      name: 'footnotes-20k',
      about: 'A reply with footnotes: definitions resolve across blocks.',
      text: `${reply(9, 20_000, MIXED)}\n\nSee the source.[^1]\n\n[^1]: The reference.`,
    },
    {
      name: 'thread-30',
      about: 'Thirty finished replies above the one streaming, all on the page.',
      history: Array.from({ length: 30 }, (_, i) => reply(100 + i, 3_000, MIXED)),
      text: reply(10, 10_000, MIXED),
    },
  ]
}

/**
 * The same kind of reply at two sizes, four times apart. A renderer whose whole stream costs work
 * in proportion to the reply's length takes 4× as long on the larger one; one that reparses the
 * whole reply on every token takes about 16×.
 */
export function scaling(): [Scenario, Scenario] {
  return [
    { name: 'answer-10k', about: 'Scaling, small.', text: reply(2, 10_000, MIXED) },
    { name: 'answer-40k', about: 'Scaling, four times larger.', text: reply(2, 40_000, MIXED) },
  ]
}
