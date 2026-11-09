/**
 * `llx-markdown/math`: `$…$` and `$$…$$` typeset with KaTeX.
 *
 * Its own entry so that only a page that imports it bundles KaTeX (a quarter of a megabyte). Pass
 * it to `<Markdown math={…}>` directly, or as a loader so it is fetched the first time a document
 * holds a formula:
 *
 *     <Markdown math={() => import('llx-markdown/math')}>
 *
 * KaTeX's stylesheet is the page's to add (`import 'katex/dist/katex.min.css'`): a bundler-only
 * CSS import inside a library breaks the hosts that do not run one.
 */
import remarkMath from 'remark-math'
import type { MathPlugin } from '../core/pipeline'
import rehypeMathCached from './rehype-math-cached'

export type { MathPlugin } from '../core/pipeline'
export { typesetMath } from './rehype-math-cached'

export const math: MathPlugin = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeMathCached],
}

export default math
