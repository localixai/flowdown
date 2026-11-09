/**
 * `llx-markdown/html`: raw HTML in Markdown (`<details>`, `<kbd>`, a README's `<p align>`),
 * parsed and then sanitized.
 *
 * Its own entry because the HTML parser behind it (parse5, through rehype-raw) is a third of
 * what the renderer would otherwise weigh, and most replies hold no HTML at all. `<Markdown>`
 * fetches it by itself the first time a document holds HTML; pass it directly where the HTML
 * must be in the first render, as on a server:
 *
 *     import { html } from 'llx-markdown/html'
 *     <Markdown html={html}>{readme}</Markdown>
 */
import rehypeRaw from 'rehype-raw'
import type { HtmlPlugin } from '../core/pipeline'

export type { HtmlPlugin } from '../core/pipeline'

export const html: HtmlPlugin = { rehypePlugins: [rehypeRaw] }

export default html
