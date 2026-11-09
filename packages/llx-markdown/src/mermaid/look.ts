/** The Mermaid configuration a diagram is drawn with, and the identity it is cached under. */
export interface MermaidLook {
  key: string
  config: Record<string, unknown>
}

/**
 * Mermaid's own themes are fixed palettes that match no page around them, so a diagram is drawn
 * with Mermaid's `base` theme fed from the renderer's tokens (`--llx-*`, `styles.css`), read on
 * the element the diagram sits in: a page that recolours the Markdown recolours its diagrams.
 *
 * Mermaid derives shades with a colour library that cannot read `oklch()`, `color-mix()` or a
 * system colour, so each token is resolved by the browser (a probe element inside the root) and
 * rasterized to sRGB hex on a 1×1 canvas. A "veil", the text colour at a few percent over the
 * ground, is composited there too, since Mermaid needs an opaque colour where the page uses alpha.
 */
export function resolveMermaidLook(root: HTMLElement): MermaidLook {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  root.append(probe)
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })

  const computed = (token: string) => {
    probe.style.color = `var(${token})`
    return getComputedStyle(probe).color
  }
  const rgbOf = (base: string, color: string, alpha: number): [number, number, number] => {
    if (!context) return [255, 255, 255]
    context.globalAlpha = 1
    context.fillStyle = base
    context.fillRect(0, 0, 1, 1)
    context.globalAlpha = alpha
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r = 255, g = 255, b = 255] = context.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  }
  /** `color` at `alpha` over the opaque `base`, as hex. */
  const over = (base: string, color: string, alpha = 1): string =>
    `#${rgbOf(base, color, alpha)
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`
  // The ground may carry alpha (a glass panel); it is laid once over what shows through it,
  // `--llx-bg-solid` (white unless the page says), and every veil below is mixed over that result.
  // Over white, a dark translucent ground came out light grey, and the nodes with it.
  const ground = over(computed('--llx-bg-solid, #ffffff'), computed('--llx-bg'))
  const [r, g, b] = rgbOf('#ffffff', ground, 1)
  const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
  const paint = (color: string, alpha = 1) => over(ground, color, alpha)
  const token = (name: string) => paint(computed(name))
  const fgColor = computed('--llx-fg')
  const veil = (alpha: number) => paint(fgColor, alpha)

  const bg = ground
  const fg = token('--llx-fg')
  const soft = token('--llx-fg-soft')
  const faint = token('--llx-fg-faint')
  const border = token('--llx-border')
  const strong = token('--llx-border-strong')
  const node = veil(0.06)
  const charts = Array.from({ length: 8 }, (_, index) => token(`--llx-chart-${index + 1}`))
  const fontFamily = getComputedStyle(root).fontFamily
  probe.remove()

  const themeVariables = {
    darkMode: dark,
    background: bg,
    fontFamily,
    fontSize: '13px',
    primaryColor: node,
    primaryTextColor: fg,
    // The fill already separates a node from the ground; the outline only has to hold its edge,
    // so it takes the ordinary border step rather than the strong one.
    primaryBorderColor: border,
    secondaryColor: veil(0.1),
    secondaryTextColor: fg,
    secondaryBorderColor: border,
    tertiaryColor: veil(0.03),
    tertiaryTextColor: fg,
    tertiaryBorderColor: border,
    lineColor: faint,
    textColor: fg,
    titleColor: fg,
    edgeLabelBackground: bg,
    clusterBkg: veil(0.03),
    clusterBorder: border,
    noteBkgColor: node,
    noteTextColor: fg,
    noteBorderColor: border,
    actorBkg: node,
    actorBorder: border,
    actorTextColor: fg,
    actorLineColor: border,
    signalColor: soft,
    signalTextColor: fg,
    labelBoxBkgColor: node,
    labelBoxBorderColor: border,
    labelTextColor: fg,
    loopTextColor: soft,
    activationBkgColor: veil(0.1),
    activationBorderColor: strong,
    sequenceNumberColor: bg,
    ...Object.fromEntries(charts.map((color, index) => [`pie${index + 1}`, color])),
    // Radar, treemap, mindmap and timeline use cScale, while git graphs use gitN. Leaving those
    // derived from neutral node fills gave data series indistinguishable grey colours.
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`cScale${i}`, charts[i % charts.length]]),
    ),
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`cScaleLabel${i}`, fg])),
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        `cScalePeer${i}`,
        paint(charts[i % charts.length]!, 0.16),
      ]),
    ),
    ...Object.fromEntries(charts.map((color, index) => [`git${index}`, color])),
    ...Object.fromEntries(charts.map((_, index) => [`gitBranchLabel${index}`, bg])),
    ...Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [`quadrant${i + 1}Fill`, veil(0.03 + i * 0.02)]),
    ),
    ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`quadrant${i + 1}TextFill`, soft])),
    quadrantPointFill: charts[0],
    quadrantPointTextFill: fg,
    quadrantXAxisTextFill: soft,
    quadrantYAxisTextFill: soft,
    radar: {
      axisColor: border,
      axisLabelFontSize: 13,
      axisStrokeWidth: 1,
      graticuleColor: border,
      graticuleOpacity: 0.15,
      graticuleStrokeWidth: 1,
      curveOpacity: 0.14,
      curveStrokeWidth: 2,
      legendBoxSize: 10,
      legendFontSize: 13,
    },
    pieStrokeColor: bg,
    pieOuterStrokeColor: border,
    pieTitleTextColor: fg,
    pieSectionTextColor: bg,
    pieLegendTextColor: soft,
    xyChart: {
      // Mermaid paints this as a plot-sized slab; transparent lets the page show through.
      backgroundColor: 'transparent',
      titleColor: fg,
      xAxisLabelColor: soft,
      xAxisTitleColor: soft,
      xAxisTickColor: border,
      xAxisLineColor: border,
      yAxisLabelColor: soft,
      yAxisTitleColor: soft,
      yAxisTickColor: border,
      yAxisLineColor: border,
      plotColorPalette: charts.join(','),
    },
  }
  const config = {
    theme: 'base',
    // SVG labels avoid HTML measurement frames whose temporary 2000px boxes can enter layout.
    // The same vector geometry works in a transcript, an embedded board and the canvas viewer.
    htmlLabels: false,
    themeVariables,
    flowchart: { htmlLabels: false, curve: 'basis', padding: 12, nodeSpacing: 36, rankSpacing: 44 },
    sequence: { mirrorActors: false, messageFontSize: 13, actorFontSize: 13, noteFontSize: 12 },
  }
  // Keyed by the resolved colours, not the theme name: a palette change repaints every diagram
  // even when "dark" stays "dark".
  return { key: JSON.stringify(themeVariables), config }
}
