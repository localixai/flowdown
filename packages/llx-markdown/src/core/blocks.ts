/**
 * Splitting a document into top-level blocks that can be rendered, and remembered, one by one.
 *
 * A streaming reply grows at its end, and re-rendering the whole of it on every token is work
 * proportional to its length, repeated per token. Cut at its top-level blocks instead, every block
 * but the last is text that no longer changes: a renderer that memoizes each block by its source
 * parses and reconciles only the tail. This is the approach Streamdown takes, with `marked`'s block
 * lexer finding the boundaries.
 *
 * The cut must never change the result, so a block is merged with its neighbours wherever one
 * parse of the whole document would read them together:
 *   - the dialect's forms: a marker-only quote (`> [!STEPS]`) governs the list after it, `[!TABS]`
 *     the run of sections after it, and a `[!PROS]` right before a `[!CONS]` is one pair;
 *   - an image alone in its paragraph and an emphasis-only line under it, its caption;
 *   - an HTML block whose tag is closed further down;
 *   - a `$$` display formula with blank lines inside;
 *   - a document with footnotes or link reference definitions, which resolve across blocks, is
 *     not split at all.
 * The tests render a corpus both ways and require the same markup. And whenever the lexer's
 * pieces do not add up to the input exactly, the document stays one block.
 */
import { Lexer, type Token, type Tokens } from 'marked'
import { parseContainerMarker, type ContainerKind } from '../dialect'

export interface MarkdownBlock {
  /** The block's own source. */
  source: string
  /** Where it starts in the document: characters before it, and its 1-based line. */
  offset: number
  line: number
}

const FOOTNOTE = /\[\^[\w-]{1,200}\]/
const LINK_DEFINITION = /^ {0,3}\[[^\]]+\]:/m
const HTML_OPENER = /^ {0,3}<([A-Za-z][\w:-]*)[\s>/]/
const IMAGE_ONLY = /^!\[[^\]]*\]\([^)]*\)$/
const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'wbr'])

const whole = (markdown: string): MarkdownBlock[] => [{ source: markdown, offset: 0, line: 1 }]

/** The container form a marker-only quote opens, or null for any other token. */
function markerOf(token: Token | undefined): ContainerKind | null {
  if (token?.type !== 'blockquote') return null
  const text = (token as Tokens.Blockquote).text.trim()
  const marker = parseContainerMarker(text)
  return marker && !text.slice(marker.consumed).trim() ? marker.kind : null
}

/** Whether the token opens a quote with content of its own (`> [!PROS]\n> - a`). */
function formWithContent(token: Token | undefined): ContainerKind | null {
  if (token?.type !== 'blockquote') return null
  const text = (token as Tokens.Blockquote).text.trimStart()
  const marker = parseContainerMarker(text)
  return marker && text.slice(marker.consumed).trim() ? marker.kind : null
}

/** Whether an HTML block's first tag is still open at the end of `raw`. */
function htmlOpen(raw: string): boolean {
  const tag = HTML_OPENER.exec(raw)?.[1]?.toLowerCase()
  if (!tag || VOID_TAGS.has(tag)) return false
  const openers = raw.match(new RegExp(`<${tag}(?=[\\s>/])[^>]*>`, 'gi')) ?? []
  const opened = openers.filter((opener) => !opener.endsWith('/>')).length
  const closed = raw.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0
  return opened > closed
}

const doubleDollars = (raw: string) => raw.match(/(?<!\\)\$\$/g)?.length ?? 0

/** Index of the next token that is not blank space, from `from`. */
function nextContent(tokens: Token[], from: number): number {
  let index = from
  while (tokens[index]?.type === 'space') index += 1
  return index
}

/**
 * The index after the tokens a marker quote at `index` governs, read by the same grammar as the
 * remark pass: a list form takes the one list right after it; tabs take the sections from the
 * heading right after it up to a shallower heading, a `---` or the end.
 */
function formEnd(tokens: Token[], index: number, kind: ContainerKind): number {
  const first = nextContent(tokens, index + 1)
  const head = tokens[first]
  if (kind !== 'tabs') return head?.type === 'list' ? first + 1 : index + 1
  if (head?.type !== 'heading') return index + 1
  const depth = (head as Tokens.Heading).depth
  let end = first + 1
  for (; end < tokens.length; end += 1) {
    const token = tokens[end]!
    if (token.type === 'hr') break
    if (token.type === 'heading' && (token as Tokens.Heading).depth < depth) break
  }
  return end
}

/** The verdict kind (`pros`/`cons`) a group of tokens forms, if it is one. */
function verdictOf(tokens: Token[], start: number): 'pros' | 'cons' | null {
  const kind = markerOf(tokens[start]) ?? formWithContent(tokens[start])
  return kind === 'pros' || kind === 'cons' ? kind : null
}

/** The token ranges that must render together, as [start, end) pairs. */
function group(tokens: Token[]): Array<[number, number]> {
  const groups: Array<[number, number]> = []
  let index = 0
  while (index < tokens.length) {
    const start = index
    const kind = markerOf(tokens[index])
    index = kind ? formEnd(tokens, index, kind) : index + 1

    // A pros right before a cons (or the reverse) is set as one pair.
    const verdict = verdictOf(tokens, start)
    if (verdict) {
      const other = nextContent(tokens, index)
      if (verdictOf(tokens, other) === (verdict === 'pros' ? 'cons' : 'pros')) {
        const otherKind = markerOf(tokens[other])
        index = otherKind ? formEnd(tokens, other, otherKind) : other + 1
      }
    }

    // An image alone in its paragraph takes the emphasis line under it as its caption. Merging is
    // always safe (it is what one parse does anyway), so the test here can be loose.
    if (tokens[start]?.type === 'paragraph' && IMAGE_ONLY.test(tokens[start]!.raw.trim())) {
      const next = nextContent(tokens, index)
      if (tokens[next]?.type === 'paragraph' && /^[*_]/.test(tokens[next]!.raw.trimStart()))
        index = next + 1
    }

    // An HTML block whose tag closes further down, and a display formula with blank lines in it.
    const type = tokens[start]?.type
    let raw = tokens
      .slice(start, index)
      .map((token) => token.raw)
      .join('')
    const open = () =>
      type === 'html' ? htmlOpen(raw) : type !== 'code' && doubleDollars(raw) % 2 === 1
    while (index < tokens.length && open()) {
      raw += tokens[index]!.raw
      index += 1
    }

    // Blank space belongs to the block before it.
    while (tokens[index]?.type === 'space') index += 1
    groups.push([start, index])
  }
  return groups
}

export function splitBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown || markdown.includes('\r')) return whole(markdown)
  if (FOOTNOTE.test(markdown) || LINK_DEFINITION.test(markdown)) return whole(markdown)

  const lexer = new Lexer({ gfm: true })
  let tokens: Token[]
  try {
    tokens = lexer.blockTokens(markdown)
  } catch {
    return whole(markdown)
  }
  // A definition the pattern above missed (inside a quote or a list item) still resolves across
  // blocks; and pieces that do not add up to the input cannot be trusted with positions.
  if (Object.keys(lexer.tokens.links).length > 0) return whole(markdown)
  if (tokens.map((token) => token.raw).join('') !== markdown) return whole(markdown)

  const blocks: MarkdownBlock[] = []
  let offset = 0
  let line = 1
  for (const [start, end] of group(tokens)) {
    const source = tokens
      .slice(start, end)
      .map((token) => token.raw)
      .join('')
    blocks.push({ source, offset, line })
    offset += source.length
    for (const character of source) if (character === '\n') line += 1
  }
  return blocks.length > 0 ? blocks : whole(markdown)
}
