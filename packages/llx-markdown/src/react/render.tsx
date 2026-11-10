import { createElement, Fragment, type ComponentType, type ReactNode } from 'react'
import { normalizeUri } from '../engine/entities'
import type { Node } from '../engine/types'
import type { UrlTransform } from '../engine/url'
import { DIAGRAM_FENCE_LANGUAGE, TREE_FENCE_LANGUAGE } from '../dialect'

/** An element of the page's own for a tag: it gets the tag's props, and the node it draws. */
export type Components = {
  [Tag in keyof React.JSX.IntrinsicElements]?: ComponentType<
    React.JSX.IntrinsicElements[Tag] & { node?: Node }
  >
} & {
  // `any`: a page's own tag takes whatever props its extension wrote. `never` here refused a map
  // that spreads one in beside HTML tags (a class component's `defaultProps` do not fit it).
  // oxlint-disable-next-line typescript/no-explicit-any
  [tag: string]: ComponentType<any> | undefined
}

export interface RenderOptions {
  components: Components
  urlTransform: UrlTransform
  /** Where the tree's text starts in the document: task boxes and headings are keyed by it. */
  offset: number
  /** Ids for the headings, by where each starts in the document. */
  headingIds: ReadonlyMap<number, string> | null
  /** A ```mermaid or ```tree fence, drawn by the page that asked for one. */
  special: (language: string, source: string) => ReactNode | undefined
}

type Props = Record<string, unknown>

/** The prefix on every id content makes, so it cannot stand in for one of the page's own. */
export const ID_PREFIX = 'user-content-'

const NEWLINE = '\n'

const URL_PROPS = ['href', 'src', 'cite', 'longDesc'] as const

/** `dataCalloutTitle` as the attribute React writes: `data-callout-title`. */
const attribute = (name: string): string =>
  name.length > 4 && name.startsWith('data') && name.charCodeAt(4) >= 65 && name.charCodeAt(4) <= 90
    ? `data-${name.slice(4).replace(/[A-Z]/g, (letter, at: number) => (at > 0 ? '-' : '') + letter.toLowerCase())}`
    : name

/** A node's own element name and properties (`data.hName`, `data.hProperties`) over the default. */
const own = (node: Node, tag: string, props: Props | null): [string, Props | null] => {
  const data = node.data
  if (data === undefined) return [tag, props]
  const name = typeof data.hName === 'string' ? data.hName : tag
  const extra = data.hProperties as Props | undefined
  if (extra === undefined) return [name, props]
  const merged: Props = props === null ? {} : { ...props }
  for (const key in extra) {
    const value = extra[key]
    if (value === undefined || value === null || value === false) continue
    if (key === 'className') merged.className = Array.isArray(value) ? value.join(' ') : value
    else if (key === 'innerHTML') merged.dangerouslySetInnerHTML = { __html: value }
    else merged[attribute(key)] = value
  }
  return [name, merged]
}

