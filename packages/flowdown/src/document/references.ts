/**
 * Link reference definitions across the blocks of a document.
 *
 * `[text][label]` in one block finds `[label]: url` in another, so a document read block by block
 * needs every block parsed with the definitions of all of them. Here they are collected, from each
 * block once, and handed to the blocks that may refer to one as `refs`, which `parse` takes.
 *
 * A renderer draws a block again when it is another object. So a block is handed out as a new
 * object exactly when what it was told changed: each `refs` remembers the labels its block asked
 * for and what it was answered, and only a block whose answers are no longer the document's is
 * made anew. A definition that arrives in a streaming reply redraws the blocks that use it, and no
 * other.
 */
import { isFenceBlock, type MarkdownBlock } from '../core/blocks'
import { definitions } from '../engine'
import type { Reference, References } from '../engine/types'

type Defined = ReadonlyMap<string, Reference>

const NONE: Defined = new Map()

/** A block as it is handed out, and what its parse was told so far. */
interface Told {
  block: MarkdownBlock
  answers: Map<string, Reference | undefined>
}

export interface DocumentReferences {
  /**
   * The blocks with the document's definitions beside each that may refer to one. A block whose
   * references read as they did is the same object as last time. `mathFences` says whether the
   * renderer reads `$$` as the fence of a formula: a definition written inside one is not one.
   */
  resolve(blocks: readonly MarkdownBlock[], mathFences: boolean): MarkdownBlock[]
}

export function createReferences(): DocumentReferences {
  /** The document's definitions: the first of each label, in the order of the blocks. */
  let current = new Map<string, Reference>()
  let math = false
  let defined = new WeakMap<MarkdownBlock, Defined>()
  const told = new WeakMap<MarkdownBlock, Told>()
  /** The blocks of the last update, what each defined, and what was handed out for each. */
  let before: readonly MarkdownBlock[] = []
  let owned: Defined[] = []
  let handed: MarkdownBlock[] = []

  const definedIn = (block: MarkdownBlock): Defined => {
    let own = defined.get(block)
    if (own === undefined) {
      // A definition has `]:` in it, and code has none to give.
      own =
        isFenceBlock(block) || !block.source.includes(']:')
          ? NONE
          : definitions(block.source, { mathFences: math })
      if (own.size === 0) own = NONE
      defined.set(block, own)
    }
    return own
  }

  const tell = (block: MarkdownBlock): Told => {
    const answers = new Map<string, Reference | undefined>()
    const refs: References = {
      get(label) {
        const found = current.get(label)
        answers.set(label, found)
        return found
      },
    }
    return { block: { ...block, refs }, answers }
  }

  return {
    resolve(blocks, mathFences) {
      if (mathFences !== math) {
        math = mathFences
        defined = new WeakMap()
        before = []
        owned = []
      }
      // What each block defines; only a block that is new is read.
      const owns: Defined[] = []
      let moved = blocks.length < before.length
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index]!
        const own = before[index] === block ? owned[index]! : definedIn(block)
        if (own !== (owned[index] ?? NONE)) moved = true
        owns.push(own)
      }
      let changed = false
      if (moved) {
        const next = new Map<string, Reference>()
        for (const own of owns)
          for (const [label, reference] of own) if (!next.has(label)) next.set(label, reference)
        changed = next.size !== current.size
        for (const [label, reference] of next) {
          const was = current.get(label)
          // The same definition read again (its block grew) is the same answer.
          if (was && was.url === reference.url && was.title === reference.title)
            next.set(label, was)
          else changed = true
        }
        if (changed) current = next
      }
      const out: MarkdownBlock[] = []
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index]!
        if (!changed && before[index] === block) {
          out.push(handed[index]!)
          continue
        }
        // Only a `[` can refer to a definition, and code refers to none.
        if (isFenceBlock(block) || !block.source.includes('[')) {
          out.push(block)
          continue
        }
        let known = told.get(block)
        if (known !== undefined && changed) {
          for (const [label, answer] of known.answers) {
            if (current.get(label) === answer) continue
            known = undefined
            break
          }
        }
        if (known === undefined) told.set(block, (known = tell(block)))
        out.push(known.block)
      }
      before = blocks
      owned = owns
      handed = out
      return out
    },
  }
}
