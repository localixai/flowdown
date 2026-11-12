import type { Node } from './types'

/**
 * Calls `visitor` on every node of a tree, parents before their children. A visitor that returns
 * a number moves the walk to that place among the node's siblings: how a pass that replaces or
 * removes nodes says where to go on from. Returning `false` leaves the node's children unread.
 */
export type Visitor = (
  node: Node,
  index: number | undefined,
  parent: Node | undefined,
) => number | boolean | void

export const visit = (tree: Node, visitor: Visitor): void => {
  const walk = (node: Node, index: number | undefined, parent: Node | undefined): number | void => {
    const result = visitor(node, index, parent)
    if (result !== false) {
      const children = node.children
      if (children !== undefined) {
        let at = 0
        while (at < children.length) {
          const next = walk(children[at] as Node, at, node)
          at = typeof next === 'number' ? next : at + 1
        }
      }
    }
    if (typeof result === 'number') return result
  }
  walk(tree, undefined, undefined)
}

/** The text of a node and everything under it; an image gives its description. */
export const toText = (node: Node): string => {
  if (node.value !== undefined) return node.value
  if (node.type === 'image') return node.alt ?? ''
  let out = ''
  if (node.children) for (const child of node.children) out += toText(child)
  return out
}
