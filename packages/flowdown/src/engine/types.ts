/**
 * The tree the engine parses Markdown into. One node shape for every kind, so the parser and the
 * renderers stay monomorphic: a kind uses the fields it needs and leaves the rest unset.
 */

/** A place in the text: line and column from 1, offset from 0. */
export interface Point {
  line: number
  column: number
  offset: number
}

export interface Position {
  start: Point
  end: Point
}

/**
 * Any Markdown tree: the engine's own, or the mdast one a unified pipeline hands a plugin. The
 * dialect's passes read and write the fields the two share.
 */
export interface Tree {
  type: string
  children?: unknown[]
}

export type Align = 'left' | 'right' | 'center' | null

export type NodeType =
  | 'root'
  // Blocks.
  | 'paragraph'
  | 'heading'
  | 'thematicBreak'
  | 'blockquote'
  | 'list'
  | 'listItem'
  | 'code'
  | 'html'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'footnoteDefinition'
  | 'footnotes'
  // Inlines.
  | 'text'
  | 'break'
  | 'emphasis'
  | 'strong'
  | 'delete'
  | 'inlineCode'
  | 'link'
  | 'image'
  | 'footnoteReference'
  // Formulas, when an extension reads them, and elements made of raw HTML.
  | 'math'
  | 'inlineMath'
  | 'element'
  // Anything an extension adds.
  | (string & {})

export interface Node {
  type: NodeType
  children?: Node[]
  /** The text of a `text`, `inlineCode`, `code` or `html` node. A line ending in a paragraph is `\n` in its text. */
  value?: string
  /** A heading's level, 1 to 6. */
  depth?: number
  /** A list: numbered or bulleted, its first number, and whether blank lines part its items. */
  ordered?: boolean
  start?: number
  spread?: boolean
  /** A task list item: checked, unchecked, or (unset) not a task. */
  checked?: boolean
  /** A code block's info string: its first word, and the rest. */
  lang?: string
  meta?: string
  /** A link's or image's destination and title. */
  url?: string
  title?: string
  /** An image's description, as plain text. */
  alt?: string
  /** A table's column alignments; a cell's own alignment and whether it is a header cell. */
  align?: Align[]
  cellAlign?: Align
  header?: boolean
  /** A footnote's label as its definition writes it, the same folded for matching, and its number. */
  label?: string
  identifier?: string
  index?: number
  /** A footnote reference: which reference to its footnote this is, from 1. */
  occurrence?: number
  /** A footnote definition: how many references lead to it. */
  count?: number
  /** Where a block sits in the text it was parsed from. */
  position?: Position
  /** Whatever an extension keeps on its node. */
  data?: Record<string, unknown>
}

/** A link reference definition: `[label]: url "title"`. */
export interface Reference {
  url: string
  title: string
}

/** What one inline rule sees: the text being read and where the parser is in it. */
export interface InlineState {
  /** The inline text of one block. */
  text: string
  /** Where the parser is. A rule that matches moves it past what it read. */
  pos: number
  /** Adds a node at the current place. */
  push: (node: Node) => void
}

/**
 * An inline construct: the characters it can start with, and a function that reads it. The
 * function returns false when the text at `state.pos` is not its construct, leaving `pos` alone.
 */
export interface InlineRule {
  chars: string
  parse: (state: InlineState) => boolean
}

/** A fenced block an extension draws its own way: ```` ```tree ````, ```` ```mermaid ````. */
export type FenceRule = (node: Node) => Node | null | undefined

/**
 * An extension to the syntax. Everything past CommonMark is one: GFM, and each form of the
 * flowdown dialect.
 */
export interface Extension {
  name: string
  /** Inline constructs, tried when the parser meets one of their characters. */
  inline?: InlineRule[]
  /** Reads a `$$` line as the fence of a display formula: a `math` node with the lines between. */
  mathFences?: boolean
  /** Fenced blocks by language: the rule gets the `code` node and returns what replaces it. */
  fences?: Record<string, FenceRule>
  /**
   * Rewrites the finished tree: how a blockquote becomes a callout, a list becomes steps. `source`
   * is the text the tree was read from, the one every node's position counts in.
   */
  transform?: (root: Node, source: string) => void
}

export interface ParseOptions {
  /** GitHub's extensions: tables, strikethrough, task lists, bare links, footnotes. On by default. */
  gfm?: boolean
  extensions?: Extension[]
}
