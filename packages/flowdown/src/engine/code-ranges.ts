/**
 * Where a text's code blocks are, read by the parser itself: what the sniffers for HTML and math
 * and the escaper of literal dollars leave alone (`core/prose.ts`). Not an entry's export.
 */
import { parseBlocks } from './blocks'
import { isolated, type InlineContext } from './inlines'

/** No inline rule: only the blocks are read, so none is ever asked. */
const NO_SPECIAL = new Uint8Array(128)

/**
 * The last text read each way and what was found: the sniffers and the escaper ask of the same
 * block, one after another.
 */
const last: Array<{ markdown: string; found: Found } | null> = [null, null]

interface Found {
  code: number[]
  inline: number[]
}

/**
 * The code blocks of `markdown`, fenced or indented, wherever they stand (in a list item, in a
 * quote), and the runs of text read into inlines, where a code span can be: pairs of offsets,
 * from the start of a block's first line to the end of its last. Only the blocks are read, as by
 * `definitions`, with GitHub's extensions. With `mathFences`, `$$` alone on a line fences a
 * formula, as a page that typesets math reads it: a fence inside a formula is its text.
 */
export function codeRanges(markdown: string, mathFences = true): Found {
  const kept = last[mathFences ? 1 : 0]
  if (kept?.markdown === markdown) return kept.found
  const context: InlineContext = {
    refs: new Map(),
    footnotes: new Map(),
    footnoteUses: new Map(),
    gfm: true,
    math: mathFences,
    rules: [],
    special: NO_SPECIAL,
  }
  const found = isolated(() => parseBlocks(markdown, context, 'code')).code ?? {
    code: [],
    inline: [],
  }
  last[mathFences ? 1 : 0] = { markdown, found }
  return found
}
