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

/** Where a run of blocks starts: the characters and the 1-based line before it. */
interface Origin {
  offset: number
  line: number
}

/**
 * The blocks of `text`, which starts at `origin` in its document, or null when the lexer's pieces
 * cannot be trusted with positions (they do not add up to the text, or a link definition, which
 * resolves across blocks, is among them).
 */
function cut(text: string, origin: Origin): MarkdownBlock[] | null {
  const lexer = new Lexer({ gfm: true })
  let tokens: Token[]
  try {
    tokens = lexer.blockTokens(text)
  } catch {
    return null
  }
  if (Object.keys(lexer.tokens.links).length > 0) return null
  if (!addsUp(tokens, text)) return null

  const blocks: MarkdownBlock[] = []
  let { offset, line } = origin
  for (const [start, end] of group(tokens)) {
    const source = tokens
      .slice(start, end)
      .map((token) => token.raw)
      .join('')
    blocks.push({ source, offset, line })
    offset += source.length
    for (let at = source.indexOf('\n'); at !== -1; at = source.indexOf('\n', at + 1)) line += 1
  }
  return blocks
}

/**
 * Whether the tokens' pieces add up to `text`. A text that ends in spaces is the one known
 * exception: `marked` gives the last token a newline for them (`- item ` becomes `- item\n`), so
 * a reply mid-stream would lose its blocks after almost every word. The last token then takes the
 * text's own end; every block is parsed from its own source, so nothing else changes.
 */
function addsUp(tokens: Token[], text: string): boolean {
  const joined = tokens.map((token) => token.raw).join('')
  if (joined === text) return true
  const last = tokens.at(-1)
  if (!last) return false
  const start = joined.length - last.raw.length
  const end = text.slice(start)
  if (end.trimEnd() !== last.raw.trimEnd() || !text.startsWith(joined.slice(0, start))) return false
  last.raw = end
  return true
}

/** Whether a document must stay one block: something in it resolves across blocks. */
const unsplittable = (markdown: string) =>
  markdown.includes('\r') || FOOTNOTE.test(markdown) || LINK_DEFINITION.test(markdown)

/** The top-level blocks of a document, cut where one parse of the whole would not join them. */
/**
 * Line endings as the lexer reads them. Marked turns `\r\n` and `\r` into `\n` in the tokens it
 * returns, so a source with them no longer lines up with its tokens and could not be cut. Offsets
 * of the blocks are into the normalized text, which is what the renderer draws from.
 */
export const normalizeLineEndings = (markdown: string): string =>
  markdown.includes('\r') ? markdown.replace(/\r\n?/g, '\n') : markdown

export function splitBlocks(input: string): MarkdownBlock[] {
  const markdown = normalizeLineEndings(input)
  if (!markdown || unsplittable(markdown)) return whole(markdown)
  const blocks = cut(markdown, { offset: 0, line: 1 })
  return blocks && blocks.length > 0 ? blocks : whole(markdown)
}

/**
 * How many blocks at the end are lexed again. Text appended to a document can change only the
 * group it is appended to, and that group can join the one before it (a `[!CONS]` arriving
 * under a `[!PROS]`); every group above those two is final.
 */
const REOPENED = 2

export interface BlockSplitter {
  /** The same blocks as `splitBlocks(markdown)`; the ones that did not change are the same objects. */
  split(markdown: string): MarkdownBlock[]
  /** Characters handed to the lexer so far: the work the splitter has done. */
  readonly lexed: number
}

/**
 * `splitBlocks` for a document that grows at its end, as a streaming reply does. It remembers the
 * blocks it cut last time: when the new text still starts with all of them but the last two, it
 * keeps those, as the very same objects, and lexes only the rest. Any other text (a reply that was
 * regenerated, or edited above its end) is split afresh. Each update then costs the length of
 * the reply's end, not of the reply: a stream is linear in its length, not quadratic.
 */
export function createBlockSplitter(): BlockSplitter {
  let text = ''
  let blocks: MarkdownBlock[] = []
  let lexed = 0

  const fresh = (markdown: string): MarkdownBlock[] => {
    lexed += markdown.length
    return splitBlocks(markdown)
  }

  return {
    get lexed() {
      return lexed
    },
    split(input) {
      const markdown = normalizeLineEndings(input)
      let next: MarkdownBlock[] | null = null
      const kept = blocks.slice(0, Math.max(0, blocks.length - REOPENED))
      const last = kept.at(-1)
      const end = last ? last.offset + last.source.length : 0
      if (
        last &&
        markdown.length >= end &&
        markdown.startsWith(text.slice(0, end)) &&
        // What is kept was checked when it arrived; only the rest can bring a footnote now.
        !unsplittable(markdown.slice(end))
      ) {
        const tail = markdown.slice(end)
        lexed += tail.length
        let line = last.line
        for (let at = last.source.indexOf('\n'); at !== -1; at = last.source.indexOf('\n', at + 1))
          line += 1
        const rest = tail ? cut(tail, { offset: end, line }) : []
        if (rest) next = [...kept, ...rest]
      }
      next ??= fresh(markdown)
      // A document kept whole is not remembered: it has no final blocks to keep.
      const remembered = next.length > 1 || (next[0]?.source ?? '') !== markdown
      text = markdown
      blocks = remembered ? next : []
      return next
    },
  }
}
