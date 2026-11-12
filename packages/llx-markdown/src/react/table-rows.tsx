'use client'
import { createElement, memo, type ReactNode } from 'react'
import { draw, type BlockOptions } from './draw'

export { tableRows } from '../document/table'

/**
 * A table is one block, and a model that prints results row by row grows it to hundreds of rows:
 * drawn through one parse, every token read and drew the whole table again. A row depends only on
 * the header above it, so the table is drawn as its header and its rows in pieces of {@link ROWS};
 * a piece that is complete is parsed and drawn once, and a token redraws only the last piece.
 *
 * Each piece is the header and its own rows through the same parser, so the cells are what one
 * parse of the whole table makes: the same elements, in the same table.
 */
const ROWS = 16

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
const Piece = memo(function Piece({ source, options }: { source: string; options: BlockOptions }) {
  return draw(source, 0, null, options)
})

export function TableRows({
  head,
  rows,
  options,
}: {
  head: string
  rows: string[]
  /** What the block is read and drawn with. One object per document: a piece compares it. */
  options: BlockOptions
}) {
  const { head: headParts, body: bodyParts } = partsOf(options)
  const pieces: ReactNode[] = []
  for (let at = 0; at < rows.length; at += ROWS)
    pieces.push(
      <Piece key={at} source={head + rows.slice(at, at + ROWS).join('\n')} options={bodyParts} />,
    )
  return createElement(
    options.components.table as never,
    null,
    <Piece source={head} options={headParts} />,
    <tbody>{pieces}</tbody>,
  )
}
