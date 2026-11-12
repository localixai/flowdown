/**
 * `flowdown/static`: Markdown as HTML text, without React or a browser.
 *
 *     import { renderToHtml } from 'flowdown/static'
 *
 *     const html = renderToHtml(reply)
 *
 * The elements are the ones `<Markdown>` draws, class for class, so `flowdown/styles.css`
 * draws them the same: for a server that sends a page, a static site, an e-mail, a test. Nothing
 * on it is alive: tabs show their first variant and a code block's buttons do nothing until a
 * renderer for the page takes it over (`flowdown/dom`).
 *
 * `streaming: true` completes a reply that is still arriving, for a server that sends the page as
 * the model writes it.
 */
import { createView, type ViewOptions } from '../render/view'
import { toHtml } from '../render/vnode'

export type { ViewComponents } from '../render/view'
export { escapeHtml, toHtml, type VComponent, type VElement, type VNode } from '../render/vnode'
export { DEFAULT_LABELS, type LabelOverrides, type MarkdownLabels } from '../render/labels'
export type { Highlighter } from '../render/views'
export { defaultUrlTransform, type UrlTransform } from '../engine/url'
export type { Extension, Node } from '../engine/types'

export interface StaticOptions extends Omit<ViewOptions, 'host'> {
  /** The text is a reply still arriving: its unfinished end is completed. */
  streaming?: boolean
}

/** `markdown` as the HTML `<Markdown>` draws, root element and all. */
export function renderToHtml(markdown: string, options: StaticOptions = {}): string {
  return toHtml(createView(options).render(markdown, options.streaming ?? false))
}
