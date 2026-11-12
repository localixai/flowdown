/**
 * `flowdown/document`: a Markdown text as the blocks a renderer draws, kept up while it grows.
 *
 * This is the part of streaming that belongs to no renderer. A reply arrives a few characters at a
 * time; each update the text is completed where it stops mid-construct, cut into its top-level
 * blocks, and the blocks that did not change are handed back as the very same objects. A renderer
 * for any target (React, the DOM, a terminal) then draws a block once and, on the next token,
 * only the last one again:
 *
 *     const document = createDocument()
 *     for await (const text of reply) {
 *       const { blocks } = document.update(text, { streaming: true })
 *       // draw the blocks that are new objects; the rest are already on the page
 *     }
 *     document.update(text) // the finished reply: nothing is completed any more
 */
import {
  blockHasHtml,
  blockHasMath,
  blockHasRareEntity,
  escapedBlock,
  headingIdsOfBlocks,
} from '../core/block-facts'
import { createBlockSplitter, normalizeLineEndings, type MarkdownBlock } from '../core/blocks'
import { createFenceScanner } from '../core/fence-scan'
import { closePartialProse } from '../core/heal'

export { splitBlocks, isFenceBlock, type MarkdownBlock } from '../core/blocks'
export { growingFence, createFenceMemory, type FenceMemory, type GrowingFence } from './fence'
export { tableRows, type TableRows } from './table'
/**
 * The dialect for `parse` of `flowdown/engine`, and what it marked a node as: a target of your
 * own passes `extensions: [flowdownDialect]` and switches on `formOf(node)?.form`.
 */
export { flowdownDialect } from '../core/remark-answer-blocks'
export { formOf, type Form, type FormName } from '../core/forms'

export interface UpdateOptions {
  /** The text is a reply still arriving: its unfinished end is completed. */
  streaming?: boolean
  /** The renderer typesets `$…$`: a literal dollar (`$5`) is escaped so it is not read as one. */
  math?: boolean
  /** Work out an id for every heading, numbered across the document (`setup`, `setup-1`). */
  headingIds?: boolean
}

export interface DocumentState {
  /**
   * The document's top-level blocks, in order. A block that reads the same as at the last update
   * is the same object: compare by identity to know what to draw again.
   */
  blocks: readonly MarkdownBlock[]
  /**
   * The line that closes the code fence the text ends inside, or ''. It belongs after the last
   * block's source and is kept beside it, not joined: a long fence is then not copied on every
   * token. A renderer reads the last block as `source + closer`.
   */
  closer: string
  /** Whether the text ends inside a code fence that is still being written. */
  growing: boolean
  /** Each block's heading ids, by where the heading starts in the document; null when not asked for. */
  headingIds: ReadonlyArray<ReadonlyMap<number, string>> | null
}

export interface MarkdownDocument {
  /** The document for `text`. The same text and options give back the same state object. */
  update(text: string, options?: UpdateOptions): DocumentState
}

/** Whether any block has a formula: a renderer that loads its typesetter on demand asks this. */
export const usesMath = (blocks: readonly MarkdownBlock[]): boolean => blocks.some(blockHasMath)

/** Whether any block has raw HTML in its prose. */
export const usesHtml = (blocks: readonly MarkdownBlock[]): boolean => blocks.some(blockHasHtml)

/** Whether any block names a character reference outside the common ones (`&nrarr;`). */
export const usesRareEntity = (blocks: readonly MarkdownBlock[]): boolean =>
  blocks.some(blockHasRareEntity)

/**
 * One document that is drawn more than once: a reply while it streams, a text being edited. It
 * remembers the blocks it cut, so an update costs the end of the text, not the text.
 */
export function createDocument(): MarkdownDocument {
  // The scan and the split are this document's own: another reply streaming beside it does not
  // make either start over.
  const openFence = createFenceScanner()
  const splitter = createBlockSplitter()
  let last: {
    text: string
    streaming: boolean
    math: boolean
    headingIds: boolean
    state: DocumentState
  } | null = null

  return {
    update(input, { streaming = false, math = false, headingIds = false } = {}) {
      // `\r\n` from a Windows file or a server that sends it reads as `\n` everywhere below.
      const text = normalizeLineEndings(input)
      if (
        last !== null &&
        last.text === text &&
        last.streaming === streaming &&
        last.math === math &&
        last.headingIds === headingIds
      )
        return last.state
      // Inside a fence left open, the reply is read as it is and the line that closes the fence
      // goes to the last block beside its text: joined here, every token would copy the reply.
      const fence = streaming ? openFence(text) : null
      const closer = fence ? `${text.endsWith('\n') ? '' : '\n'}${fence.marker}` : ''
      const healed = streaming && !fence ? closePartialProse(text) : text
      // Blocks that did not change come back as the same objects, and everything worked out
      // from a block is kept beside it.
      const cut = splitter.split(healed)
      // Literal dollars are escaped only where `$` can mean math: elsewhere positions stay exact.
      const blocks = math ? cut.map(escapedBlock) : cut
      const state: DocumentState = {
        blocks,
        closer,
        growing: fence !== null,
        headingIds: headingIds ? headingIdsOfBlocks(blocks) : null,
      }
      last = { text, streaming, math, headingIds, state }
      return state
    },
  }
}
