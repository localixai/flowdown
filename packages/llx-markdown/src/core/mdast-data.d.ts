/**
 * The fields the dialect's passes write on a node: the element it is drawn as and its properties.
 * (With remark these come from `mdast-util-to-hast`; the engine's own trees carry the same two.)
 */
// The import makes this file a module, so the block below adds to mdast's types.
// oxlint-disable-next-line import/no-unassigned-import
import 'mdast'

declare module 'mdast' {
  interface Data {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}
