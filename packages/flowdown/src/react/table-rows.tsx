'use client'
import { createElement, memo, type ReactNode } from 'react'
import type { References } from '../engine/types'
import { draw, type BlockOptions } from './draw'

import { TABLE_ROWS } from '../document/table'

export { tableRows } from '../document/table'

/**
 * A table is one block, and a model that prints results row by row grows it to hundreds of rows:
 * drawn through one parse, every token read and drew the whole table again. A row depends only on
 * the header above it, so the table is drawn as its header and its rows in pieces of {@link TABLE_ROWS};
 * a piece that is complete is parsed and drawn once, and a token redraws only the last piece.
 *
 * Each piece is the header and its own rows through the same parser, so the cells are what one
 * parse of the whole table makes: the same elements, in the same table.
 */

const Children = ({ children }: { children?: ReactNode }) => <>{children}</>
const Nothing = () => null

/** A document's options with the table's own shell taken off: a piece yields its rows alone. */
const parts = new WeakMap<BlockOptions, { head: BlockOptions; body: BlockOptions }>()
function partsOf(options: BlockOptions) {
  let made = parts.get(options)
  if (!made) {
    const { components } = options
    made = {
      head: { ...options, components: { ...components, table: Children, tbody: Nothing } as never },
      body: {
        ...options,
        components: { ...components, table: Children, thead: Nothing, tbody: Children } as never,
      },
    }
    parts.set(options, made)
  }
  return made
}

/** A header with some of its rows, read and drawn once for as long as its text is the same. */
const Piece = memo(function Piece({
  source,
  options,
  refs,
}: {
  source: string
  options: BlockOptions
  refs?: References | undefined
}) {
  return draw(source, 0, null, options, refs)
})

export function TableRows({
  head,
  rows,
  options,
  refs,
}: {
  head: string
  rows: string[]
  /** What the block is read and drawn with. One object per document: a piece compares it. */
  options: BlockOptions
  /** The document's link definitions as the table's block asks them. */
  refs?: References | undefined
}) {
  const { head: headParts, body: bodyParts } = partsOf(options)
  const pieces: ReactNode[] = []
  for (let at = 0; at < rows.length; at += TABLE_ROWS)
    pieces.push(
      <Piece
        key={at}
        source={head + rows.slice(at, at + TABLE_ROWS).join('\n')}
        options={bodyParts}
        refs={refs}
      />,
    )
  return createElement(
    options.components.table as never,
    null,
    <Piece source={head} options={headParts} refs={refs} />,
    <tbody>{pieces}</tbody>,
  )
}
