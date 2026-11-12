/**
 * Plain elements (`render/vnode.ts`) put on a page and kept up to date.
 *
 * What was drawn last is compared with what is drawn now, and only the difference touches the
 * page. Two elements that are the very same object are not looked into: a view hands back a block
 * that did not change as the same elements, so a token of a streaming reply costs its last block.
 *
 * The page is compared with nothing: what a reader changed on it by hand (a selection, a scroll
 * position, an attribute a script set) stays, as long as the drawing does not change in that place.
 */
import { attributeName, attributeOf, type Drawn, type DrawnElement } from '../render/vnode'

const SVG = 'http://www.w3.org/2000/svg'

const inner = (node: DrawnElement): unknown => node.props?.innerHTML ?? null

/** `onClick` and its like: a function under a name that starts with `on`. */
const isListener = (name: string): boolean =>
  name.length > 2 && name.charCodeAt(0) === 111 && name.charCodeAt(1) === 110

function setProp(element: Element, name: string, value: unknown, was: unknown): void {
  if (name === 'ref' || name === 'key' || name === 'node' || name === 'innerHTML') return
  if (typeof value === 'function' || typeof was === 'function') {
    // One listener a kind, kept as the element's own (`onclick`): drawing again replaces it.
    if (isListener(name))
      (element as unknown as Record<string, unknown>)[name.toLowerCase()] =
        typeof value === 'function' ? value : null
    if (typeof value === 'function') return
  }
  const attribute = attributeOf(name, value)
  if (attribute === null) element.removeAttribute(attributeName(name))
  else element.setAttribute(attribute.name, attribute.value)
  // A box a reader has ticked no longer follows its attribute.
  if (name === 'checked') (element as HTMLInputElement).checked = Boolean(value)
}

/** The node for `drawn`, with everything inside it. */
export function create(drawn: Drawn, document: Document, svg = false): Node {
  if (typeof drawn === 'string') return document.createTextNode(drawn)
  const inSvg = svg || drawn.tag === 'svg'
  const element = inSvg
    ? document.createElementNS(SVG, drawn.tag)
    : document.createElement(drawn.tag)
  const props = drawn.props
  if (props !== null) for (const name in props) setProp(element, name, props[name], undefined)
  const html = inner(drawn)
  if (html !== null) element.innerHTML = String(html)
  else {
    const below = inSvg && drawn.tag !== 'foreignObject'
    for (const child of drawn.children) element.appendChild(create(child, document, below))
  }
  if (typeof props?.ref === 'function') (props.ref as (element: Element) => void)(element)
  return element
}

/**
 * Makes `node`, which shows `old`, show `next`. Returns the node that shows it: `node` itself, or
 * the one put in its place when the two are not the same kind of thing.
 */
export function patch(node: Node, old: Drawn, next: Drawn, document: Document, svg = false): Node {
  if (old === next) return node
  if (typeof next === 'string') {
    if (typeof old === 'string') {
      ;(node as Text).data = next
      return node
    }
    return replace(node, next, document, svg)
  }
  if (
    typeof old === 'string' ||
    old.tag !== next.tag ||
    (inner(old) === null) !== (inner(next) === null)
  )
    return replace(node, next, document, svg)
  const element = node as Element
  const before = old.props
  const after = next.props
  if (before !== after) {
    if (after !== null)
      for (const name in after) {
        const was = before === null ? undefined : before[name]
        if (was !== after[name]) setProp(element, name, after[name], was)
      }
    if (before !== null)
      for (const name in before)
        if (after === null || !(name in after)) setProp(element, name, undefined, before[name])
  }
  const html = inner(next)
  if (html !== null) {
    if (String(html) !== String(inner(old))) element.innerHTML = String(html)
  } else {
    const inSvg = svg || next.tag === 'svg'
    patchChildren(
      element,
      old.children,
      next.children,
      document,
      inSvg && next.tag !== 'foreignObject',
    )
  }
  if (typeof after?.ref === 'function') (after.ref as (element: Element) => void)(element)
  return node
}

function replace(node: Node, next: Drawn, document: Document, svg: boolean): Node {
  const made = create(next, document, svg)
  node.parentNode?.replaceChild(made, node)
  return made
}

/** Children are matched by place: a reply grows at its end, and what is before the end stays put. */
function patchChildren(
  parent: Element,
  old: readonly Drawn[],
  next: readonly Drawn[],
  document: Document,
  svg: boolean,
): void {
  const shared = Math.min(old.length, next.length)
  let child = parent.firstChild
  let index = 0
  for (; index < shared && child !== null; index += 1) {
    const following = child.nextSibling
    patch(child, old[index]!, next[index]!, document, svg)
    child = following
  }
  // What the page holds past the drawing's end goes; what the drawing holds past the page's is made.
  while (child !== null) {
    const following = child.nextSibling
    parent.removeChild(child)
    child = following
  }
  for (; index < next.length; index += 1) parent.appendChild(create(next[index]!, document, svg))
}
