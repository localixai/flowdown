/**
 * A parsed block as terminal rows. The tree is the one every target reads; what the dialect
 * marked on it (`core/forms.ts`) is drawn here in a terminal's own terms: a callout is a coloured
 * bar, steps a numbered rail, tabs one under another, each under its label, a file tree the
 * branches `tree` draws, figures a row of numbers over a row of what they count.
 *
 * A form this file does not know is drawn as the Markdown it still is: a list, a quote.
 */
import { parseFileTree } from '../core/file-tree-parse'
import { formOf, type Form } from '../core/forms'
import { DIAGRAM_FENCE_LANGUAGE, TREE_FENCE_LANGUAGE, type CalloutKind } from '../dialect'
import type { Node } from '../engine/types'
import { createCodeDrawer, type CodeDrawer } from './code'
import { formulaRows } from './formula'
import { mathRows, mathText } from './math'
import { printable } from './printable'
import {
  BOLD,
  CODE,
  DIM,
  DONE,
  FAILED,
  MATH,
  merged,
  patch,
  PLAIN,
  sgr,
  WAITING,
  type Line,
  type Span,
  type Style,
} from './style'
import { drawTable } from './table'
import { fit, lineWidth, NO_BREAK, span, untabbed, wrap } from './wrap'
import { width as columnsOf } from './width'

/**
 * What draws a Mermaid diagram's source as rows no wider than `columns`, or null to show the
 * source: `drawDiagram` of `@localix-ai/flowdown/tui/diagram`, or a drawer of your own.
 */
export type DiagramDrawer = (source: string, columns: number) => Line[] | null

/** The words the renderer adds, for a terminal in another language. */
export interface TerminalLabels {
  callouts: Record<CalloutKind, string>
  /** What a `[!DETAILS]` form with no title of its own is called. */
  details: string
  /** What stands over a diagram's source, which a terminal cannot draw. */
  diagram: string
}

export const DEFAULT_LABELS: TerminalLabels = {
  callouts: {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
  },
  details: 'Details',
  diagram: 'Diagram',
}

const CALLOUT_STYLES: Record<CalloutKind, Style> = {
  note: CODE,
  tip: DONE,
  important: { color: 'magenta' },
  warning: WAITING,
  caution: FAILED,
}

/** The narrowest a terminal is drawn for: under it, rows are as wide as this. */
export const MIN_WIDTH = 8

/**
 * The columns a nested block must leave to write in. A quote in a list in a quote would
 * otherwise leave none, and every row would run past the edge: past this depth the nesting is
 * no longer drawn, and the text still is.
 */
const MIN_ROOM = 4

/** Inline forms set off from what is before them by a space the tree does not hold. */
const SET_OFF = new Set(['stat-label', 'source-note', 'step-meta'])

/** Paragraphs that head what follows them: nothing parts the two. */
const HEADS = new Set([
  'steps-title',
  'stats-title',
  'tabs-title',
  'verdict-title',
  'sources-title',
])

/** A heading by its depth: the first three stand out by weight, the rest by slant. */
const HEADINGS: Style[] = [{ bold: true, underline: true }, BOLD, { bold: true, italic: true }]
const DEEP_HEADING: Style = { italic: true }

/** A list's bullet by how deep the list is: one shape, then the other, and round again. */
const BULLETS = ['•', '◦']

/** The columns between one figure of `[!STATS]` and the next. */
const FIGURE_GAP = 3

type Lines = Span[][]

const children = (node: Node): Node[] => node.children ?? []

/** A line ending inside a paragraph is a space; everything else is made safe to print. */
const flat = (text: string): string => printable(text.replace(/\n/g, ' '))

function push(lines: Lines, text: string, style: Style): void {
  lines.at(-1)!.push(span(flat(text), style))
}

function spans(nodes: Node[], style: Style, lines: Lines): void {
  for (const node of nodes) one(node, style, lines)
}

