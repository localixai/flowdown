/**
 * Elements as plain values: what a target without elements of its own (a server writing HTML, a
 * page with no framework) draws a document into. A tree of them is written out as text
 * ({@link toHtml}) or put on a page and kept up to date (`dom/patch.ts`).
 */
import type { Factory, Props, Read } from './factory'

export interface VElement {
  tag: string | VComponent
  props: Props | null
  children: VNode[]
}

/** A text, an element, or several of either where one is expected. */
export type VNode = string | VElement | VNode[]

/** An element of the page's own: it gets the tag's properties and children, and gives nodes. */
export type VComponent = (props: Props, children: VNode[]) => VNode

const read = (children: VNode[], out: Array<Exclude<Read<VNode, VComponent>, null>>) => {
  for (const child of children) {
    if (typeof child === 'string') out.push(child)
    else if (Array.isArray(child)) read(child, out)
    else out.push({ tag: child.tag, props: child.props ?? {}, children: child.children })
  }
  return out
}

export const vnode: Factory<VNode, VComponent> = {
  element: (tag, props, children) => ({ tag, props, children }),
  text: (value) => value,
  fragment: (children) => children,
  read: (children) => read(children, []),
}

/**
 * `node` with every component in it called, outermost first: an element that lays its children
 * out anew (tabs, a code block) reads them as they were written, before they are drawn.
 */
export function expand(node: VNode): Drawn[] {
  const out: Drawn[] = []
  expandInto(node, out)
  return out
}

/** What is left of a tree once its components are called: a text, or an element of a tag. */
export type Drawn = string | DrawnElement

export interface DrawnElement extends VElement {
  tag: string
  /** Flat: no list inside a list, and no empty text. */
  children: Drawn[]
}

function expandInto(node: VNode, out: Drawn[]): void {
  if (typeof node === 'string') {
    if (node !== '') out.push(node)
  } else if (Array.isArray(node)) {
    for (const child of node) expandInto(child, out)
  } else if (typeof node.tag === 'function') {
    expandInto(node.tag(node.props ?? {}, node.children), out)
  } else {
    const children: Drawn[] = []
    for (const child of node.children) expandInto(child, children)
    out.push({ tag: node.tag, props: node.props, children })
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
}

export const escapeHtml = (text: string): string =>
  /[&<>"']/.test(text) ? text.replace(/[&<>"']/g, (character) => ESCAPES[character]!) : text

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** Properties whose attribute is not their own name. */
const ATTRIBUTES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  httpEquiv: 'http-equiv',
  acceptCharset: 'accept-charset',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
}

/** Attributes that are there or not: `hidden`, never `hidden="false"`. */
const BOOLEAN = new Set([
  'allowFullScreen',
  'async',
  'autoFocus',
  'autoPlay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'hidden',
  'inert',
  'itemScope',
  'loop',
  'multiple',
  'muted',
  'noValidate',
  'open',
  'playsInline',
  'readOnly',
  'required',
  'reversed',
  'selected',
])

/** What never becomes an attribute: an element's handle, its place in a list, its inside. */
const NOT_ATTRIBUTES = new Set(['key', 'ref', 'children', 'innerHTML', 'node'])

const VALID_NAME = /^[A-Za-z_:][\w:.-]*$/

const UNITLESS =
  /^(?:animationIterationCount|aspectRatio|columnCount|flex|flexGrow|flexShrink|fontWeight|lineHeight|opacity|order|orphans|tabSize|widows|zIndex|zoom|fillOpacity|strokeOpacity)$/

/** A `style` object as the attribute's text. */
function styleText(style: Record<string, unknown>): string {
  let out = ''
  for (const name in style) {
    const value = style[name]
    if (value === null || value === undefined || typeof value === 'boolean' || value === '')
      continue
    const custom = name.startsWith('--')
    const property = custom
      ? name
      : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, '-ms-')
    const text =
      typeof value === 'number' && value !== 0 && !custom && !UNITLESS.test(name)
        ? `${value}px`
        : String(value).trim()
    out += `${out ? ';' : ''}${property}:${text}`
  }
  return out
}

/**
 * One property as the attribute a page carries for it, or null when it is not one (a listener, a
 * handle, a boolean that is off). The HTML writer and the DOM target both ask here, so a page
 * written as text and a page built node by node carry the same attributes.
 */
export function attributeOf(name: string, value: unknown): { name: string; value: string } | null {
  if (value === null || value === undefined || typeof value === 'function') return null
  if (NOT_ATTRIBUTES.has(name) || typeof value === 'symbol') return null
  if (name === 'style') {
    if (typeof value !== 'object') return null
    const text = styleText(value as Record<string, unknown>)
    return text ? { name, value: text } : null
  }
  // No attribute of a page starts with `on` but a handler: `onClick` given as anything, and an
  // `onclick` that came as text, are both left out, as React leaves them out.
  if (name.length > 2 && (name.charCodeAt(0) | 32) === 111 && (name.charCodeAt(1) | 32) === 110)
    return null
  const written = attributeName(name)
  if (!VALID_NAME.test(written)) return null
  if (BOOLEAN.has(name)) return value ? { name: written, value: '' } : null
  if (typeof value === 'boolean') {
    // Only `aria-*` and `data-*` say `true` and `false` as words.
    const prefix = name.slice(0, 5)
    return prefix === 'aria-' || prefix === 'data-' ? { name: written, value: String(value) } : null
  }
  return { name: written, value: String(value) }
}

/** The attribute a property is written as (`className` is `class`). */
export const attributeName = (name: string): string => ATTRIBUTES[name] ?? name

/**
 * `node` as HTML text. Text and attribute values are escaped; `innerHTML` (highlighted code, a
 * typeset formula) goes in as it is, as its maker escaped it.
 */
export function toHtml(node: VNode): string {
  if (typeof node === 'string') return escapeHtml(node)
  if (Array.isArray(node)) {
    let out = ''
    for (const child of node) out += toHtml(child)
    return out
  }
  if (typeof node.tag === 'function') return toHtml(node.tag(node.props ?? {}, node.children))
  const { tag, props } = node
  let out = `<${tag}`
  if (props !== null)
    for (const name in props) {
      const written = attributeOf(name, props[name])
      if (written) out += ` ${written.name}="${escapeHtml(written.value)}"`
    }
  if (VOID.has(tag)) return `${out}/>`
  out += '>'
  let inside = ''
  if (props !== null && props.innerHTML !== undefined && props.innerHTML !== null)
    inside = String(props.innerHTML)
  else for (const child of node.children) inside += toHtml(child)
  // An HTML parser drops a line break that comes first in these: a second one keeps the text's own.
  if (inside.charCodeAt(0) === 10 && (tag === 'pre' || tag === 'textarea' || tag === 'listing'))
    out += '\n'
  return `${out}${inside}</${tag}>`
}
