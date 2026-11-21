/**
 * What a document checked of its last block: up to `same`, its source reads as the source of the
 * last block of the update before. A renderer that remembers a growing block (a fence, a long
 * list or quote) hands it to what reads the block, which then compares only what is past it.
 */
import type { MarkdownBlock } from '../core/blocks'
import type { Grown } from '../core/continues'

const grown = new WeakMap<MarkdownBlock, Grown>()

/** What the document checked of this block, when it is the last one of an update; else null. */
export const grownOf = (block: MarkdownBlock): Grown | null => grown.get(block) ?? null

/** Kept by the document for its last block. */
export const keepGrown = (block: MarkdownBlock, checked: Grown): void => {
  grown.set(block, checked)
}