/** One inline and what it holds, added to the last of `lines`. */
function one(node: Node, style: Style, lines: Lines): void {
  const form = formOf(node)?.form
  switch (node.type) {
    case 'text':
    case 'html':
      return push(lines, node.value ?? '', style)
    case 'inlineCode':
      // Code keeps to one row where a row holds it: a command broken in two reads as two.
      return push(lines, (node.value ?? '').replaceAll(' ', NO_BREAK), patch(style, CODE))
    case 'inlineMath':
      // A formula keeps to one row where a row holds it, as code does.
      return push(lines, mathText(node.value ?? '').replaceAll(' ', NO_BREAK), patch(style, MATH))
    case 'break':
      lines.push([])
      return
    case 'strong':
      return spans(children(node), patch(style, BOLD), lines)
    case 'delete':
      return spans(children(node), patch(style, { strike: true }), lines)
    case 'link':
      return link(node, patch(style, { underline: true }), lines)
    case 'image': {
      const alt = node.alt || node.url || ''
      push(lines, alt, style)
      if (node.url && node.url !== alt) push(lines, ` (${node.url})`, DIM)
      return
    }
    case 'footnoteReference':
      return push(lines, `[${node.index ?? node.label ?? '?'}]`, DIM)
    case 'emphasis': {
      // A source's host is its address again, and the address is printed after the link.
      if (form === 'source-host') return
      if (form === 'section-number') {
        spans(children(node), style, lines)
        return push(lines, ' ', style)
      }
      if (form === 'caption') {
        lines.push([])
        return spans(children(node), patch(style, DIM), lines)
      }
      if (form && SET_OFF.has(form)) {
        if (lines.at(-1)!.length > 0) push(lines, ' ', style)
        return spans(children(node), patch(style, DIM), lines)
      }
      return spans(children(node), patch(style, { italic: true }), lines)
    }
    default:
      if (node.children) return spans(node.children, style, lines)
      if (typeof node.value === 'string') push(lines, node.value, style)
  }
}

/** A link's text, and its address after it unless the text is the address. */
function link(node: Node, style: Style, lines: Lines): void {
  const line = lines.length
  let from = lines.at(-1)!.length
  spans(children(node), style, lines)
  if (lines.length !== line) from = 0
  const text = lines
    .at(-1)!
    .slice(from)
    .map((run) => run.text)
    .join('')
  const url = node.url ?? ''
  if (url && text !== flat(url) && !url.startsWith('#')) push(lines, ` (${url})`, DIM)
}

/** `line` without the spaces at its two ends. */
function trimmed(line: Line): Line {
  const out = line.map((run) => ({ ...run }))
  while (out.length > 0 && out[0]!.text.trimStart() === '') out.shift()
  while (out.length > 0 && out.at(-1)!.text.trimEnd() === '') out.pop()
  if (out.length > 0) {
    out[0]!.text = out[0]!.text.trimStart()
    out[out.length - 1]!.text = out.at(-1)!.text.trimEnd()
  }
  return out
}

/** A node's inlines as one line: a table cell, a figure. */
function inline(nodes: Node[], style: Style = PLAIN): Line {
  const lines: Lines = [[]]
  spans(nodes, style, lines)
  // A break inside a cell is a space: a cell is one line until it is wrapped.
  return lines.flatMap((line, at) =>
    at > 0 && line.length > 0 ? [span(' ', PLAIN), ...line] : line,
  )
}

/** A table's rows as their cells, each cell its inlines on one line. */
const cellsOf = (table: Node): Line[][] =>
  children(table).map((row) => children(row).map((cell) => inline(children(cell))))

/**
 * The cells of a parsed text that is one table with `count` rows under its header, as a view
 * reads a table that grows a piece of rows at a time; null for anything else.
 */
export function tableCells(
  root: Node,
  count: number,
): { head: Line[]; body: Line[][]; aligns: NonNullable<Node['align']> } | null {
  const parts = children(root)
  const table = parts[0]
  if (parts.length !== 1 || table?.type !== 'table' || formOf(table)) return null
  const rows = cellsOf(table)
  if (rows.length !== count + 1) return null
  return { head: rows[0]!, body: rows.slice(1), aligns: table.align ?? [] }
}

