/**
 * `@localix-ai/flowdown/tui`: Markdown as the rows of a terminal.
 *
 *     import { renderToAnsi } from '@localix-ai/flowdown/tui'
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
import { flowdownDialect } from '../core/remark-answer-blocks'
import { DIAGRAM_FENCE_LANGUAGE, TREE_FENCE_LANGUAGE } from '../dialect'
import { createDocument, type MarkdownBlock } from '../document'
import {
  createCutter,
  createFenceMemory,
  createLineColourer,
  growingFence,
  type GrowingFence,
} from '../document/fence'
import { createListReader } from '../document/list'
import { createQuoteReader } from '../document/quote'
import { TABLE_ROWS, tableRows, type TableRows } from '../document/table'
import { parse } from '../engine'
import type { Extension, References } from '../engine/types'
import { codeRows, codeRowsOfHtml, createCodeDrawer, type Highlighter } from './code'
import {
  createRowMemo,
  DEFAULT_LABELS,
  drawBlock,
  drawCodeRows,
  drawFenceTitle,
  lastFence,
  type DiagramDrawer,
  MIN_WIDTH,
  tableCells,
  turnRowMemo,
  type TerminalLabels,
} from './render'
import { createTableMemo, drawTable } from './table'
import { toAnsi, type Line } from './style'

export { toAnsi, lineText, sgr, type Colour, type Line, type Span, type Style } from './style'
export type { Highlighter } from './code'
export { printable } from './printable'
export { width as textWidth } from './width'
export { lineWidth } from './wrap'
export { DEFAULT_LABELS, MIN_WIDTH, type DiagramDrawer, type TerminalLabels } from './render'
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
   * Colour fenced code: `@localix-ai/flowdown/highlight`, or any function that returns highlight.js's
   * HTML. Off by default; a language it does not know is drawn in the one colour of code.
   */
  highlight?: Highlighter | null
  /**
   * Read `$…$`, `$$…$$` and a `math` fence as formulas and write them in Unicode: `x^2` as `x²`,
   * `\frac{a}{b}` as `a/b`. On by default; `false` leaves them as the text they were written as.
   */
  math?: boolean
  /**
   * Draw ```` ```mermaid ```` diagrams once their fence is closed: `drawDiagram` of
   * `@localix-ai/flowdown/tui/diagram` draws flowcharts and sequence diagrams in boxes and lines,
   * or as an outline when the picture would not fit. Off by default: a diagram is its source under
   * a `Diagram` label.
   */
  diagrams?: DiagramDrawer | null
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
  const diagrams = options.diagrams ?? null
  const extensions = [flowdownDialect, ...(math ? [mathSyntax] : []), ...(options.extensions ?? [])]
  const highlight = options.highlight ?? null
  const code = createCodeDrawer(highlight)
  const doc = createDocument({ refs: true })
  let columns = options.width ?? DEFAULT_WIDTH
  let drawn = new WeakMap<MarkdownBlock, { closer: string; rows: Line[]; pieced: boolean }>()

  // A block that is one fence still being written (an agent writing a file) is read without its
  // block being parsed, and drawn in the pieces `document/fence.ts` cuts: a piece that is complete
  // keeps its rows, so a token costs the last piece, not the file.
  const memory = createFenceMemory()
  const cut = createCutter()
  const colour = createLineColourer()
  /** The pieces drawn last: `text` is a piece's code, without the line break a complete one ends in. */
  let pieces: Array<{
    text: string
    run: number
    key: string
    html?: string | undefined
    code: Line[]
    rows: Line[]
  }> = []
  const fenceRows = (fence: GrowingFence): Line[] => {
    // A fence's code is drawn without its last line breaks, as `drawBlock` draws it.
    let end = fence.body.length
    while (end > 0 && fence.body.charCodeAt(end - 1) === 10) end -= 1
    const body = end === fence.body.length ? fence.body : fence.body.slice(0, end)
    // A highlighter that reads a line at a time colours each line once, from the state above it.
    const reader = fence.language && highlight?.lines ? highlight.lines(fence.language) : null
    const coloured = reader && fence.language ? colour(body, reader, fence.language) : null
    const { parts, run } = coloured ?? cut(body)
    const key = `${fence.language ?? ''}\u0000${columns}`
    const kept = pieces
    pieces = parts.map((part, index) => {
      const was = kept[index]
      const done = index < parts.length - 1
      const text = done ? part.slice(0, -1) : part
      const html = coloured
        ? done
          ? coloured.html[index]!.slice(0, -1)
          : coloured.html[index]
        : undefined
      // A complete piece of the same run has the same code; the last one is compared, so the
      // piece that a line break has just completed keeps the rows it had as the last.
      if (
        was !== undefined &&
        was.key === key &&
        (html !== undefined
          ? was.html === html
          : (done && index < kept.length - 1 && was.run === run) || was.text === text)
      )
        return was.run === run ? was : { ...was, run }
      const lines =
        html !== undefined && fence.language
          ? codeRowsOfHtml(text, fence.language, html)
          : codeRows(text, fence.language, highlight)
      return { text, run, key, html, code: lines, rows: drawCodeRows(lines, columns) }
    })
    // The drawer holds them too: a fence it draws next with this code (closed, but still the
    // end of the reply) is not highlighted again, and one of one piece is drawn whole from them.
    if (fence.language) code.keep(pieces, fence.language)
    const out = fence.title ? drawFenceTitle(fence.title, columns, labels) : []
    for (const piece of pieces) for (const row of piece.rows) out.push(row)
    return out
  }
  // The block that grows is drawn again on every token: its parts that did not change (the items
  // of a list above the last, the paragraphs of a quote) keep their rows, by text and place.
  let memo = createRowMemo()
  /** A number for each set of link definitions: a part is kept with the definitions it was read with. */
  const scopes = new WeakMap<object, string>()
  let scopeCount = 0
  const scopeOf = (refs: object | undefined): string => {
    if (refs === undefined) return ''
    let id = scopes.get(refs)
    if (id === undefined) {
      id = String(++scopeCount)
      scopes.set(refs, id)
    }
    return id
  }

  // A table that grows a row at a time (an agent printing results) is read in the pieces of rows
  // `document/table.ts` cuts, each under the table's header: a piece that is complete is parsed
  // once. A terminal lays a table out by its widest cells, so the rows are measured whole; a row
  // is laid out again only when the widths of the columns changed.
  const tableMemo = createTableMemo()
  type Piece = NonNullable<ReturnType<typeof tableCells>>
  let read = new Map<string, Piece>()
  let readBefore = new Map<string, Piece>()
  const tableBlock = (table: TableRows, refs: References | undefined): Line[] | null => {
    const scope = scopeOf(refs)
    const rows: Line[][] = []
    let aligns: Piece['aligns'] = []
    for (let at = 0; at < table.rows.length; at += TABLE_ROWS) {
      const own = table.rows.slice(at, at + TABLE_ROWS)
      const text = table.head + own.join('\n')
      const key = `${scope}\u0000${text}`
      const piece =
        read.get(key) ??
        readBefore.get(key) ??
        tableCells(parse(text, { extensions, refs }), own.length)
      if (piece === null) return null
      read.set(key, piece)
      if (at === 0) {
        rows.push(piece.head)
        aligns = piece.aligns
      }
      for (const row of piece.body) rows.push(row)
    }
    return drawTable(rows, aligns, Math.max(MIN_WIDTH, Math.floor(columns)), [], [], tableMemo)
  }

  const lists = createListReader()
  const quotes = createQuoteReader()
  /** The page's extensions may read a list whole: a long list is then parsed whole. */
  const ownList = (options.extensions?.length ?? 0) > 0

  /** The languages an extension reads fences of itself: such a fence is drawn by its block. */
  const ruled = new Set(extensions.flatMap((extension) => Object.keys(extension.fences ?? {})))

  /** Whether a fence is drawn as its code: a diagram, a file tree or a formula is drawn by its block. */
  const asCode = (fence: GrowingFence | null): fence is GrowingFence =>
    fence !== null &&
    fence.language !== DIAGRAM_FENCE_LANGUAGE &&
    fence.language !== TREE_FENCE_LANGUAGE &&
    !(math && fence.language === 'math') &&
    !ruled.has(fence.language ?? '') &&
    // A language or a title the parser would read escapes or references in is read by the parser.
    !/[\\&]/.test(fence.language ?? '') &&
    !/[\\&]/.test(fence.title)

  return {
    render(text, { streaming = false, width } = {}) {
      if (width !== undefined && width !== columns) {
        columns = width
        drawn = new WeakMap()
        memo = createRowMemo()
      }
      const state = doc.update(text, { streaming, math })
      const last = state.blocks.length - 1
      const out: Line[] = []
      // Whether the block that grows was drawn now: the caches for it are turned only then, so a
      // token that left it as it was (a row held back until its line ends) keeps them.
      let redrawn = false
      state.blocks.forEach((block, index) => {
        const closer = index === last ? state.closer : ''
        // The end of a reply still arriving: its last fence may gain code with the next token.
        const growing = streaming && index === last
        let made = drawn.get(block)
        // A fence drawn in pieces is drawn whole once nothing more can come to it.
        if (made === undefined || made.closer !== closer || (made.pieced && !growing)) {
          if (growing) redrawn = true
          const fence = growing && state.growing ? growingFence(block.source, closer, memory) : null
          const source = block.source + closer
          const table = growing && !closer ? tableRows(source) : null
          const tabled = table ? tableBlock(table, block.refs) : null
          if (asCode(fence)) made = { closer, rows: fenceRows(fence), pieced: true }
          else if (tabled) made = { closer, rows: tabled, pieced: true }
          else {
            const parsed = (piece: string) => parse(piece, { extensions, refs: block.refs })
            // A long list is read a piece of items at a time: a token reads the last piece.
            const scope = scopeOf(block.refs)
            const tree =
              (ownList
                ? null
                : (lists.read(block.source, closer, parsed, scope) ??
                  quotes.read(block.source, closer, parsed, scope))) ?? parsed(source)
            const rows = drawBlock(
              tree,
              columns,
              labels,
              code,
              growing,
              growing ? { source, memo, scope: scopeOf(block.refs) } : null,
              diagrams,
            )
            // A diagram still being written is its source: drawn again once its block is not the
            // end of the reply, it is its picture.
            const diagram =
              growing && diagrams !== null && lastFence(tree)?.lang === DIAGRAM_FENCE_LANGUAGE
            made = { closer, rows, pieced: code.pieced() || diagram }
          }
          drawn.set(block, made)
        }
        if (made.rows.length === 0) return
        // A blank row between blocks, as between the blocks of one.
        if (out.length > 0) out.push([])
        for (const row of made.rows) out.push(row)
      })
      code.turn()
      if (redrawn) {
        turnRowMemo(memo)
        readBefore = read
        read = new Map()
      }
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
