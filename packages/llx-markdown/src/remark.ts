/**
 * `llx-markdown/remark`: the dialect as unified plugins, without React.
 *
 * For a renderer other than `<Markdown>`: react-markdown with your own components, a server that
 * renders HTML with rehype-stringify, a static site build. The dialect becomes ordinary HTML with
 * `llx-` classes and data attributes, which `styles.css` draws; `answer-tabs` / `answer-tab`
 * elements hold the variants of a `[!TABS]` form, for your own tab component.
 *
 *     unified().use(remarkParse).use(remarkLlx).use(remarkRehype).use(rehypeStringify)
 */
export { remarkAnswerBlocks } from './core/remark-answer-blocks'
export {
  rehypePluginsFor,
  rehypeTaskKeys,
  remarkLlx,
  remarkPluginsFor,
  sanitizeSchema,
  type MathPlugin,
  type PipelineOptions,
} from './core/pipeline'
export {
  extractMarkdownHeadings as extractHeadings,
  headingIdsByOffset,
  rehypeHeadingIds,
  remarkHeadingIds,
  type MarkdownHeading,
} from './core/headings'
export { splitBlocks, type MarkdownBlock } from './core/blocks'
export { remarkBlockOffset } from './core/positions'
export { escapeLiteralDollars, isLiteralDollar } from './core/dollars'
export { hasHtmlSyntax, hasMathSyntax } from './core/syntax'
export { markdownProseWithoutCode } from './core/prose'
export { parseFileTree, type TreeRow } from './core/file-tree-parse'
export * from './dialect'