/**
 * The rows parts of blocks drew, kept between the renders of one view. A part (a paragraph in a
 * list item, a paragraph in a quote, a nested list) whose text, form and place are the same as
 * last time draws the same rows: a list or a quote that grows on every token draws its last part
 * again, and takes the rows of the others as they were.
 */
export interface RowMemo {
  /** Parts drawn in this render, and in the last: a part not drawn in either is forgotten. */
  now: Map<string, Line[]>
  before: Map<string, Line[]>
}

export const createRowMemo = (): RowMemo => ({ now: new Map(), before: new Map() })

/** A render is over: what it did not draw goes at the next. */
export function turnRowMemo(memo: RowMemo): void {
  memo.before = memo.now
  memo.now = new Map()
}

/** A node as text, to key it by; null for one an extension made that cannot be written out. */
function serialized(node: Node): string | null {
  // A node of a list's complete piece is the same object on every token: written out once.
  const kept = WRITTEN.get(node)
  if (kept !== undefined) return kept
  let written: string | null
  try {
    written = JSON.stringify(node)
  } catch {
    written = null
  }
  WRITTEN.set(node, written)
  return written
}

/** Nodes written out, by the node: a tree is not changed once it is parsed. */
const WRITTEN = new WeakMap<Node, string | null>()

/** Rows already merged, kept by a view: they are handed out as they are. */
const MERGED = new WeakSet<Line>()

/** A row's text and styles, as a key: two prefixes that draw alike read alike. */
const signature = (line: Line | null): string =>
  line === null ? '-' : line.map((run) => `${run.text}\u0002${sgr(run.style)}`).join('\u0003')

/** What a view gives `drawBlock` to keep rows by: the block's text, and where to keep them. */
export interface Keeping {
  /** The text the block was parsed from: a part that reaches its end is still being written. */
  source: string
  memo: RowMemo
  /** What else the text was read with (its link definitions): a part read with other ones differs. */
  scope: string
}

class Renderer {
  rows: Line[] = []
  /** The prefix of the next row alone: a list marker, a step's number. */
  private first: Line | null = null
  /** The prefix of every row: the bars and indents of what the block is inside. */
  private rest: Line = []
  /** A blank row asked for and not yet drawn: it is, before the next row, if one comes. */
  private gap: Line | null = null
  /** The plain lists this is inside. */
  private depth = 0

  constructor(
    private readonly width: number,
    private readonly labels: TerminalLabels,
    private readonly code: CodeDrawer,
    /** The fence that may still be written to, in the last block of a reply that streams. */
    private readonly open: Node | null,
    private readonly keeping: Keeping | null = null,
    /** What draws a Mermaid fence as its diagram; without one, the fence is its source. */
    private readonly diagrams: DiagramDrawer | null = null,
  ) {
    this.tail = keeping ? keeping.source.trimEnd().length : 0
  }

  /** Where the text ends, its last line breaks aside: a part that reaches it is still growing. */
  private readonly tail: number

  /** `node`, drawn; or the rows it drew last time it stood in the same place. */
  private part(node: Node): void {
    const key = this.keyOf(node)
    if (key === null) return this.block(node)
    const memo = this.keeping!.memo
    const kept = memo.now.get(key) ?? memo.before.get(key)
    if (kept !== undefined) {
      memo.now.set(key, kept)
      for (const row of kept) this.rows.push(row)
      this.gap = null
      this.first = null
      return
    }
    const from = this.rows.length
    this.block(node)
    // Only a part that drew rows and owes nothing after them is kept: one that drew nothing
    // leaves its marker and its blank row to whatever comes next.
    if (this.rows.length > from && this.gap === null && this.first === null) {
      // Kept as `drawBlock` hands them out, so taking them again costs no merging.
      const rows = this.rows.slice(from).map(merged)
      for (const row of rows) MERGED.add(row)
      this.rows.splice(from, rows.length, ...rows)
      memo.now.set(key, rows)
    }
  }

