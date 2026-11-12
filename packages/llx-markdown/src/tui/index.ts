/**
 * `llx-markdown/tui`: Markdown as the rows of a terminal.
 *
 *     import { renderToAnsi } from 'llx-markdown/tui'
 *
 *     process.stdout.write(renderToAnsi(reply, { width: process.stdout.columns }) + '\n')
 *
 * The same text every other target reads, parsed by the same parser with the same dialect, and
 * drawn in a terminal's terms: words wrapped to the width by the columns they take, tables in
 * columns, a callout behind a coloured bar, steps down a numbered rail. No row is wider than the
 * width, and nothing a reply holds reaches the terminal as an instruction to it (`printable.ts`).
 *
 * A reply still arriving is drawn with a view, which keeps what it drew: each token costs the
 * block it lands in, and the rows of every block before it are the very same objects.
 *
 *     const view = createTerminalView({ width: 80 })
 *     for await (const text of reply) draw(view.render(text, { streaming: true }))
 *     draw(view.render(text))
 *
 * The rows are plain values (`Line`, a list of `{ text, style }`): `toAnsi` writes them for a
 * terminal, and a TUI library with a screen of its own reads them as they are.
 */
import { mathSyntax } from '../core/math-syntax'
import { llxDialect } from '../core/remark-answer-blocks'
import { createDocument, type MarkdownBlock } from '../document'
import { parse } from '../engine'
import type { Extension } from '../engine/types'
import { createCodeDrawer, type Highlighter } from './code'
import { DEFAULT_LABELS, drawBlock, type TerminalLabels } from './render'
import { toAnsi, type Line } from './style'

export { toAnsi, lineText, sgr, type Colour, type Line, type Span, type Style } from './style'
export type { Highlighter } from './code'
export { printable } from './printable'
export { width as textWidth } from './width'
export { lineWidth } from './wrap'
export { DEFAULT_LABELS, MIN_WIDTH, type TerminalLabels } from './render'
export type { Extension, Node } from '../engine/types'

/** The words the renderer adds, any of them replaced. */
export type TerminalLabelOverrides = Partial<Omit<TerminalLabels, 'callouts'>> & {
  callouts?: Partial<TerminalLabels['callouts']>
}

export interface TerminalOptions {
  /** The columns of the terminal; 80 when not given, and never under 8. */
  width?: number
  /** Your own syntax, after the dialect's (`Extension`). A node the renderer does not know is drawn as its text. */
  extensions?: Extension[]
  /** The words the renderer adds (callout names), for a terminal in another language. */
  labels?: TerminalLabelOverrides
  /**
   * Colour fenced code: `llx-markdown/highlight`, or any function that returns highlight.js's
   * HTML. Off by default; a language it does not know is drawn in the one colour of code.
   */
  highlight?: Highlighter | null
  /**
   * Read `$…$`, `$$…$$` and a `math` fence as formulas and write them in Unicode: `x^2` as `x²`,
   * `\frac{a}{b}` as `a/b`. On by default; `false` leaves them as the text they were written as.
   */
  math?: boolean
}

export interface RenderOptions {
  /** The text is a reply still arriving: its unfinished end is completed. */
  streaming?: boolean
  /** The terminal was resized: draw for this width from now on. */
  width?: number
}

export interface TerminalView {
  /**
   * The rows for `text`. The rows of a block that did not change are the same objects as at the
   * last render: a screen that compares by identity repaints only what is new.
   */
  render(text: string, options?: RenderOptions): Line[]
}

const DEFAULT_WIDTH = 80

/** One text drawn more than once: a reply while it streams. */
export function createTerminalView(options: TerminalOptions = {}): TerminalView {
  const labels: TerminalLabels = {
    ...DEFAULT_LABELS,
    ...options.labels,
    callouts: { ...DEFAULT_LABELS.callouts, ...options.labels?.callouts },
  }
  const math = options.math ?? true
  const extensions = [llxDialect, ...(math ? [mathSyntax] : []), ...(options.extensions ?? [])]
  const code = createCodeDrawer(options.highlight ?? null)
  const doc = createDocument()
  let columns = options.width ?? DEFAULT_WIDTH
  let drawn = new WeakMap<MarkdownBlock, { closer: string; rows: Line[]; pieced: boolean }>()
  return {
    render(text, { streaming = false, width } = {}) {
      if (width !== undefined && width !== columns) {
        columns = width
        drawn = new WeakMap()
      }
      const state = doc.update(text, { streaming, math })
      const last = state.blocks.length - 1
      const out: Line[] = []
      state.blocks.forEach((block, index) => {
        const closer = index === last ? state.closer : ''
        // The end of a reply still arriving: its last fence may gain code with the next token.
        const growing = streaming && index === last
        let made = drawn.get(block)
        // A fence drawn in pieces is drawn whole once nothing more can come to it.
        if (made === undefined || made.closer !== closer || (made.pieced && !growing)) {
          const rows = drawBlock(
            parse(block.source + closer, { extensions }),
            columns,
            labels,
            code,
            growing,
          )
          made = { closer, rows, pieced: code.pieced() }
          drawn.set(block, made)
        }
        if (made.rows.length === 0) return
        // A blank row between blocks, as between the blocks of one.
        if (out.length > 0) out.push([])
        for (const row of made.rows) out.push(row)
      })
      code.turn()
      return out
    },
  }
}

/** `markdown` as terminal rows. */
export function renderToLines(
  markdown: string,
  options: TerminalOptions & RenderOptions = {},
): Line[] {
  return createTerminalView(options).render(markdown, { streaming: options.streaming ?? false })
}

/**
 * `markdown` as text for a terminal, rows parted by `\n`. `color: false` leaves the escape
 * sequences out: for a pipe, a file, a terminal that asked for none (`NO_COLOR`).
 */
export function renderToAnsi(
  markdown: string,
  options: TerminalOptions & RenderOptions & { color?: boolean } = {},
): string {
  return toAnsi(renderToLines(markdown, options), options.color ?? true)
}