/** Draws a tree. Every call gives new elements; the caller remembers them by the tree's text. */
export const render = (root: Node, options: RenderOptions): ReactNode => {
  const { components, urlTransform } = options
  /** The page's component for an element the renderer writes itself, or the element. */
  const pageTag = (name: string): string | ComponentType<Props> =>
    (components[name] as ComponentType<Props> | undefined) ?? name

  const element = (
    node: Node,
    tag: string,
    props: Props | null,
    children: ReactNode[],
  ): ReactNode => {
    const [name, merged] = own(node, tag, props)
    if (merged !== null && node.data?.hProperties !== undefined) {
      // An element an extension made: its URLs pass the page's check like a link's or an image's.
      for (const key of URL_PROPS)
        if (typeof merged[key] === 'string')
          merged[key] = urlTransform(merged[key] as string, key, node) ?? ''
      // An element given its HTML has no children of its own.
      if (merged.dangerouslySetInnerHTML !== undefined) children = []
    }
    const Page = components[name] as ComponentType<Props> | undefined
    if (Page === undefined) return createElement(name, merged, ...children)
    return createElement(Page, merged === null ? { node } : { ...merged, node }, ...children)
  }

  /** A run of text-level nodes. */
  const inline = (nodes: Node[] | undefined): ReactNode[] => {
    const out: ReactNode[] = []
    if (nodes !== undefined) for (const node of nodes) one(node, out, false)
    return out
  }

  /** A run of blocks, a line break between each: before the first and after the last as well when `around`. */
  const blocks = (nodes: Node[] | undefined, around: boolean): ReactNode[] => {
    const out: ReactNode[] = []
    if (nodes === undefined) return out
    if (around) out.push(NEWLINE)
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index] as Node
      // Text among blocks is what raw HTML left there, with its own line breaks.
      if (index > 0 && node.type !== 'text' && (nodes[index - 1] as Node).type !== 'text')
        out.push(NEWLINE)
      one(node, out, false)
    }
    if (around && nodes.length > 0) out.push(NEWLINE)
    return out
  }

  const item = (node: Node, loose: boolean): ReactNode => {
    const children = node.children ?? []
    const out: ReactNode[] = []
    const task = typeof node.checked === 'boolean'
    const box = task
      ? createElement(pageTag('input'), {
          type: 'checkbox',
          disabled: true,
          'data-task-key': options.offset + (node.position?.start.offset ?? 0),
          ...(node.checked ? { checked: true } : null),
        })
      : null
    const first = children[0]
    // A task's box opens the item's first paragraph, or stands as one when there is none.
    if (
      box !== null &&
      (first === undefined || first.type !== 'paragraph' || first.data?.hName !== undefined)
    ) {
      if (loose) out.push(NEWLINE, createElement(pageTag('p'), null, box))
      else out.push(box)
    }
    for (let index = 0; index < children.length; index++) {
      const child = children[index] as Node
      const paragraph = child.type === 'paragraph' && child.data?.hName === undefined
      if (loose || index !== 0 || !paragraph) out.push(NEWLINE)
      if (paragraph) {
        const text = inline(child.children)
        if (box !== null && index === 0) {
          if (text.length > 0) text.unshift(' ')
          text.unshift(box)
        }
        if (loose) out.push(element(child, 'p', null, text))
        else out.push(...text)
      } else one(child, out, false)
    }
    const last = children[children.length - 1]
    if (
      last !== undefined &&
      (loose || last.type !== 'paragraph' || last.data?.hName !== undefined)
    )
      out.push(NEWLINE)
    return element(node, 'li', task ? { className: 'task-list-item' } : null, out)
  }

  const footnotes = (node: Node): ReactNode => {
    const items: ReactNode[] = [NEWLINE]
    const definitions = node.children ?? []
    for (let at = 0; at < definitions.length; at++) {
      const definition = definitions[at] as Node
      const id = normalizeUri(definition.identifier ?? '')
      const back: ReactNode[] = []
      for (let nth = 1; nth <= (definition.count ?? 1); nth++) {
        const suffix = nth > 1 ? `-${nth}` : ''
        if (nth > 1) back.push(' ')
        back.push(
          createElement(
            pageTag('a'),
            {
              href: `#${ID_PREFIX}fnref-${id}${suffix}`,
              'data-footnote-backref': '',
              'aria-label': `Back to reference ${definition.index}${suffix}`,
              className: 'data-footnote-backref',
            } as never,
            '↩',
            nth > 1 ? createElement(pageTag('sup'), null, String(nth)) : null,
          ),
        )
      }
      const content = definition.children ?? []
      const body: ReactNode[] = [NEWLINE]
      const tail = content[content.length - 1]
      for (let index = 0; index < content.length; index++) {
        const child = content[index] as Node
        if (index > 0) body.push(NEWLINE)
        if (child === tail && child.type === 'paragraph' && child.data?.hName === undefined)
          body.push(createElement(pageTag('p'), null, ...inline(child.children), ' ', ...back))
        else one(child, body, false)
      }
      if (tail === undefined || tail.type !== 'paragraph' || tail.data?.hName !== undefined)
        body.push(NEWLINE, ...back)
      body.push(NEWLINE)
      if (at > 0) items.push(NEWLINE)
      items.push(createElement(pageTag('li'), { id: `${ID_PREFIX}fn-${id}` }, ...body))
    }
    items.push(NEWLINE)
    return createElement(
      pageTag('section'),
      { 'data-footnotes': '', className: 'footnotes' },
      createElement(
        pageTag('h2'),
        { className: 'sr-only', id: `${ID_PREFIX}footnote-label` },
        'Footnotes',
      ),
      NEWLINE,
      createElement(pageTag('ol'), null, ...items),
      NEWLINE,
    )
  }

  const one = (node: Node, out: ReactNode[], _tight: boolean): void => {
    switch (node.type) {
      case 'text':
        out.push(node.value)
        return
      case 'paragraph':
        out.push(element(node, 'p', null, inline(node.children)))
        return
      case 'heading': {
        const id = options.headingIds?.get(options.offset + (node.position?.start.offset ?? 0))
        out.push(
          element(node, `h${node.depth}`, id === undefined ? null : { id }, inline(node.children)),
        )
        return
      }
      case 'emphasis':
        out.push(element(node, 'em', null, inline(node.children)))
        return
      case 'strong':
        out.push(element(node, 'strong', null, inline(node.children)))
        return
      case 'delete':
        out.push(element(node, 'del', null, inline(node.children)))
        return
      case 'inlineCode':
        out.push(element(node, 'code', null, [(node.value ?? '').replace(/\r?\n|\r/g, ' ')]))
        return
      case 'break':
        out.push(element(node, 'br', null, []), NEWLINE)
        return
      case 'link': {
        const url = node.url ?? ''
        const href = urlTransform(url, 'href', node) ?? ''
        // A bare address the page refuses to link (`ftp://…`) stays the text it was written as.
        if (
          href === '' &&
          url !== '' &&
          node.children?.length === 1 &&
          node.children[0]?.value === url
        ) {
          out.push(url)
          return
        }
        const props: Props = { href }
        if (node.title) props.title = node.title
        out.push(element(node, 'a', props, inline(node.children)))
        return
      }
      case 'image': {
        const props: Props = {
          src: urlTransform(node.url ?? '', 'src', node) ?? '',
          alt: node.alt ?? '',
        }
        if (node.title) props.title = node.title
        out.push(element(node, 'img', props, []))
        return
      }
      case 'thematicBreak':
        out.push(element(node, 'hr', null, []))
        return
      case 'blockquote':
        out.push(element(node, 'blockquote', null, blocks(node.children, true)))
        return
      case 'code': {
        const language = node.lang
        if (language === DIAGRAM_FENCE_LANGUAGE || language === TREE_FENCE_LANGUAGE) {
          const drawn = options.special(language, (node.value ?? '').replace(/\n$/, ''))
          if (drawn !== undefined) {
            out.push(drawn)
            return
          }
        }
        const code = element(
          node,
          'code',
          language ? { className: `language-${language}` } : null,
          [node.value ?? ''],
        )
        const Pre = components.pre as ComponentType<Props> | undefined
        out.push(
          Pre === undefined ? createElement('pre', null, code) : createElement(Pre, { node }, code),
        )
        return
      }
      case 'list': {
        const children = node.children ?? []
        let loose = node.spread === true
        let tasks = false
        for (const child of children) {
          if (child.spread === true) loose = true
          if (typeof child.checked === 'boolean') tasks = true
        }
        const props: Props = {}
        if (node.ordered && typeof node.start === 'number' && node.start !== 1)
          props.start = node.start
        if (tasks) props.className = 'contains-task-list'
        const rows: ReactNode[] = [NEWLINE]
        for (let index = 0; index < children.length; index++) {
          if (index > 0) rows.push(NEWLINE)
          rows.push(item(children[index] as Node, loose))
        }
        if (children.length > 0) rows.push(NEWLINE)
        out.push(element(node, node.ordered ? 'ol' : 'ul', props, rows))
        return
      }
      case 'listItem':
        out.push(item(node, node.spread === true))
        return
      case 'table': {
        const rows = node.children ?? []
        const align = node.align ?? []
        const row = (from: Node, header: boolean): ReactNode =>
          element(
            from,
            'tr',
            null,
            (from.children ?? []).map((cell, index) =>
              element(
                cell,
                header ? 'th' : 'td',
                align[index] ? { style: { textAlign: align[index] } } : null,
                inline(cell.children),
              ),
            ),
          )
        const parts: ReactNode[] = []
        const head = rows[0]
        if (head !== undefined) parts.push(createElement(pageTag('thead'), null, row(head, true)))
        if (rows.length > 1)
          parts.push(
            createElement(pageTag('tbody'), null, ...rows.slice(1).map((from) => row(from, false))),
          )
        out.push(element(node, 'table', null, parts))
        return
      }
      case 'footnoteReference': {
        const id = normalizeUri(node.identifier ?? '')
        const nth = (node.occurrence ?? 1) > 1 ? `-${node.occurrence}` : ''
        out.push(
          createElement(
            pageTag('sup'),
            null,
            createElement(
              pageTag('a'),
              {
                href: `#${ID_PREFIX}fn-${id}`,
                id: `${ID_PREFIX}fnref-${id}${nth}`,
                'data-footnote-ref': '',
                'aria-describedby': `${ID_PREFIX}footnote-label`,
              } as never,
              String(node.index),
            ),
          ),
        )
        return
      }
      case 'footnotes':
        out.push(footnotes(node))
        return
      case 'html':
        // Raw HTML is drawn only once the HTML stage has made elements of it.
        return
      case 'root':
        out.push(...blocks(node.children, false))
        return
      default: {
        // An extension's node: drawn by the element it names for itself, or as its children.
        const children =
          node.children === undefined
            ? node.value === undefined
              ? []
              : [node.value]
            : mixed(node.children)
        if (typeof node.data?.hName === 'string') out.push(element(node, 'div', null, children))
        else out.push(...children)
      }
    }
  }

  /** The children of an element the tree does not know: blocks or text, as they come. */
  const mixed = (nodes: Node[]): ReactNode[] => {
    const out: ReactNode[] = []
    for (const node of nodes) one(node, out, false)
    return out
  }

  const out: ReactNode[] = []
  one(root, out, false)
  return createElement(Fragment, null, ...out)
}
