/**
 * `bun src/charts.ts`: the comparison charts the README shows, drawn from the result files, never
 * typed in: results/latest.json (`bun run bench`), results/size.json (`bun run size`) and
 * results/install.json (`bun run deps`). Writes results/charts/compare.png: one light image on its
 * own white card, the same on a light page, a dark one and anywhere it is reposted. Drawn as SVG
 * and rasterized at twice the size by Playwright's Chromium
 * (`bunx playwright-core install chromium-headless-shell`).
 *
 * Two sections, so a time is never read against a size: streaming speed, every panel in
 * milliseconds, then weight, each panel naming its own unit. A panel is scaled to its own longest
 * bar, and the number beside a bar is the measurement.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const dir = join(import.meta.dir, '../results')
const size: Record<string, { atOnce: number }> = JSON.parse(
  readFileSync(join(dir, 'size.json'), 'utf8'),
)
const installed: Record<string, { packages: number }> = JSON.parse(
  readFileSync(join(dir, 'install.json'), 'utf8'),
)
const speed: {
  meta: { cpu: string; runtime: string; runs: number; passes?: number }
  rows: Array<{
    scenario: string
    pattern: string
    renderer: string
    totalMs: number
    timedOut: boolean
    drawnShare: number
  }>
} = JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'))

/** Every chart lists the libraries in this order, so a row means the same library everywhere. */
const LIBRARIES = [
  {
    label: 'flowdown',
    size: 'flowdown',
    install: 'flowdown',
    speed: 'flowdown',
    ours: true,
  },
  { label: 'Streamdown', size: 'streamdown', install: 'streamdown', speed: 'streamdown' },
  {
    label: 'react-markdown',
    size: 'react-markdown + remark-gfm',
    install: 'react-markdown',
    speed: 'react-markdown',
  },
  {
    label: 'markdown-to-jsx',
    size: 'markdown-to-jsx',
    install: 'markdown-to-jsx',
    speed: 'markdown-to-jsx',
  },
  {
    label: 'markstream',
    size: 'markstream-react',
    install: 'markstream-react',
    speed: 'markstream',
  },
  { label: 'marked-react', size: 'marked-react', install: 'marked-react', speed: 'marked-react' },
]

type Unit = 'ms' | 'kb' | 'count' | 'times'
interface Bar {
  value: number
  /** Drawn as a full, hatched bar: the renderer ran out of time before the reply ended. */
  stopped?: string
}
interface Panel {
  title: string
  note: string
  unit: Unit
  bars: Bar[]
}
interface Section {
  title: string
  note: string
  panels: Panel[]
}

const frameRow = (scenario: string, renderer: string) => {
  const row = speed.rows.find(
    (r) => r.scenario === scenario && r.pattern === 'frame' && r.renderer === renderer,
  )
  if (!row) throw new Error(`no ${scenario} result for ${renderer}`)
  return row
}

function speedPanel(title: string, note: string, scenario: string): Panel {
  return {
    title,
    note,
    unit: 'ms',
    bars: LIBRARIES.map(({ speed: name }) => {
      const row = frameRow(scenario, name)
      return row.timedOut
        ? { value: Number.NaN, stopped: `stopped at ${Math.round(row.drawnShare)}%` }
        : { value: row.totalMs }
    }),
  }
}

const SECTIONS: Section[] = [
  {
    title: 'Streaming speed',
    note: 'main-thread milliseconds to stream one reply, start to end · shorter is better',
    panels: [
      speedPanel('Chat answer', '5k characters', 'chat-5k'),
      speedPanel('Long answer', '20k characters', 'answer-20k'),
      speedPanel('Tables', '20k characters', 'table-20k'),
      speedPanel('Code', '50k characters', 'code-50k'),
      speedPanel('Very long answer', '100k characters', 'long-100k'),
      speedPanel('A thread', '30 replies on one page', 'thread-30'),
    ],
  },
  {
    title: 'Weight',
    note: 'what a project takes on · smaller is better',
    panels: [
      {
        title: 'Download size',
        note: 'KB of gzipped JavaScript loaded with the component',
        unit: 'kb',
        bars: LIBRARIES.map(({ size: name }) => ({ value: size[name]!.atOnce })),
      },
      {
        title: 'Packages installed',
        note: 'what `npm install` adds, the library included',
        unit: 'count',
        bars: LIBRARIES.map(({ install: name }) => ({ value: installed[name]!.packages })),
      },
      {
        title: 'Cost of a 4× longer reply',
        note: 'time for 40k over 10k · 4× is linear, 16× reparses it all',
        unit: 'times',
        bars: LIBRARIES.map(({ speed: name }) => ({
          value: frameRow('answer-40k', name).totalMs / frameRow('answer-10k', name).totalMs,
        })),
      },
    ],
  },
]

const theme = {
  page: '#ffffff',
  text: '#1f2328',
  muted: '#59636e',
  bar: '#d1d9e0',
  ours: '#6e56cf',
  rule: '#d1d9e0',
}