  /** What `node` draws as, where it stands now; null when it is drawn each time. */
  private keyOf(node: Node): string | null {
    const keeping = this.keeping
    const end = node.position?.end.offset
    if (keeping === null || end === undefined) return null
    // A part that reaches the end of the text is the one the next token changes: not kept.
    if (end >= this.tail) return null
    // The fence still being written grows, and is drawn in pieces of its own.
    const open = this.open?.position?.start.offset
    const start = node.position?.start.offset
    if (open !== undefined && start !== undefined && open >= start && open < end) return null
    // The node as the dialect left it, not its text: a form takes lines from its neighbours (an
    // image its caption), so the text a node was parsed from is not all it draws.
    const tree = serialized(node)
    // A footnote is numbered by the whole block, which this node does not see.
    if (tree === null || tree.includes('"footnote')) return null
    return [
      keeping.scope,
      this.depth,
      this.rows.length > 0 ? 1 : 0,
      signature(this.first),
      signature(this.rest),
      signature(this.gap),
      tree,
    ].join('\u0001')
  }

  /**
   * A formula on rows of its own, set in from the text: its fractions, limits and matrices set on
   * rows where they fit (`formula.ts`), else written on one row for each of its lines, wrapped.
   */
  private formula(node: Node): void {
    const source = node.value ?? ''
    const inset = span('  ', PLAIN)
    const set = formulaRows(source, this.room() - columnsOf(inset.text))
    const rows = set ?? mathRows(source)
    if (rows.length === 0) return
    this.within(inset, inset, () => {
      for (const row of rows) {
        // A row set apart inside the formula (between a matrix's rows) is a blank row.
        if (set && !row.trim()) this.blank()
        else if (set) this.exact([span(printable(row), MATH)])
        else this.put([span(printable(row), MATH)])
      }
    })
  }

  private emit(row: Line): void {
    if (this.gap) {
      if (this.rows.length > 0) this.rows.push(this.gap)
      this.gap = null
    }
    this.rows.push(row)
  }

  /** The columns left to write in. */
  private room(): number {
    return Math.max(1, this.width - lineWidth(this.rest))
  }

  /** A blank row before whatever is drawn next: the prefix with its trailing spaces dropped. */
  private blank(): Line {
    const row = [...this.rest]
    while (row.length > 0) {
      const last = row.at(-1)!
      const kept = last.text.trimEnd()
      if (kept) {
        row[row.length - 1] = span(kept, last.style)
        break
      }
      row.pop()
    }
    this.gap = row
    return row
  }

  private edges(): [Line, Line] {
    const first = this.first ?? this.rest
    this.first = null
    return [first, this.rest]
  }

  /** `line`, wrapped under the prefixes. A line with nothing to read draws nothing. */
  private put(line: Line): void {
    if (!line.some((run) => run.text.trim() !== '')) return
    const [first, rest] = this.edges()
    for (const row of wrap(line, this.width, first, rest)) this.emit(row)
  }

  /** `body` drawn with `first` before its first row and `rest` before the others. */
  private within(first: Span, rest: Span, body: () => void): void {
    // No room left to nest in: the text is drawn where it is, without the mark.
    if (lineWidth(this.rest) + columnsOf(rest.text) + MIN_ROOM > this.width) return body()
    const outer = this.rest
    this.first = [...(this.first ?? outer), first]
    this.rest = [...outer, rest]
    body()
    // Nothing was drawn under the mark: the mark is drawn alone (an empty list item).
    if (this.first) this.emit(this.first)
    this.first = null
    this.rest = outer
  }

