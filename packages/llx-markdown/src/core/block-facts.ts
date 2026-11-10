/**
 * What a renderer needs to know about each block, worked out once per block.
 *
 * The splitter hands back the blocks that did not change as the same objects, so anything
 * computed from a block's text can be kept beside it: on the next token only the reply's end is
 * scanned again. Each answer is the one a scan of the whole document gives, because every
 * construct these scans look for lies inside one top-level block (a document where something
 * resolves across blocks, footnotes or link definitions, is never split).
 */
import { hasRareEntity } from '../engine/entities'
import { isFenceBlock, type MarkdownBlock } from './blocks'
import { escapeLiteralDollars } from './dollars'
import { headingBases } from './headings'
import { hasHtmlSyntax, hasMathSyntax } from './syntax'

function remembered<T>(compute: (block: MarkdownBlock) => T) {
  const cache = new WeakMap<MarkdownBlock, T>()
  return (block: MarkdownBlock): T => {
    if (cache.has(block)) return cache.get(block) as T
    const value = compute(block)
    cache.set(block, value)
    return value
  }
}

/** A fence whose language is `math`: a display formula, as GitHub writes one. */
const MATH_FENCE = /(?:^|\n) {0,3}(?:`{3,}|~{3,})[ \t]*math[ \t]*(?:\n|$)/

/**
 * Whether the block has a formula. A block that is one fenced code block has no prose to look in
 * (only its opening line says whether it is a formula): a long fence that is still streaming is
 * not scanned again on every token.
 */
export const blockHasMath = remembered((block) =>
  isFenceBlock(block)
    ? MATH_FENCE.test(block.source.slice(0, 40))
    : hasMathSyntax(block.source) || MATH_FENCE.test(block.source),
)

/** Whether the block names a character reference outside the common ones (`&nrarr;`). */
export const blockHasRareEntity = remembered(
  (block) => !isFenceBlock(block) && block.source.includes('&') && hasRareEntity(block.source),
)

/** Whether the block has raw HTML in its prose. */
export const blockHasHtml = remembered(
  (block) => !isFenceBlock(block) && hasHtmlSyntax(block.source),
)

/**
 * The block with its literal dollars escaped (`$5`), for a page that typesets `$…$`. The same
 * block always gives back the same object, so a memoized renderer still skips it.
 */
export const escapedBlock = remembered((block): MarkdownBlock => {
  if (isFenceBlock(block)) return block
  const source = escapeLiteralDollars(block.source)
  return source === block.source ? block : { ...block, source }
})

/** The headings in a block: where each starts in it, and the text its id is made from. */
const blockHeadings = remembered((block) =>
  !isFenceBlock(block) && (block.source.includes('#') || /\n *(=+|-+) *(\n|$)/.test(block.source))
    ? headingBases(block.source)
    : [],
)

/**
 * Every heading's id across the blocks, keyed by where it starts in the document, numbered in
 * document order (the second `## Setup` is `setup-1`) just as one parse of the whole would.
 * Returned per block, so a block is handed only its own anchors.
 */
export function headingIdsOfBlocks(blocks: readonly MarkdownBlock[]): Array<Map<number, string>> {
  const used = new Set<string>()
  return blocks.map((block) => {
    const ids = new Map<number, string>()
    for (const { offset, base } of blockHeadings(block)) {
      let id = base
      let suffix = 1
      while (used.has(id)) id = `${base}-${suffix++}`
      used.add(id)
      ids.set(block.offset + offset, id)
    }
    return ids
  })
}
