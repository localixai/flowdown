import type { ReactNode } from 'react'
import { parse } from '../engine'
import type { Extension } from '../engine/types'
import type { UrlTransform } from '../engine/url'
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
  /** The names of a task list's boxes. */
  labels?: RenderOptions['labels']
}

/** One text read and drawn: a whole document, or one of its blocks. */
export function draw(
  source: string,
  offset: number,
  headingIds: ReadonlyMap<number, string> | null,
  options: BlockOptions,
): ReactNode {
  return render(parse(source, { extensions: options.extensions }), {
    components: options.components,
    urlTransform: options.urlTransform,
    special: options.special,
    labels: options.labels,
    offset,
    headingIds,
  })
}