  blocks(nodes: Node[], under: 'blocks' | 'item' = 'blocks'): void {
    let before: Node | null = null
    let asked: Line | null = null
    for (const node of nodes) {
      if (before) {
        const head = formOf(before)?.form
        const tight =
          (under === 'item' && (node.type === 'list' || before.type === 'list')) ||
          (head !== undefined && HEADS.has(head)) ||
          // A step's name and the line under it are one paragraph as written.
          (head === 'step-head' && formOf(node)?.form === 'step-body') ||
          formOf(node)?.form === 'quote-source'
        if (!tight) asked = this.blank()
      }
      this.part(node)
      before = node
    }
    // A blank asked for here and never drawn is not owed to whatever comes after this container.
    if (asked !== null && this.gap === asked) this.gap = null
  }

  private block(node: Node): void {
    const form = formOf(node)
    switch (node.type) {
      case 'paragraph': {
        // A formula alone in its paragraph (`$$ … $$` on one line) is one set on rows of its own.
        const only = children(node)
        if (!form && only.length === 1 && only[0]!.type === 'inlineMath')
          return this.formula(only[0]!)
        return this.paragraph(node, form)
      }
      case 'heading':
        return this.text(children(node), HEADINGS[(node.depth ?? 1) - 1] ?? DEEP_HEADING)
      case 'thematicBreak':
        return this.put([span('─'.repeat(Math.min(this.room(), 40)), DIM)])
      case 'blockquote':
        return this.quote(node, form)
      case 'list':
        return this.list(node, form)
      case 'code':
        return this.fence(node, form)
      case 'math':
        return this.formula(node)
      case 'html':
        for (const line of (node.value ?? '').split('\n'))
          this.put([span(printable(untabbed(line)), PLAIN)])
        return
      case 'table':
        return this.table(node)
      case 'footnotes':
        return this.marked(children(node), (index, item) => [`[${item.index ?? index + 1}] `, DIM])
      default:
        if (node.children) return this.blocks(node.children)
        if (typeof node.value === 'string') this.put([span(flat(node.value), PLAIN)])
    }
  }

  private paragraph(node: Node, form: Form | undefined): void {
    switch (form?.form) {
      case 'steps-title':
      case 'stats-title':
      case 'tabs-title':
      case 'verdict-title':
      case 'sources-title':
        return this.text(children(node), BOLD)
      case 'quote-source':
        return this.put([span('— ', DIM), ...inline(children(node), DIM)])
      default:
        this.text(children(node), PLAIN)
    }
  }

  private text(nodes: Node[], style: Style): void {
    const lines: Lines = [[]]
    spans(nodes, style, lines)
    for (const line of lines) this.put(line)
  }

  private quote(node: Node, form: Form | undefined): void {
    switch (form?.form) {
      case 'callout':
        return this.callout(node, form)
      case 'tabs':
        return this.tabs(node)
      case 'verdict':
        return this.verdict(node, form)
      case 'details':
        return this.details(node)
      // What only groups its parts: a form and its title, the two sides of a verdict, one tab.
      case 'form':
      case 'verdicts':
      case 'tab':
        return this.blocks(children(node))
      default: {
        const bar = span('│ ', DIM)
        this.within(bar, bar, () => this.blocks(children(node)))
      }
    }
  }

  private callout(node: Node, form: Form): void {
    const kind = (form.kind ?? 'note') as CalloutKind
    const colour = CALLOUT_STYLES[kind] ?? CODE
    const bar = span('▌ ', colour)
    this.within(bar, bar, () => {
      const head: Line = [span(this.labels.callouts[kind] ?? kind, patch(colour, BOLD))]
      if (form.title) head.push(span(' · ', DIM), span(flat(form.title), BOLD))
      this.put(head)
      this.blocks(children(node))
    })
  }

  private tabs(node: Node): void {
    children(node).forEach((tab, index) => {
      if (index > 0) this.blank()
      const label = flat(formOf(tab)?.label ?? '')
      const rule = '─'.repeat(Math.max(0, Math.min(this.room(), 40) - (columnsOf(label) + 4)))
      this.put([span('─ ', DIM), span(label, BOLD), span(` ${rule}`, DIM)])
      this.blocks(children(tab))
    })
  }

