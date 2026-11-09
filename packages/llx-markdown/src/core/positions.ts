import type { Root } from 'mdast'
import type { Point, Position } from 'unist'
import { visit } from 'unist-util-visit'

/**
 * remark: move a block's positions to where the block sits in its document.
 *
 * A block parsed on its own counts from its own first character, so every block would claim
 * offset 0: two task boxes would share a key, two headings an id, and a host that copies a block's
 * Markdown by its position would copy from the wrong place. Shifted, positions mean the same thing
 * however the document was cut (`splitBlocks`).
 */
export function remarkBlockOffset({ offset, line }: { offset: number; line: number }) {
  const shift = (point: Point): Point => ({
    ...point,
    line: point.line + line - 1,
    ...(point.offset === undefined ? {} : { offset: point.offset + offset }),
  })
  return () => (tree: Root) => {
    if (offset === 0 && line === 1) return
    visit(tree, (node) => {
      const position: Position | undefined = node.position
      if (position) node.position = { start: shift(position.start), end: shift(position.end) }
    })
  }
}
