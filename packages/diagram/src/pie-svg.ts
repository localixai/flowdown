/**
 * A pie chart as a ring: a terminal draws a pie's slices as bars (a circle in cells is a blot), but
 * a page can draw the circle, so it does, with the same slices, shares and order: a ring of them
 * with a little air between, the total in its middle, and a legend beside it with each slice's
 * share (and value, with `showData`). No border separates the slices, so the ring sits on a light
 * or a dark page alike.
 */
import { formatNumber, shares } from './terminal/chart'
import { parsePie } from './terminal/pie'
import { diagramLines } from './terminal/text'

/** Slice colours, as classes a page may set (`fd-diagram-c0` …) and the colour each has by default. */
export const PALETTE = [
  '#3e63dd',
  '#f76b15',
  '#30a46c',
  '#e5484d',
  '#8e4ec6',
  '#0090ff',
  '#e2a336',
  '#d6409f',
  '#12a594',
  '#8d8d86',
]

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escape = (text: string): string => text.replace(/[&<>"]/g, (char) => ESCAPES[char]!)
const n = (value: number): string => String(Math.round(value * 100) / 100)

/** The pie's SVG; null when it reads as no pie; undefined when the source is not a pie at all. */
export function pieSVG(source: string, title: string): string | null | undefined {
  const lines = diagramLines(source)
  if (!/^pie\b/i.test(lines[0] ?? '')) return undefined
  const pie = parsePie(lines)
  if (!pie) return null
  const values = pie.slices.map((slice) => Math.max(0, slice.value))
  const total = values.reduce((sum, value) => sum + value, 0)
  const parts = shares(values)
  const radius = 92
  const inner = radius * 0.62
  const top = pie.title ? 44 : 10
  const cx = 10 + radius
  const cy = top + radius
  const out: string[] = []
  const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  if (pie.title)
    out.push(`<text x="10" y="22" font-weight="600" font-size="15">${escape(pie.title)}</text>`)

  // Each slice a band of the ring, a degree short at each end: the gap is what parts them.
  const gap = pie.slices.filter((_, at) => values[at]! > 0).length > 1 ? 0.018 : 0
  let angle = -Math.PI / 2
  pie.slices.forEach((slice, at) => {
    const value = values[at]!
    if (total <= 0 || value <= 0) return
    const sweep = (value / total) * Math.PI * 2
    const colour = PALETTE[at % PALETTE.length]!
    const fill = ` class="fd-diagram-c${at % PALETTE.length}" fill="${colour}"`
    const label = `<title>${escape(slice.label)}: ${formatNumber(slice.value)}</title>`
    if (sweep >= Math.PI * 2 - 1e-9) {
      out.push(
        `<path d="M${cx - radius} ${cy}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0ZM${cx - inner} ${cy}a${n(inner)} ${n(inner)} 0 1 1 ${n(inner * 2)} 0a${n(inner)} ${n(inner)} 0 1 1 ${n(-inner * 2)} 0Z" fill-rule="evenodd"${fill}>${label}</path>`,
      )
    } else {
      const from = angle + Math.min(gap, sweep / 4)
      const to = angle + sweep - Math.min(gap, sweep / 4)
      const large = to - from > Math.PI ? 1 : 0
      const point = (r: number, a: number) =>
        `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`
      out.push(
        `<path d="M${point(radius, from)}A${radius} ${radius} 0 ${large} 1 ${point(radius, to)}L${point(inner, to)}A${n(inner)} ${n(inner)} 0 ${large} 0 ${point(inner, from)}Z"${fill}>${label}</path>`,
      )
    }
    angle += sweep
  })
  out.push(
    `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="22" font-weight="600">${escape(formatNumber(total))}</text>`,
  )
  out.push(
    `<text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="11" fill-opacity="0.55">total</text>`,
  )

  // The legend: a swatch, the label, the share, and the value with showData.
  const legendX = cx + radius + 32
  const rowHeight = 24
  const legendTop = cy - (pie.slices.length * rowHeight) / 2 + 6
  let widest = 0
  pie.slices.forEach((slice, at) => {
    const y = legendTop + at * rowHeight
    const share = `${(parts[at]! * 100).toFixed(1)}%`
    const data = pie.showData ? `  ${formatNumber(slice.value)}` : ''
    const text = `${slice.label}  ${share}${data}`
    widest = Math.max(widest, text.length)
    out.push(
      `<rect x="${legendX}" y="${n(y - 10)}" width="10" height="10" rx="3" class="fd-diagram-c${at % PALETTE.length}" fill="${PALETTE[at % PALETTE.length]}"/>`,
    )
    out.push(
      `<text x="${legendX + 18}" y="${n(y)}" font-size="13">${escape(slice.label)}<tspan dx="6" fill-opacity="0.55">${share}${escape(data)}</tspan></text>`,
    )
  })
  const width = legendX + 18 + widest * 7 + 16
  const height = Math.max(cy + radius + 12, legendTop + pie.slices.length * rowHeight)
  const name = title || pie.title
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" role="img"${name ? ` aria-label="${escape(name)}"` : ''} class="fd-diagram" fill="currentColor" font-family="${SANS}">` +
    out.join('') +
    '</svg>'
  )
}
