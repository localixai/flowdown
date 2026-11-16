import type { ReactNode } from 'react'
import { parse } from '../engine'
import type { Extension, Node, References } from '../engine/types'
import type { UrlTransform } from '../engine/url'
import type { KeptNode } from '../render/tree'
import { render, type Components, type RenderOptions } from './render'

/** What a block needs besides its text; one object per document, so blocks can compare it. */
export interface BlockOptions {
  components: Components
  /** The syntax every block is read with: the dialect, the stages that are there, the page's. */
  extensions: Extension[]
  urlTransform: UrlTransform
  special: RenderOptions['special']
  /** The page draws code itself (`components.pre` or `.code`): a growing fence goes to it too. */
  ownCode: boolean
  /** The page draws tables itself, or its extensions read them: a table is then parsed whole. */
  ownTable: boolean
  /** The page's extensions may read a list whole: a long list is then parsed whole. */
  ownList: boolean
  /** The names of a task list's boxes. */
  labels?: RenderOptions['labels']
}

/** A tree drawn, read already: a long list read in pieces (`document/list.ts`). */
export function drawTree(
  tree: Node,
  offset: number,
  headingIds: ReadonlyMap<number, string> | null,
  options: BlockOptions,
  /** What was drawn last, kept by the block for as long as it draws the same way. */
  kept?: WeakMap<Node, KeptNode<ReactNode>>,
): ReactNode {
  return render(tree, {
    components: options.components,
    urlTransform: options.urlTransform,
    special: options.special,
    labels: options.labels,
    offset,
    headingIds,
    kept,
  })
}

/** One text read and drawn: a whole document, or one of its blocks. */
export function draw(
  source: string,
  offset: number,
  headingIds: ReadonlyMap<number, string> | null,
  options: BlockOptions,
  /** The link definitions of the document the text is a block of. */
  refs?: References | undefined,
): ReactNode {
  return render(parse(source, { extensions: options.extensions, refs }), {
    components: options.components,
    urlTransform: options.urlTransform,
    special: options.special,
    labels: options.labels,
    offset,
    headingIds,
  })
}
