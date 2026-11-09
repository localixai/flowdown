/**
 * `llx-markdown/stream`: completing a reply that is still arriving, without React.
 *
 * `<Markdown streaming>` applies it already; it is here for a renderer of your own, or a server
 * that sends partial HTML. `closePartialMarkdown` completes the constructs a streamed text ends
 * inside (a fence, `**bold`, a link, a formula, a half-typed marker) so the partial reply renders
 * the way the finished one will instead of flashing raw syntax. Apply it while the text grows,
 * never to the final text.
 */
export { closePartialMarkdown, isGrowingFence, openFenceBody } from './core/heal'
export { splitBlocks, type MarkdownBlock } from './core/blocks'