/** One unit to a panel, and milliseconds everywhere in the speed section: 37 ms reads against 2,773 ms. */
const format = (value: number, unit: Unit) => {
  // To a tenth, as size.md has it: a whole number would round a figure already rounded.
  if (unit === 'kb') return `${value.toFixed(1)} KB`
  if (unit === 'count') return `${value}`
  if (unit === 'times') return `${value.toFixed(1)}×`
  return `${Math.round(value).toLocaleString('en-US')} ms`
}
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const COLUMNS = 3
const PANEL_W = 372
const GAP_X = 42
const ROW_H = 26
const HEAD_H = 54
const GAP_Y = 30
const SECTION_H = 58
const SECTION_GAP = 26
const LABEL_W = 116
const VALUE_W = 76
/** The shortest bar drawn, so the fastest row is a bar and not a hairline beside a slow one. */
const MIN_BAR = 6
const PANEL_H = HEAD_H + LIBRARIES.length * ROW_H
const WIDTH = COLUMNS * PANEL_W + (COLUMNS - 1) * GAP_X
/** White space around the chart, inside the card. */
const PAD = 36
const CORNER = 16
/** Pixels to a unit: sharp on a high-density screen and when zoomed. */
const SCALE = 2

function draw() {
  const parts: string[] = []
  let top = 0
  for (const section of SECTIONS) {
    if (top > 0) top += SECTION_GAP
    parts.push(
      `<text x="0" y="${top + 16}" class="section">${escape(section.title)}</text>`,
      `<text x="0" y="${top + 35}" class="note">${escape(section.note)}</text>`,
      `<line x1="0" y1="${top + 46}" x2="${WIDTH}" y2="${top + 46}" stroke="${theme.rule}"/>`,
    )
    top += SECTION_H
    section.panels.forEach((panel, index) => {
      const x = (index % COLUMNS) * (PANEL_W + GAP_X)
      const y = top + Math.floor(index / COLUMNS) * (PANEL_H + GAP_Y)
      const longest = Math.max(...panel.bars.map((b) => (b.stopped ? 0 : b.value)))
      const track = PANEL_W - LABEL_W - VALUE_W
      parts.push(
        `<text x="${x}" y="${y + 18}" class="title">${escape(panel.title)}</text>`,
        `<text x="${x}" y="${y + 37}" class="note">${escape(panel.note)}</text>`,
      )
      panel.bars.forEach((bar, row) => {
        const ours = LIBRARIES[row]!.ours
        const rowTop = y + HEAD_H + row * ROW_H
        const mid = rowTop + ROW_H / 2
        const width = bar.stopped ? track : Math.max(MIN_BAR, (bar.value / longest) * track)
        const fill = bar.stopped ? 'url(#stopped)' : ours ? theme.ours : theme.bar
        parts.push(
          `<text x="${x + LABEL_W - 10}" y="${mid + 4}" text-anchor="end" class="${ours ? 'ours' : 'label'}">${LIBRARIES[row]!.label}</text>`,
          `<rect x="${x + LABEL_W}" y="${rowTop + 5}" width="${width.toFixed(1)}" height="${ROW_H - 10}" rx="3" fill="${fill}"/>`,
          bar.stopped
            ? `<text x="${x + LABEL_W + 8}" y="${mid + 4}" class="inside">${bar.stopped}</text>`
            : `<text x="${x + LABEL_W + width + 8}" y="${mid + 4}" class="${ours ? 'ours' : 'value'}">${format(bar.value, panel.unit)}</text>`,
        )
      })
    })
    const rows = Math.ceil(section.panels.length / COLUMNS)
    top += rows * PANEL_H + (rows - 1) * GAP_Y
  }
  const footY = top + 34
  const { cpu, runtime, runs, passes = 1 } = speed.meta
  const sampled =
    passes > 1 ? `median of ${passes} passes of ${runs} runs` : `median of ${runs} runs`
  parts.push(
    `<line x1="0" y1="${footY - 18}" x2="${WIDTH}" y2="${footY - 18}" stroke="${theme.rule}"/>`,
    `<text x="0" y="${footY}" class="note">Each panel has its own scale; the number beside a bar is the measurement. Every figure comes from a script in bench/.</text>`,
    `<text x="0" y="${footY + 18}" class="note">Speed: one update per animation frame, ${sampled}, ${escape(runtime)} with happy-dom on an ${escape(cpu)}.</text>`,
  )
  const width = WIDTH + PAD * 2
  const height = footY + 26 + PAD * 2
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<pattern id="stopped" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${theme.bar}"/><rect width="3" height="8" fill="${theme.muted}" opacity="0.35"/></pattern>
<style>
text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; fill: ${theme.text}; }
.section { font-size: 17px; font-weight: 700; }
.title { font-size: 15px; font-weight: 600; }
.note { font-size: 12px; fill: ${theme.muted}; }
.label, .value { font-size: 12.5px; }
.value { fill: ${theme.muted}; font-variant-numeric: tabular-nums; }
.ours { font-size: 12.5px; font-weight: 600; fill: ${theme.ours}; font-variant-numeric: tabular-nums; }
.inside { font-size: 11.5px; fill: ${theme.text}; }
</style>
</defs>
<rect width="${width}" height="${height}" rx="${CORNER}" fill="${theme.page}"/>
<g transform="translate(${PAD} ${PAD})">
${parts.join('\n')}
</g>
</svg>
`,
  }
}

const { svg, width, height } = draw()
const path = join(dir, 'charts', 'compare.png')
mkdirSync(join(dir, 'charts'), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: SCALE })
  await page.setContent(`<body style="margin:0">${svg}</body>`)
  // The card's rounded corners stay transparent, so it sits on any page colour.
  await page.locator('svg').screenshot({ path, omitBackground: true })
} finally {
  await browser.close()
}
console.log(`wrote results/charts/compare.png (${width * SCALE}×${height * SCALE})`)
