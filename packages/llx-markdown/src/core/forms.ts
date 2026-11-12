/**
 * What the dialect says a node IS, apart from how any target draws it.
 *
 * A pass of the dialect marks nodes with a {@link Form} (`data.llx`): this list is a timeline,
 * this quote a warning, this paragraph the head of a step. A target reads the mark and draws the
 * node its own way: a terminal prints a callout as a coloured bar, a page as an `<aside>`. What a
 * form is in HTML is one table (`forms-html.ts`), handed to the pass by whoever wants HTML: the
 * pass itself names no element and no class.
 *
 * A target that does not know a form draws the node as the Markdown it still is (a list, a quote,
 * a paragraph), so a form added later reads as text everywhere before any target learns it.
 */
import type { CalloutKind } from '../dialect'

/** Every mark the dialect makes. A name is its own contract: targets switch on it. */
export type FormName =
  | 'callout'
  | 'quote-source'
  | 'figure'
  | 'caption'
  | 'section-number'
  | 'code'
  | 'form'
  | 'steps'
  | 'steps-title'
  | 'step-head'
  | 'step-title'
  | 'step-meta'
  | 'step-body'
  | 'stats'
  | 'stats-title'
  | 'stat'
  | 'stat-value'
  | 'stat-label'
  | 'sources'
  | 'sources-title'
  | 'source'
  | 'source-title'
  | 'source-host'
  | 'source-note'
  | 'tabs'
  | 'tabs-title'
  | 'tab'
  | 'verdict'
  | 'verdict-title'
  | 'verdict-list'
  | 'verdicts'
  | 'details'
  | 'summary'

export interface Form {
  form: FormName
  /** A callout's kind (`warning`), or which side a verdict argues (`pros`, `cons`). */
  kind?: CalloutKind | 'pros' | 'cons'
  /** The title the author wrote: on a callout, and the file a code fence names. */
  title?: string
  /** A tab's label. */
  label?: string
}

/** A node's fields besides its own: what a pass has written on it. */
export type NodeData = Record<string, unknown> & { llx?: Form }

/**
 * What a form is in one target's own terms, as fields to put on the node beside the mark. `data`
 * is what the node carried before, for a lowering that adds to it.
 */
export type Lowering = (form: Form, data: NodeData | undefined) => Record<string, unknown>

let lowering: Lowering | null = null

/** Runs a pass with `lower` applied to every node it marks. A pass is synchronous. */
export function lowered<T>(lower: Lowering | null, pass: () => T): T {
  const before = lowering
  lowering = lower
  try {
    return pass()
  } finally {
    lowering = before
  }
}

/** A node's data with `form` marked on it. Without `data`, the mark is all the node carries. */
export const marked = <D extends object>(form: Form, data?: D): D & { llx: Form } =>
  ({ ...data, llx: form, ...lowering?.(form, data as NodeData | undefined) }) as D & { llx: Form }

/** The form a node was marked with, if any. */
export const formOf = (node: { data?: unknown } | undefined): Form | undefined =>
  (node?.data as NodeData | undefined)?.llx