  private verdict(node: Node, form: Form): void {
    const against = form.kind === 'cons'
    for (const part of children(node)) {
      if (part.type === 'list')
        this.marked(children(part), () => (against ? ['- ', FAILED] : ['+ ', DONE]), part.spread)
      else this.block(part)
    }
  }

  private details(node: Node): void {
    const parts = children(node)
    const summary = parts.find((part) => formOf(part)?.form === 'summary')
    const title = summary ? inline(children(summary), BOLD) : [span(this.labels.details, BOLD)]
    this.put([span('▾ ', BOLD), ...title])
    const indent = span('  ', PLAIN)
    this.within(indent, indent, () => this.blocks(parts.filter((part) => part !== summary)))
  }

  private list(node: Node, form: Form | undefined): void {
    const items = children(node)
    switch (form?.form) {
      case 'steps':
        return this.steps(node)
      case 'stats':
        return this.stats(node)
      case 'sources':
        return this.marked(
          items,
          (index) => [`[${index + 1}] `, DIM],
          node.spread,
          (item) => this.source(item),
        )
      default: {
        const start = node.start ?? 1
        const bullet = `${BULLETS[this.depth % BULLETS.length]} `
        this.depth++
        this.marked(
          items,
          (index, item) => {
            const number = node.ordered ? `${start + index}. ` : ''
            // A task's box stands for its bullet, and after its number.
            if (item.checked === true) return [`${number}✓ `, DONE]
            if (item.checked === false) return [`${number}☐ `, DIM]
            return [number || bullet, DIM]
          },
          node.spread,
        )
        this.depth--
      }
    }
  }

  /**
   * One of `[!SOURCES]`: what it is called and what is said of it on a row, and its address on
   * the next, where it is whole whatever the title's length.
   */
  private source(item: Node): void {
    const parts = children(item)
    const paragraph = parts.length === 1 && parts[0]!.type === 'paragraph' ? parts[0]! : null
    const links = children(paragraph ?? item).filter(
      (part) => part.type === 'link' && part.url && !part.url.startsWith('#'),
    )
    // Not the one link and its note this form is written as: the item is drawn as it is.
    if (!paragraph || links.length !== 1) return this.blocks(parts, 'item')
    const lines: Lines = [[]]
    for (const part of children(paragraph)) {
      if (part === links[0]) spans(children(part), { underline: true }, lines)
      else if (formOf(part)?.form === 'source-note') {
        // What is said of a source is set off from its name, which a colour alone would not do.
        push(lines, ' — ', DIM)
        spans(children(part), DIM, lines)
      } else one(part, PLAIN, lines)
    }
    for (const line of lines) this.put(line)
    const url = flat(links[0]!.url ?? '')
    const title = lines.flat().map((run) => run.text)
    if (!title.join('').includes(url)) this.put([span(url, DIM)])
  }

  /** Items, each behind its marker with its other rows hung under its text. */
  private marked(
    items: Node[],
    marker: (index: number, item: Node) => [string, Style],
    loose = false,
    body: (item: Node) => void = (item) => this.blocks(children(item), 'item'),
  ): void {
    items.forEach((item, index) => {
      if (index > 0 && loose) this.blank()
      const [mark, style] = marker(index, item)
      this.within(span(mark, style), span(' '.repeat(columnsOf(mark)), PLAIN), () => body(item))
    })
  }

  /** `[!STEPS]`: each step's number, and a rail down to the next. */
  private steps(node: Node): void {
    const items = children(node)
    const start = Math.max(1, node.start ?? 1)
    // The numbers end in one column, and the rail runs under it: 9 and 10 are one chain.
    const wide = String(start + items.length - 1).length
    items.forEach((item, index) => {
      if (index > 0) {
        this.gap = null
        this.emit([...this.rest, span('│'.padStart(wide), DIM)])
      }
      const number = span(`${String(start + index).padStart(wide)}  `, patch(DONE, BOLD))
      const rail =
        index + 1 === items.length
          ? span(' '.repeat(wide + 2), PLAIN)
          : span(`${'│'.padStart(wide)}  `, DIM)
      this.within(number, rail, () => this.blocks(children(item), 'item'))
    })
  }

