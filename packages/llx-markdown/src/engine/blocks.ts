/**
 * The block pass: a document read line by line into its blocks, by the algorithm in the
 * CommonMark spec. Each line is matched against the containers still open (a quote's `>`, a list
 * item's indent), then tried as the start of a new block, then added to the block it belongs to.
 * The text of paragraphs, headings and cells is kept as written; the inline pass reads it once
 * the whole document is known, since a link can refer to a definition further down.
 */
import { unescapeString } from './entities'
import {
  CLOSETAG,
  normalizeLabel,
  OPENTAG,
  parseInlines,
  parseReference,
  type InlineContext,
} from './inlines'
import type { Align, Node, Position } from './types'

/** A block while the document is read. */
interface Block {
  type: string
  parent: Block | null
  children: Block[]
  open: boolean
  lastLineBlank: boolean
  /** The lines added so far, each with its line ending. */
  text: string
  startLine: number
  endLine: number
  /** Where the block starts in the document. */
  startOffset: number
  // A list and its items.
  ordered: boolean
  bullet: number
  start: number
  delimiter: number
  padding: number
  markerOffset: number
  tight: boolean
  // A code block.
  fenced: boolean
  fenceChar: number
  fenceLength: number
  fenceOffset: number
  /** Which of the seven kinds of HTML block this is. */
  htmlType: number
  /** A heading's level. */
  level: number
  /** A table's alignments and its rows as written; a footnote's label. */
  align: Align[] | null
  rows: string[] | null
  label: string
}

const C_TAB = 9
const C_SPACE = 32
const C_HASH = 35
const C_DOLLAR = 36
const C_ASTERISK = 42
const C_PLUS = 43
const C_DASH = 45
const C_COLON = 58
const C_LESSTHAN = 60
const C_EQUALS = 61
const C_GREATERTHAN = 62
const C_OPEN_BRACKET = 91
const C_BACKSLASH = 92
const C_UNDERSCORE = 95
const C_BACKTICK = 96
const C_PIPE = 124
const C_TILDE = 126

const reHtmlBlockOpen = [
  /./,
  /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<[?]/,
  /^<![A-Za-z]/,
  /^<!\[CDATA\[/,
  /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
  new RegExp(`^(?:${OPENTAG}|${CLOSETAG})\\s*$`, 'i'),
] as const
const reHtmlBlockClose = [
  /./,
  /<\/(?:script|pre|textarea|style)>/i,
  /-->/,
  /\?>/,
  />/,
  /\]\]>/,
] as const

const reThematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/
const reOrderedListMarker = /^(\d{1,9})([.)])/
const reAtxHeadingMarker = /^#{1,6}(?:[ \t]+|$)/
const reCodeFence = /^`{3,}(?!.*`)|^~{3,}/
const reClosingCodeFence = /^(?:`{3,}|~{3,})(?=[ \t]*$)/
/** A display formula's fence, read only when an extension asks for it: `$$` alone on its line. */
const reMathFence = /^\${2,}(?!.*\$)/
const reClosingMathFence = /^\${2,}(?=[ \t]*$)/
const reSetextHeadingLine = /^(?:=+|-+)[ \t]*$/
const reLineEnding = /\r\n|\n|\r/g
const reTableDelimiterCell = /^[ \t]*(:?)-+(:?)[ \t]*$/
const reFootnoteDefinition = /^\[\^([^\]\s]+)\]:[ \t]*/
const reTaskMarker = /^\[([ xX])\](?=[ \t\n])/

const isSpaceOrTab = (code: number): boolean => code === C_SPACE || code === C_TAB

/** Whether a block holds other blocks; a list holds only items. */
const isContainer = (type: string): boolean =>
  type === 'root' ||
  type === 'blockquote' ||
  type === 'item' ||
  type === 'list' ||
  type === 'footnoteDefinition'

/** Whether a block takes the lines after its first as they are. */
const acceptsLines = (type: string): boolean =>
  type === 'paragraph' || type === 'code' || type === 'html'

/**
 * A table row cut into its cells: on each `|` that is not escaped, without the outer pipes. Each
 * cell is one cut of the row, joined from pieces only where an escaped pipe (`\\|`) is taken out.
 */
const splitRow = (row: string): string[] => {
  const cells: string[] = []
  let line = row.trim()
  if (line.charCodeAt(0) === C_PIPE) line = line.slice(1)
  /** The cell's text before `from`: what came before an escaped pipe, and that pipe. */
  let cell = ''
  let from = 0
  for (let pipe = line.indexOf('|'); pipe !== -1; pipe = line.indexOf('|', pipe + 1)) {
    if (pipe > 0 && line.charCodeAt(pipe - 1) === C_BACKSLASH)
      cell += `${line.slice(from, pipe - 1)}|`
    else {
      cells.push((cell + line.slice(from, pipe)).trim())
      cell = ''
    }
    from = pipe + 1
  }
  const last = (cell + line.slice(from)).trim()
  // Text after the last pipe is a cell; nothing after it is the row's closing pipe.
  if (last !== '' || line.charCodeAt(line.length - 1) !== C_PIPE || line === '') cells.push(last)
  return cells
}

/** The alignments a table's delimiter row (`| :-- | --: |`) gives, or null when it is not one. */
const parseDelimiterRow = (row: string): Align[] | null => {
  if (row.indexOf('|') === -1) return null
  const cells = splitRow(row)
  const align: Align[] = []
  for (const cell of cells) {
    const found = reTableDelimiterCell.exec(cell)
    if (found === null) return null
    align.push(found[1] ? (found[2] ? 'center' : 'left') : found[2] ? 'right' : null)
  }
  return align.length === 0 ? null : align
}

export interface BlockResult {
  root: Node
  /** The footnotes defined, in the order they are first referred to. */
  footnotes: Node[]
}

/** Parses a whole document into its tree. */
export const parseBlocks = (input: string, context: InlineContext): BlockResult => {
  const gfm = context.gfm
  // Where each line starts and ends in the document (its ending left out): a node's position is
  // counted from these, and a line's text is cut from the document only when it is read.
  const starts: number[] = []
  const ends: number[] = []
  // Most text has no carriage return: its lines are found by a plain search, not a pattern.
  const onlyLf = input.indexOf('\r') === -1
  if (onlyLf) {
    for (let at = 0; ;) {
      const ending = input.indexOf('\n', at)
      starts.push(at)
      if (ending === -1) {
        ends.push(input.length)
        break
      }
      ends.push(ending)
      at = ending + 1
    }
  } else {
    for (let at = 0; ;) {
      reLineEnding.lastIndex = at
      const ending = reLineEnding.exec(input)
      starts.push(at)
      if (ending === null) {
        ends.push(input.length)
        break
      }
      ends.push(ending.index)
      at = ending.index + ending[0].length
    }
  }
  let count = starts.length
  // A final line ending ends the last line; it does not start an empty one.
  if (count > 0 && starts[count - 1] === ends[count - 1]) count--
  /** No NUL in the document: a line is then the document's own text, with nothing to replace. */
  const noNul = input.indexOf('\u0000') === -1

  const block = (type: string, startLine: number): Block => ({
    type,
    parent: null,
    children: [],
    open: true,
    lastLineBlank: false,
    text: '',
    startLine,
    endLine: startLine,
    startOffset: 0,
    ordered: false,
    bullet: 0,
    start: 0,
    delimiter: 0,
    padding: 0,
    markerOffset: 0,
    tight: true,
    fenced: false,
    fenceChar: 0,
    fenceLength: 0,
    fenceOffset: 0,
    htmlType: 0,
    level: 0,
    align: null,
    rows: null,
    label: '',
  })

  const doc = block('root', 1)
  let tip: Block = doc
  let oldtip: Block = doc
  let lastMatchedContainer: Block = doc
  let allClosed = true
  let line = ''
  let lineNumber = 0
  let offset = 0
  let column = 0
  let nextNonspace = 0
  let nextNonspaceColumn = 0
  let indent = 0
  let indented = false
  let blank = false
  let partiallyConsumedTab = false

  const findNextNonspace = (): void => {
    let index = offset
    let cols = column
    let code = line.charCodeAt(index)
    while (code === C_SPACE || code === C_TAB) {
      cols += code === C_SPACE ? 1 : 4 - (cols % 4)
      code = line.charCodeAt(++index)
    }
    blank = index >= line.length
    nextNonspace = index
    nextNonspaceColumn = cols
    indent = cols - column
    indented = indent >= 4
  }

  const advanceNextNonspace = (): void => {
    offset = nextNonspace
    column = nextNonspaceColumn
    partiallyConsumedTab = false
  }

  /** Moves past `amount` characters, or that many columns: a tab is up to four columns wide. */
  const advanceOffset = (amount: number, columns: boolean): void => {
    let left = amount
    while (left > 0 && offset < line.length) {
      if (line.charCodeAt(offset) === C_TAB) {
        const toTab = 4 - (column % 4)
        if (columns) {
          partiallyConsumedTab = toTab > left
          const step = toTab > left ? left : toTab
          column += step
          if (!partiallyConsumedTab) offset++
          left -= step
        } else {
          partiallyConsumedTab = false
          column += toTab
          offset++
          left--
        }
      } else {
        partiallyConsumedTab = false
        offset++
        column++
        left--
      }
    }
  }

  const addLine = (): void => {
    if (partiallyConsumedTab) {
      // The rest of a tab that a container's indent took part of.
      offset++
      tip.text += ' '.repeat(4 - (column % 4))
    }
    tip.text += `${line.slice(offset)}\n`
  }

  const removeChild = (child: Block): void => {
    const siblings = child.parent?.children
    if (siblings === undefined) return
    const index = siblings.lastIndexOf(child)
    if (index !== -1) siblings.splice(index, 1)
    child.parent = null
  }

  /** Whether a block ends with a blank line before its next sibling. */
  const gapAfter = (child: Block, next: Block | undefined): boolean =>
    next !== undefined && child.endLine !== next.startLine - 1

  const takeReferences = (paragraph: Block): void => {
    let content = paragraph.text
    while (content.charCodeAt(0) === C_OPEN_BRACKET) {
      const taken = parseReference(content, context.refs)
      if (taken === 0) break
      content = content.slice(taken)
    }
    paragraph.text = content
  }

  const finalize = (closing: Block, endLine: number): void => {
    const above = closing.parent
    closing.open = false
    closing.endLine = endLine
    switch (closing.type) {
      case 'paragraph':
        takeReferences(closing)
        // A paragraph that was only definitions leaves nothing behind.
        if (/^[ \t\n]*$/.test(closing.text)) removeChild(closing)
        break
      case 'code':
        if (closing.fenced) {
          const newline = closing.text.indexOf('\n')
          closing.label = unescapeString(closing.text.slice(0, newline).trim())
          closing.text = closing.text.slice(newline + 1)
        } else closing.text = closing.text.replace(/(?:\n *)+$/, '\n')
        break
      case 'list': {
        const items = closing.children
        closing.tight = true
        for (let index = 0; index < items.length && closing.tight; index++) {
          const item = items[index] as Block
          if (gapAfter(item, items[index + 1])) closing.tight = false
          const inner = item.children
          for (let child = 0; child < inner.length && closing.tight; child++)
            if (gapAfter(inner[child] as Block, inner[child + 1])) closing.tight = false
        }
        const last = items[items.length - 1]
        if (last !== undefined) closing.endLine = last.endLine
        break
      }
      case 'item': {
        const last = closing.children[closing.children.length - 1]
        closing.endLine = last === undefined ? closing.startLine : last.endLine
        break
      }
      default:
    }
    if (above !== null) tip = above
  }

  const addChild = (type: string): Block => {
    // oxlint-disable-next-line no-unmodified-loop-condition -- `finalize` moves `tip` up.
    while (!isContainer(tip.type) || (tip.type === 'list' && type !== 'item'))
      finalize(tip, lineNumber - 1)
    const child = block(type, lineNumber)
    child.startOffset = (starts[lineNumber - 1] ?? 0) + nextNonspace
    child.parent = tip
    tip.children.push(child)
    tip = child
    return child
  }

  const closeUnmatchedBlocks = (): void => {
    if (allClosed) return
    while (oldtip !== lastMatchedContainer) {
      const parent = oldtip.parent as Block
      finalize(oldtip, lineNumber - 1)
      oldtip = parent
    }
    allClosed = true
  }

  /** Reads a list marker at the next non-space character into a new item's data, or null. */
  const parseListMarker = (container: Block): Block | null => {
    if (indent >= 4) return null
    const rest = line.slice(nextNonspace)
    const first = rest.charCodeAt(0)
    const item = block('item', lineNumber)
    let markerLength = 1
    if (first === C_ASTERISK || first === C_PLUS || first === C_DASH) item.bullet = first
    else {
      const found = reOrderedListMarker.exec(rest)
      if (found === null) return null
      // Only a list that starts at 1 can interrupt a paragraph.
      if (container.type === 'paragraph' && found[1] !== '1') return null
      item.ordered = true
      item.start = parseInt(found[1] as string, 10)
      item.delimiter = (found[2] as string).charCodeAt(0)
      markerLength = found[0].length
    }
    const after = line.charCodeAt(nextNonspace + markerLength)
    if (!Number.isNaN(after) && !isSpaceOrTab(after)) return null
    // An empty item cannot interrupt a paragraph.
    if (container.type === 'paragraph' && /^[ \t]*$/.test(line.slice(nextNonspace + markerLength)))
      return null

    advanceNextNonspace()
    advanceOffset(markerLength, true)
    const spacesStartColumn = column
    const spacesStartOffset = offset
    do {
      advanceOffset(1, true)
      // oxlint-disable-next-line no-unmodified-loop-condition -- `advanceOffset` moves `column`.
    } while (column - spacesStartColumn < 5 && isSpaceOrTab(line.charCodeAt(offset)))
    const blankItem = offset >= line.length
    const spaces = column - spacesStartColumn
    if (spaces >= 5 || spaces < 1 || blankItem) {
      item.padding = markerLength + 1
      column = spacesStartColumn
      offset = spacesStartOffset
      if (isSpaceOrTab(line.charCodeAt(offset))) advanceOffset(1, true)
    } else item.padding = markerLength + spaces
    item.markerOffset = indent
    return item
  }

  /**
   * Whether an open block goes on with this line: 0 when it does, 1 when it does not, 2 when the
   * line closed it and is used up.
   */
  const continues = (container: Block): number => {
    switch (container.type) {
      case 'blockquote':
        if (indented || line.charCodeAt(nextNonspace) !== C_GREATERTHAN) return 1
        advanceNextNonspace()
        advanceOffset(1, false)
        if (isSpaceOrTab(line.charCodeAt(offset))) advanceOffset(1, true)
        return 0
      case 'item':
        if (blank) {
          if (container.children.length === 0) return 1
          advanceNextNonspace()
        } else if (indent >= container.markerOffset + container.padding)
          advanceOffset(container.markerOffset + container.padding, true)
        else return 1
        return 0
      case 'footnoteDefinition':
        if (blank) advanceNextNonspace()
        else if (indent >= 4) advanceOffset(4, true)
        else return 1
        return 0
      case 'code':
        if (container.fenced) {
          if (indent <= 3 && line.charCodeAt(nextNonspace) === container.fenceChar) {
            const found = (
              container.fenceChar === C_DOLLAR ? reClosingMathFence : reClosingCodeFence
            ).exec(line.slice(nextNonspace))
            if (found !== null && found[0].length >= container.fenceLength) {
              finalize(container, lineNumber)
              return 2
            }
          }
          // Indentation up to the fence's own is not part of the code.
          let skip = container.fenceOffset
          while (skip > 0 && isSpaceOrTab(line.charCodeAt(offset))) {
            advanceOffset(1, true)
            skip--
          }
        } else if (indent >= 4) advanceOffset(4, true)
        else if (blank) advanceNextNonspace()
        else return 1
        return 0
      case 'html':
        return blank && (container.htmlType === 6 || container.htmlType === 7) ? 1 : 0
      case 'paragraph':
      case 'table':
        return blank ? 1 : 0
      case 'heading':
      case 'thematicBreak':
        return 1
      default:
        return 0
    }
  }

  /**
   * Tries the line as the start of a new block: 0 when it starts none, 1 when it starts a
   * container (the rest of the line is tried again), 2 when it starts a leaf.
   */
  const startBlock = (container: Block): number => {
    const first = line.charCodeAt(nextNonspace)
    if (indented) {
      // Four columns of indent start code, except where the line can go on a paragraph.
      if (tip.type !== 'paragraph' && !blank) {
        advanceOffset(4, true)
        closeUnmatchedBlocks()
        addChild('code')
        return 2
      }
      return 0
    }
    switch (first) {
      case C_GREATERTHAN:
        advanceNextNonspace()
        advanceOffset(1, false)
        if (isSpaceOrTab(line.charCodeAt(offset))) advanceOffset(1, true)
        closeUnmatchedBlocks()
        addChild('blockquote')
        return 1
      case C_HASH: {
        const found = reAtxHeadingMarker.exec(line.slice(nextNonspace))
        if (found === null) return 0
        advanceNextNonspace()
        advanceOffset(found[0].length, false)
        closeUnmatchedBlocks()
        const heading = addChild('heading')
        heading.level = found[0].trim().length
        heading.text = line
          .slice(offset)
          .replace(/^[ \t]*#+[ \t]*$/, '')
          .replace(/[ \t]+#+[ \t]*$/, '')
        advanceOffset(line.length - offset, false)
        return 2
      }
      case C_DOLLAR:
      case C_BACKTICK:
      case C_TILDE: {
        if (first === C_DOLLAR && !context.math) return 0
        const found = (first === C_DOLLAR ? reMathFence : reCodeFence).exec(
          line.slice(nextNonspace),
        )
        if (found === null) return 0
        closeUnmatchedBlocks()
        const code = addChild('code')
        code.fenced = true
        code.fenceLength = found[0].length
        code.fenceChar = first
        code.fenceOffset = indent
        advanceNextNonspace()
        advanceOffset(code.fenceLength, false)
        return 2
      }
      case C_LESSTHAN: {
        const rest = line.slice(nextNonspace)
        for (let type = 1; type <= 7; type++) {
          if (
            (reHtmlBlockOpen[type] as RegExp).test(rest) &&
            // The seventh kind (any complete tag) cannot interrupt a paragraph.
            (type < 7 ||
              (container.type !== 'paragraph' &&
                !(!allClosed && !blank && tip.type === 'paragraph')))
          ) {
            closeUnmatchedBlocks()
            // The line is kept whole: an HTML block is passed through with its indentation.
            addChild('html').htmlType = type
            return 2
          }
        }
        return 0
      }
      default:
    }

    if (container.type === 'paragraph') {
      // A table: the paragraph's last line is its header, this line the row of dashes under it.
      if (gfm && (first === C_PIPE || first === C_DASH || first === C_COLON)) {
        const align = parseDelimiterRow(line.slice(nextNonspace))
        if (align !== null) {
          const content = container.text
          const cut = content.lastIndexOf('\n', content.length - 2)
          const header = content.slice(cut + 1, -1)
          if (splitRow(header).length === align.length) {
            closeUnmatchedBlocks()
            if (cut === -1) {
              tip = container.parent as Block
              removeChild(container)
            } else {
              container.text = content.slice(0, cut + 1)
              finalize(container, lineNumber - 2)
            }
            const table = addChild('table')
            table.startLine = lineNumber - 1
            table.startOffset = starts[lineNumber - 2] ?? 0
            table.align = align
            table.rows = [header]
            advanceOffset(line.length - offset, false)
            return 2
          }
        }
      }
      // A setext heading: the paragraph so far, underlined.
      if (first === C_EQUALS || first === C_DASH) {
        if (reSetextHeadingLine.test(line.slice(nextNonspace))) {
          closeUnmatchedBlocks()
          takeReferences(container)
          if (container.text.length > 0) {
            container.type = 'heading'
            container.level = first === C_EQUALS ? 1 : 2
            advanceOffset(line.length - offset, false)
            return 2
          }
        }
      }
    }

    if (
      (first === C_ASTERISK || first === C_DASH || first === C_UNDERSCORE) &&
      reThematicBreak.test(line.slice(nextNonspace))
    ) {
      closeUnmatchedBlocks()
      addChild('thematicBreak')
      advanceOffset(line.length - offset, false)
      return 2
    }

    if (gfm && first === C_OPEN_BRACKET && line.charCodeAt(nextNonspace + 1) === 94 /* ^ */) {
      const found = reFootnoteDefinition.exec(line.slice(nextNonspace))
      if (found !== null) {
        closeUnmatchedBlocks()
        advanceNextNonspace()
        advanceOffset(found[0].length, false)
        const definition = addChild('footnoteDefinition')
        definition.label = found[1] as string
        const key = normalizeLabel(`[${definition.label}]`)
        if (!context.footnotes.has(key)) context.footnotes.set(key, definition.label)
        return 1
      }
    }

    if (
      first === C_ASTERISK ||
      first === C_PLUS ||
      first === C_DASH ||
      (first >= 48 && first <= 57)
    ) {
      const item = parseListMarker(container)
      if (item === null) return 0
      closeUnmatchedBlocks()
      // An item goes on the list it fits: the same kind of marker.
      if (
        tip.type !== 'list' ||
        tip.ordered !== item.ordered ||
        tip.bullet !== item.bullet ||
        tip.delimiter !== item.delimiter
      ) {
        const list = addChild('list')
        list.ordered = item.ordered
        list.bullet = item.bullet
        list.delimiter = item.delimiter
        list.start = item.start
      }
      const added = addChild('item')
      added.ordered = item.ordered
      added.padding = item.padding
      added.markerOffset = item.markerOffset
      return 1
    }
    return 0
  }

  const incorporateLine = (text: string): void => {
    let container: Block = doc
    oldtip = tip
    offset = 0
    column = 0
    blank = false
    partiallyConsumedTab = false
    lineNumber++
    line = noNul || text.indexOf('\u0000') === -1 ? text : text.replace(/\0/g, '�')

    // The open blocks this line goes on with, from the outermost in.
    for (;;) {
      const last = container.children[container.children.length - 1]
      if (last === undefined || !last.open) break
      container = last
      findNextNonspace()
      const result = continues(container)
      if (result === 2) return
      if (result === 1) {
        container = container.parent as Block
        break
      }
    }
    allClosed = container === oldtip
    lastMatchedContainer = container

    // New blocks the rest of the line starts, until it is down to a leaf or to text.
    let matchedLeaf = container.type !== 'paragraph' && acceptsLines(container.type)
    while (!matchedLeaf) {
      findNextNonspace()
      const result = blank ? 0 : startBlock(container)
      if (result === 0) {
        advanceNextNonspace()
        break
      }
      container = tip
      if (result === 2) matchedLeaf = true
    }

    if (!allClosed && !blank && tip.type === 'paragraph') {
      // A lazy continuation line: text that goes on a paragraph inside containers it did not mark.
      addLine()
      return
    }
    closeUnmatchedBlocks()
    const type = container.type
    if (blank) {
      const last = container.children[container.children.length - 1]
      if (last !== undefined) last.lastLineBlank = true
    }
    const lastLineBlank =
      blank &&
      !(
        type === 'blockquote' ||
        (type === 'code' && container.fenced) ||
        (type === 'item' && container.children.length === 0 && container.startLine === lineNumber)
      )
    for (let above: Block | null = container; above !== null; above = above.parent)
      above.lastLineBlank = lastLineBlank

    if (acceptsLines(type)) {
      addLine()
      // The first five kinds of HTML block end on the line that holds their closing sequence.
      if (
        type === 'html' &&
        container.htmlType >= 1 &&
        container.htmlType <= 5 &&
        (reHtmlBlockClose[container.htmlType] as RegExp).test(line.slice(offset))
      )
        finalize(container, lineNumber)
    } else if (offset < line.length && !blank) {
      if (type === 'table') (container.rows as string[]).push(line.slice(offset))
      else {
        addChild('paragraph')
        advanceNextNonspace()
        addLine()
      }
    }
  }

  /**
   * The lines of a fenced code block at the top of the document, taken without the work a line
   * gets elsewhere: from the line after `index`, every line up to one that may close the fence
   * goes into the code as it is written, in one cut of the document. Returns the last line taken.
   *
   * A line may close the fence when, after at most three spaces, it starts with the fence's
   * character; that line, and whatever follows a fence that did not close, is read the long way.
   */
  const takeFencedLines = (code: Block, index: number): number => {
    const fenceChar = code.fenceChar
    let next = index + 1
    for (; next < count; next++) {
      let at = starts[next] as number
      if (input.charCodeAt(at) === C_SPACE) {
        at++
        if (input.charCodeAt(at) === C_SPACE) {
          at++
          if (input.charCodeAt(at) === C_SPACE) at++
        }
      }
      if (input.charCodeAt(at) === fenceChar) break
    }
    const last = next - 1
    if (last === index) return index
    const taken = input.slice(starts[index + 1] as number, ends[last] as number)
    code.text += `${onlyLf ? taken : taken.replace(reLineEnding, '\n')}\n`
    lineNumber += last - index
    return last
  }

  for (let index = 0; index < count; index++) {
    incorporateLine(input.slice(starts[index] as number, ends[index] as number))
    // Inside a container, or under an indented fence, each line has a prefix to take off first.
    if (tip.fenced && tip.parent === doc && tip.fenceOffset === 0 && noNul)
      index = takeFencedLines(tip, index)
  }
  // oxlint-disable-next-line no-unmodified-loop-condition -- `finalize` moves `tip` up.
  while (tip !== doc) finalize(tip, count)
  finalize(doc, count)

  // The second pass: every block's text read into inlines, now that every definition is known.
  // Footnote definitions leave the flow: they are drawn together at the end of the document.
  const definitions = new Map<string, Block>()

  const kids = (from: Block): Node[] => {
    const out: Node[] = []
    for (const child of from.children) {
      if (child.type === 'footnoteDefinition') {
        const key = normalizeLabel(`[${child.label}]`)
        if (!definitions.has(key)) definitions.set(key, child)
      } else out.push(build(child))
    }
    return out
  }

  const cells = (row: string, align: Align[], header: boolean): Node => {
    const parts = splitRow(row)
    const children: Node[] = []
    for (let index = 0; index < align.length; index++)
      children.push({
        type: 'tableCell',
        header,
        cellAlign: align[index] ?? null,
        children: parseInlines(parts[index] ?? '', context),
      })
    return { type: 'tableRow', children }
  }

  /** Where a block sits in the document: from its first character to the end of its last line. */
  const place = (from: Block): Position => {
    const last = Math.min(Math.max(from.endLine, from.startLine), starts.length)
    const lastStart = starts[last - 1] ?? 0
    const length = (ends[last - 1] ?? 0) - lastStart
    return {
      start: {
        line: from.startLine,
        column: from.startOffset - (starts[from.startLine - 1] ?? 0) + 1,
        offset: from.startOffset,
      },
      end: { line: last, column: length + 1, offset: lastStart + length },
    }
  }

  const build = (from: Block): Node => {
    switch (from.type) {
      case 'paragraph':
        return {
          type: 'paragraph',
          position: place(from),
          children: parseInlines(from.text, context),
        }
      case 'heading':
        return {
          type: 'heading',
          depth: from.level,
          position: place(from),
          children: parseInlines(from.text, context),
        }
      case 'thematicBreak':
        return { type: 'thematicBreak', position: place(from) }
      case 'code': {
        if (from.fenceChar === C_DOLLAR) {
          const node: Node = {
            type: 'math',
            position: place(from),
            value: from.text.replace(/\n$/, ''),
          }
          if (from.label !== '') node.meta = from.label
          return node
        }
        const node: Node = { type: 'code', position: place(from), value: from.text }
        if (from.label !== '') {
          const space = from.label.search(/[ \t]/)
          node.lang = space === -1 ? from.label : from.label.slice(0, space)
          if (space !== -1) node.meta = from.label.slice(space + 1).trim()
        }
        return node
      }
      case 'html':
        return { type: 'html', position: place(from), value: from.text.replace(/(?:\n *)+$/, '') }
      case 'table': {
        const align = from.align as Align[]
        const rows = from.rows as string[]
        return {
          type: 'table',
          position: place(from),
          align,
          children: rows.map((row, index) => cells(row, align, index === 0)),
        }
      }
      case 'list': {
        const node: Node = {
          type: 'list',
          position: place(from),
          ordered: from.ordered,
          spread: !from.tight,
          children: kids(from),
        }
        for (const item of node.children as Node[]) item.spread = !from.tight
        if (from.ordered) node.start = from.start
        return node
      }
      case 'item': {
        const node: Node = { type: 'listItem', position: place(from), children: [] }
        const first = from.children[0]
        if (gfm && first !== undefined && first.type === 'paragraph') {
          const task = reTaskMarker.exec(first.text)
          if (task !== null) {
            node.checked = task[1] !== ' '
            first.text = first.text.slice(task[0].length + 1)
          }
        }
        node.children = kids(from)
        return node
      }
      default:
        return { type: from.type, position: place(from), children: kids(from) }
    }
  }

  const root: Node = { type: 'root', children: kids(doc) }

  // The footnotes referred to, in the order of their first reference. Reading one can refer to
  // more, so the list is walked as it grows.
  const footnotes: Node[] = []
  for (let index = 0; ; index++) {
    let key: string | undefined
    let at = 0
    for (const used of context.footnoteUses.keys()) if (at++ === index) key = used
    if (key === undefined) break
    const from = definitions.get(key)
    if (from === undefined) continue
    footnotes.push({
      type: 'footnoteDefinition',
      identifier: normalizeLabel(`[${from.label}]`).toLowerCase(),
      label: from.label,
      index: index + 1,
      position: place(from),
      children: kids(from),
    })
  }
  for (const node of footnotes)
    node.count = context.footnoteUses.get(normalizeLabel(`[${node.label}]`)) ?? 1
  return { root, footnotes }
}
