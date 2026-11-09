import type { Root } from 'mdast'
import type { Point, Position } from 'unist'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

declare module 'vfile' {
  interface DataMap {
    /** Where the block being parsed sits in its document (`remarkBlockOffset`). */
    llx: { offset: number; line: number }
  }
}

/**
 * remark: move a block's positions to where the block sits in its document.
 *
 * A block parsed on its own counts from its own first character, so every block would claim
 * offset 0: two task boxes would share a key, two headings an id, and a host that copies a block's
 * Markdown by its position would copy from the wrong place. Shifted, positions mean the same thing
 * however the document was cut (`splitBlocks`). The block's place is also left on the file
 * (`file.data.llx`), so a later plugin can slice a node's Markdown out of the block's text.
 */
export function remarkBlockOffset({ offset, line }: { offset: number; line: number }) {
  const shift = (point: Point): Point => ({
    ...point,
    line: point.line + line - 1,
    ...(point.offset === undefined ? {} : { offset: point.offset + offset }),
  })
  return () => (tree: Root, file: VFile) => {
    file.data.llx = { offset, line }
    if (offset === 0 && line === 1) return
    visit(tree, (node) => {
      const position: Position | undefined = node.position
      if (position) node.position = { start: shift(position.start), end: shift(position.end) }
    })
  }
}