  /**
   * `[!STATS]`: the figures side by side, each number over what it counts, while a row holds
   * them; and a list when it does not.
   */
  private stats(node: Node): void {
    const items = children(node)
    const listed = () => this.marked(items, () => ['• ', DIM], node.spread)
    const figures: Array<{ value: Line; label: Line }> = []
    for (const item of items) {
      const parts = children(item)
      if (parts.length !== 1 || parts[0]!.type !== 'paragraph') return listed()
      const inlines = children(parts[0]!)
      const labels = inlines.filter((part) => formOf(part)?.form === 'stat-label')
      figures.push({
        value: trimmed(inline(inlines.filter((part) => !labels.includes(part)))),
        label: trimmed(inline(labels.flatMap(children), DIM)),
      })
    }
    const widths = figures.map(({ value, label }) => Math.max(lineWidth(value), lineWidth(label)))
    const together =
      widths.reduce((sum, wide) => sum + wide, 0) + Math.max(0, figures.length - 1) * FIGURE_GAP
    if (together > this.room()) return listed()
    const row = (pick: (figure: { value: Line; label: Line }) => Line): void => {
      const line: Line = []
      let owed = 0
      figures.forEach((figure, index) => {
        const cell = pick(figure)
        // The space up to a figure is drawn only when a figure follows it: no row ends in spaces.
        if (cell.length > 0 && owed > 0) line.push(span(' '.repeat(owed), PLAIN))
        if (cell.length > 0) owed = 0
        line.push(...cell)
        owed += widths[index]! - lineWidth(cell) + FIGURE_GAP
      })
      if (line.length > 0) this.exact(line)
    }
    row((figure) => figure.value)
    row((figure) => figure.label)
  }

  /** The row over a fence that names its file. */
  titled(title: string): void {
    this.put([span(flat(title), DIM)])
  }

  private fence(node: Node, form: Form | undefined): void {
    const source = node.value ?? ''
    // A diagram whose fence is closed is drawn (`diagram/`); one still being written, or of a
    // kind not drawn, is its source under a row that says what the source is of.
    const drawn =
      this.diagrams && node.lang === DIAGRAM_FENCE_LANGUAGE && node !== this.open
        ? this.diagrams(source, this.room())
        : null
    if (drawn) {
      if (form?.title) this.titled(form.title)
      for (const row of drawn) this.exact(row)
      return
    }
    if (form?.title) this.titled(form.title)
    // A diagram is its source here: the row over it says what the source is of.
    else if (node.lang === DIAGRAM_FENCE_LANGUAGE && source.trim())
      this.put([span(this.labels.diagram, DIM)])
    if (node.lang === TREE_FENCE_LANGUAGE) {
      const rows = parseFileTree(source)
      if (rows.length > 0) return this.tree(rows)
    }
    for (const row of this.code.rows(source.replace(/\n+$/, ''), node.lang, node === this.open))
      this.exact(row)
  }

