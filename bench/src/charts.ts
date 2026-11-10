/**
 * `bun src/charts.ts`: the comparison charts the README shows, drawn from the result files, never
 * typed in: results/size.json (`bun run size`) and results/latest.json (`bun run bench`). Writes
 * results/charts/compare-light.svg and compare-dark.svg, one for each GitHub theme.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dir, '../results')
const size: Record<string, { atOnce: number }> = JSON.parse(
  readFileSync(join(dir, 'size.json'), 'utf8'),
)
const speed: {
  meta: { cpu: string; runtime: string; runs: number }
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
  { label: 'llx-markdown', size: 'llx-markdown', speed: 'llx', ours: true },
  { label: 'Streamdown', size: 'streamdown', speed: 'streamdown' },
  { label: 'react-markdown', size: 'react-markdown + remark-gfm', speed: 'react-markdown' },
  { label: 'markdown-to-jsx', size: 'markdown-to-jsx', speed: 'markdown-to-jsx' },
  { label: 'markstream', size: 'markstream-react', speed: 'markstream' },
  { label: 'marked-react', size: 'marked-react', speed: 'marked-react' },
]

interface Bar {
  value: number
  /** Drawn as a full, hatched bar: the renderer ran out of time before the reply ended. */
  stopped?: string
}
interface Panel {
  title: string
  note: string
  unit: 'kb' | 'ms'
  bars: Bar[]
}

function speedPanel(title: string, scenario: string): Panel {
  return {
    title,
    note: 'main-thread time to stream it',
    unit: 'ms',
    bars: LIBRARIES.map(({ speed: name }) => {
      const row = speed.rows.find(
        (r) => r.scenario === scenario && r.pattern === 'frame' && r.renderer === name,
      )
      if (!row) throw new Error(`no ${scenario} result for ${name}`)
      return row.timedOut
        ? { value: Number.NaN, stopped: `stopped at ${Math.round(row.drawnShare)}%` }
        : { value: row.totalMs }
    }),
  }
}

const PANELS: Panel[] = [
  {
    title: 'Download size',
    note: 'loads with the component, gzip',
    unit: 'kb',
    bars: LIBRARIES.map(({ size: name }) => ({ value: size[name]!.atOnce })),
  },
  speedPanel('Chat answer, 5k characters', 'chat-5k'),
  speedPanel('Long answer, 20k', 'answer-20k'),
  speedPanel('Code, 50k', 'code-50k'),
  speedPanel('Very long answer, 100k', 'long-100k'),
  speedPanel('A thread of 30 replies', 'thread-30'),
]

const THEMES = {
  light: { text: '#1f2328', muted: '#59636e', bar: '#d1d9e0', ours: '#6e56cf', rule: '#d1d9e0' },
  dark: { text: '#e6edf3', muted: '#9198a1', bar: '#3d444d', ours: '#9d8cff', rule: '#3d444d' },
}

const format = (value: number, unit: Panel['unit']) => {
  if (unit === 'kb') return `${Math.round(value)} KB`
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`
  return `${Math.round(value)} ms`
}
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const COLUMNS = 3
const PANEL_W = 372
const GAP_X = 42
const ROW_H = 26
const HEAD_H = 54
const GAP_Y = 34
const LABEL_W = 116
const VALUE_W = 64
const PANEL_H = HEAD_H + LIBRARIES.length * ROW_H
const ROWS = Math.ceil(PANELS.length / COLUMNS)
const WIDTH = COLUMNS * PANEL_W + (COLUMNS - 1) * GAP_X
const FOOT_Y = ROWS * PANEL_H + (ROWS - 1) * GAP_Y + 30
const HEIGHT = FOOT_Y + 8

function draw(theme: (typeof THEMES)[keyof typeof THEMES]) {
  const parts: string[] = []
  PANELS.forEach((panel, index) => {
    const x = (index % COLUMNS) * (PANEL_W + GAP_X)
    const y = Math.floor(index / COLUMNS) * (PANEL_H + GAP_Y)
    const longest = Math.max(...panel.bars.map((b) => (b.stopped ? 0 : b.value)))
    const track = PANEL_W - LABEL_W - VALUE_W
    parts.push(
      `<text x="${x}" y="${y + 18}" class="title">${escape(panel.title)}</text>`,
      `<text x="${x}" y="${y + 37}" class="note">${escape(panel.note)}, lower is better</text>`,
    )
    panel.bars.forEach((bar, row) => {
      const ours = LIBRARIES[row]!.ours
      const top = y + HEAD_H + row * ROW_H
      const mid = top + ROW_H / 2
      const width = bar.stopped ? track : Math.max(2, (bar.value / longest) * track)
      const fill = bar.stopped ? 'url(#stopped)' : ours ? theme.ours : theme.bar
      parts.push(
        `<text x="${x + LABEL_W - 10}" y="${mid + 4}" text-anchor="end" class="${ours ? 'ours' : 'label'}">${LIBRARIES[row]!.label}</text>`,
        `<rect x="${x + LABEL_W}" y="${top + 5}" width="${width.toFixed(1)}" height="${ROW_H - 10}" rx="3" fill="${fill}"/>`,
        bar.stopped
          ? `<text x="${x + LABEL_W + 8}" y="${mid + 4}" class="inside">${bar.stopped}</text>`
          : `<text x="${x + LABEL_W + width + 8}" y="${mid + 4}" class="${ours ? 'ours' : 'value'}">${format(bar.value, panel.unit)}</text>`,
      )
    })
  })
  const { cpu, runtime, runs } = speed.meta
  parts.push(
    `<line x1="0" y1="${FOOT_Y - 18}" x2="${WIDTH}" y2="${FOOT_Y - 18}" stroke="${theme.rule}"/>`,
    `<text x="0" y="${FOOT_Y}" class="note">Speed: one update per animation frame, median of ${runs} runs, ${escape(runtime)} with happy-dom on an ${escape(cpu)}. Every figure comes from bench/ in this repository.</text>`,
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="llx-markdown compared with five React Markdown renderers on download size and streaming speed">
<defs>
<pattern id="stopped" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${theme.bar}"/><rect width="3" height="8" fill="${theme.muted}" opacity="0.35"/></pattern>
<style>
text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; fill: ${theme.text}; }
.title { font-size: 15px; font-weight: 600; }
.note { font-size: 12px; fill: ${theme.muted}; }
.label, .value { font-size: 12.5px; }
.value { fill: ${theme.muted}; font-variant-numeric: tabular-nums; }
.ours { font-size: 12.5px; font-weight: 600; fill: ${theme.ours}; font-variant-numeric: tabular-nums; }
.inside { font-size: 11.5px; fill: ${theme.text}; }
</style>
</defs>
${parts.join('\n')}
</svg>
`
}

mkdirSync(join(dir, 'charts'), { recursive: true })
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(join(dir, 'charts', `compare-${name}.svg`), draw(theme))
}
console.log(`wrote results/charts/compare-light.svg and compare-dark.svg (${WIDTH}×${HEIGHT})`)
