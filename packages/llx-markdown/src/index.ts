/**
 * `llx-markdown`: the React renderer.
 *
 *     import { Markdown } from 'llx-markdown'
 *     import 'llx-markdown/styles.css'
 *
 *     <Markdown streaming={!done}>{reply}</Markdown>
 */
export { Markdown, type MarkdownProps } from './react/markdown'
export type { Components } from './react/render'
// The pacing `<Markdown smooth>` uses, for text a page draws itself (a tool's output, a title).
export { useSmoothText } from './react/use-smooth-text'
export type { Highlighter, MarkdownComponents } from './react/context'
export type { StageLoader, StageOption } from './react/use-stage'
export { defaultUrlTransform, type UrlTransform } from './engine/url'
export type { Extension, FenceRule, InlineRule, InlineState, Node } from './engine/types'
export type { MermaidLoader } from './mermaid/loader'
export { DEFAULT_LABELS, type LabelOverrides, type MarkdownLabels } from './react/labels'

// The dialect's own elements, for a page that replaces one and wraps the original.
export { Callout } from './react/callout'
export { Code, CodeBlock } from './react/code-block'
export { Diagram } from './mermaid/diagram'
export { FileTree, type FileTreeProps, type TreeIcon, type TreeRow } from './react/file-tree'
export { Tab, Tabs } from './react/tabs'
export { childrenToText, getLanguage, isCodeBlock } from './react/helpers'

// Headings, for a table of contents beside the document.
export { extractMarkdownHeadings as extractHeadings, type MarkdownHeading } from './core/headings'