  /**
   * A file tree with the branches `tree` draws: each name hangs from its folder, and a folder's
   * line runs down to the last name in it. What is said of the names stands in one column where
   * a row holds it.
   */
  private tree(rows: ReturnType<typeof parseFileTree>): void {
    // Whether a row is the last in its folder, read from the end: one pass, whatever the nesting.
    const last: boolean[] = []
    const after: boolean[] = []
    for (let at = rows.length - 1; at >= 0; at--) {
      const { depth } = rows[at]!
      last[at] = !after[depth]
      after.length = depth
      after[depth] = true
    }
    /** For each depth, whether the folder there has names still to come. */
    const open: boolean[] = []
    const names = rows.map((row, at): Line => {
      open.length = row.depth
      open[row.depth] = !last[at]
      let guide = ''
      for (let depth = 1; depth < row.depth; depth++) guide += open[depth] ? '│  ' : '   '
      if (row.depth > 0) guide += last[at] ? '└─ ' : '├─ '
      return [span(guide, DIM), span(flat(row.name), row.folder ? BOLD : PLAIN)]
    })
    const said = rows.map((row) => (row.comment ? flat(row.comment) : ''))
    let column = 0
    let widest = 0
    rows.forEach((_, at) => {
      if (!said[at]) return
      column = Math.max(column, lineWidth(names[at]!))
      widest = Math.max(widest, columnsOf(said[at]!))
    })
    const aligned = column + 2 + widest <= this.room()
    rows.forEach((_, at) => {
      const line = names[at]!
      if (said[at]) {
        const gap = aligned ? column - lineWidth(line) + 2 : 2
        line.push(span(' '.repeat(gap), PLAIN), span(said[at]!, DIM))
      }
      this.exact(line)
    })
  }

  /** `line` as it is, cut where the row ends: what is aligned by its columns, not by its words. */
  private exact(line: Line): void {
    for (const row of fit(line, this.room())) {
      const [first] = this.edges()
      this.emit([...first, ...row])
    }
  }

  private table(node: Node): void {
    const [first, rest] = this.edges()
    for (const row of drawTable(cellsOf(node), node.align ?? [], this.width, first, rest))
      this.emit(row)
  }
}

/**
 * The last fence of a tree that holds code, in the order it is read: the one a reply still
 * arriving may be writing. (A fence with no code is passed over: closing a fence left open inside
 * a list leaves an empty one after it.)
 */
export function lastFence(node: Node): Node | null {
  const parts = children(node)
  for (let at = parts.length - 1; at >= 0; at--) {
    const found = lastFence(parts[at]!)
    if (found) return found
  }
  return node.type === 'code' && node.value ? node : null
}

/** Code in its one colour: what a block is drawn with when no view keeps a drawer for it. */
const PLAIN_CODE = createCodeDrawer(null)

/**
 * The rows `drawBlock` draws over a fence that is a block of its own and names its file: what a
 * view draws above a fence still being written, which it draws without parsing its block.
 */
export function drawFenceTitle(title: string, columns: number, labels: TerminalLabels): Line[] {
  const renderer = new Renderer(Math.max(MIN_WIDTH, Math.floor(columns)), labels, PLAIN_CODE, null)
  renderer.titled(title)
  return renderer.rows.map((row) => (MERGED.has(row) ? row : merged(row)))
}

/**
 * Rows of code (a fence's, one per line) cut to `columns`, as `drawBlock` draws a fence that is a
 * block of its own. A line of code is drawn by itself, so lines drawn apart are the rows of the
 * lines drawn together.
 */
export function drawCodeRows(code: Line[], columns: number): Line[] {
  const width = Math.max(MIN_WIDTH, Math.floor(columns))
  const out: Line[] = []
  for (const line of code) for (const row of fit(line, width)) out.push(merged(row))
  return out
}

/**
 * A parsed block (its `root`) as terminal rows no wider than `columns`. `code` colours its fences;
 * `growing` says the block is the end of a reply still arriving: its last fence may gain code.
 */
export function drawBlock(
  root: Node,
  columns: number,
  labels: TerminalLabels,
  code: CodeDrawer = PLAIN_CODE,
  growing = false,
  keeping: Keeping | null = null,
  diagrams: DiagramDrawer | null = null,
): Line[] {
  const renderer = new Renderer(
    Math.max(MIN_WIDTH, Math.floor(columns)),
    labels,
    code,
    growing ? lastFence(root) : null,
    keeping,
    diagrams,
  )
  renderer.blocks(children(root))
  return renderer.rows.map((row) => (MERGED.has(row) ? row : merged(row)))
}
