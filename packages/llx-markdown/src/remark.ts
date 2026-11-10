/**
 * `llx-markdown/remark`: the dialect as a remark plugin, without React or the engine's renderer.
 *
 * For a unified pipeline of your own: a static site build, a renderer that is not React. The
 * dialect becomes ordinary HTML with `llx-` classes and data attributes, which `styles.css` draws;
 * `answer-tabs` / `answer-tab` elements hold the variants of a `[!TABS]` form, for your own tab
 * component. GitHub's syntax is `remark-gfm`'s to read, before this plugin:
 *
 *     unified().use(remarkParse).use(remarkGfm).use(remarkLlx).use(remarkRehype).use(rehypeStringify)
 */
export { remarkAnswerBlocks, remarkAnswerBlocks as remarkLlx } from './core/remark-answer-blocks'
export { sanitizeSchemaFor } from './core/sanitize-schema'
export {
  extractMarkdownHeadings as extractHeadings,
  headingIdsByOffset,
  remarkHeadingIds,
  type MarkdownHeading,
} from './core/headings'
export {
  createBlockSplitter,
  splitBlocks,
  type BlockSplitter,
  type MarkdownBlock,
} from './core/blocks'
export { escapeLiteralDollars, isLiteralDollar } from './core/dollars'
export { hasHtmlSyntax, hasMathSyntax } from './core/syntax'
export { markdownProseWithoutCode } from './core/prose'
export { parseFileTree, type TreeRow } from './core/file-tree-parse'
export * from './dialect'
