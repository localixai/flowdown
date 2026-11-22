/**
 * `@localix-ai/flowdown/document`: a Markdown text as the blocks a renderer draws, kept up while it grows.
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
import { continues, type Grown } from '../core/continues'
import { createFenceScanner } from '../core/fence-scan'
import { healProse } from '../core/heal'
import { keepGrown } from './grown'
import { createReferences } from './references'

export { splitBlocks, isFenceBlock, type MarkdownBlock, type SplitOptions } from '../core/blocks'
export { growingFence, createFenceMemory, type FenceMemory, type GrowingFence } from './fence'
export { grownOf } from './grown'
export type { Grown } from '../core/continues'
export { tableRows, type TableRows } from './table'
/**
 * The dialect for `parse` of `@localix-ai/flowdown/engine`, and what it marked a node as: a target of your
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

export interface DocumentOptions {
  /**
   * The renderer passes each block's `refs` to `parse`. A document with link reference
   * definitions is then cut into blocks like any other, each block finding the definitions of the
   * others; without it such a document is one block, read whole on every update.
   */
  refs?: boolean
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
export function createDocument({ refs = false }: DocumentOptions = {}): MarkdownDocument {
  // The scan and the split are this document's own: another reply streaming beside it does not
  // make either start over.
  const openFence = createFenceScanner()
  const splitter = createBlockSplitter({ refs })
  const references = refs ? createReferences() : null
  let last: {
    text: string
    streaming: boolean
    math: boolean
    headingIds: boolean
    state: DocumentState
  } | null = null
  /** The last block of the last update, when its source is the end of that update's text. */
  let end: MarkdownBlock | null = null
  /** The text the last update split, and how much of it is that update's text as it was. */
  let split = { text: '', kept: 0 }

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
      // The one comparison of the reply with the last one this update makes: each part below
      // that remembers the last text compares only what is past it.
      const grown: Grown | null =
        last !== null && continues(text, last.text, last.text.length)
          ? { previous: last.text, same: last.text.length }
          : null
      // Inside a fence left open, the reply is read as it is and the line that closes the fence
      // goes to the last block beside its text: joined here, every token would copy the reply.
      const fence = streaming ? openFence(text, grown) : null
      const closer = fence ? `${text.endsWith('\n') ? '' : '\n'}${fence.indent}${fence.marker}` : ''
      const healing = streaming && !fence ? healProse(text) : { text, kept: text.length }
      const healed = healing.text
      // What was checked is of the text: it holds for what is split up to where either the text
      // or the last one was healed.
      const whole: Grown | null = grown && {
        previous: split.text,
        same: Math.min(grown.same, healing.kept, split.kept),
      }
      split = { text: healed, kept: healing.kept }
      // Blocks that did not change come back as the same objects, and everything worked out
      // from a block is kept beside it.
      const cut = splitter.split(healed, whole)
      // Literal dollars are escaped only where `$` can mean math: elsewhere positions stay exact.
      const escaped = math ? cut.map(escapedBlock) : cut
      // Each block that may refer to a link definition gets the document's, from the text as it
      // will be parsed.
      const blocks = references ? references.resolve(escaped, math) : escaped
      // The last block, when its source is the end of the text: the next update can say how much
      // of it still reads the same.
      const tail = blocks.at(-1)
      const own = tail !== undefined && tail.source === cut.at(-1)?.source
      if (own && whole && end !== null && end.offset === tail.offset && whole.same > tail.offset)
        keepGrown(tail, { previous: end.source, same: whole.same - tail.offset })
      end = own ? tail : null
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
