/**
 * The fields the dialect's passes write on a node: what it is (`flowdown`, `forms.ts`), and, lowered to
 * HTML, the element it is drawn as and its properties. (With remark those two come from
 * `mdast-util-to-hast`; the engine's own trees carry the same.)
 */
// The import makes this file a module, so the block below adds to mdast's types.
// oxlint-disable-next-line import/no-unassigned-import
import 'mdast'
import type { Form } from './forms'

declare module 'mdast' {
  interface Data {
    flowdown?: Form
    hName?: string
    hProperties?: Record<string, unknown>
  }
}
