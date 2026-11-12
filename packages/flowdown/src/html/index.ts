/**
 * `flowdown/html`: raw HTML in Markdown (`<details>`, `<kbd>`, a README's `<p align>`), made
 * into elements.
 *
 * Nothing in the text is ever handed to the browser as HTML. The tags are read here, and an
 * element is made only for a tag on the list below, with only the attributes on the list below,
 * so there is no second parser to disagree with and nothing to sanitize afterwards: `<script>`,
 * `style`, `onclick` and `javascript:` have no way through. The lists are GitHub's.
 *
 * `<Markdown>` fetches this entry by itself the first time a document holds HTML; pass it
 * directly where the HTML must be in the first render, as on a server:
 *
 *     import { html } from 'flowdown/html'
 *     <Markdown html={html}>{readme}</Markdown>
 */
import { addEntities, decodeEntity } from '../engine/entities'
import { ENTITY_TABLE } from '../engine/entity-table'
import type { Extension, Node } from '../engine/types'

/** The elements raw HTML may make. Any other tag is dropped and what it holds is kept. */
const TAGS = new Set(
  (
    'a b blockquote br code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img input ins kbd ' +
    'li ol p picture pre q rp rt ruby s samp section source span strike strong sub summary sup ' +
    'table tbody td tfoot th thead tr tt ul var aside figure figcaption footer answer-tabs answer-tab'
  ).split(' '),
)

/** Elements that never have children. */
const VOID = new Set(
  'br hr img input source area base col embed link meta param track wbr'.split(' '),
)

/** Dropped with everything inside them. */
const DROPPED = new Set(['script', 'style'])

/** Elements whose inside is text, not tags: the tag goes, the text stays. */
const RAW_TEXT = new Set('textarea title xmp iframe noembed noframes plaintext'.split(' '))

/** Table parts mean nothing outside a table. */
const NEEDS_TABLE = new Set('tbody td tfoot th thead tr'.split(' '))

/** Elements a paragraph cannot hold: a paragraph that gets one is drawn as a `<div>`. */
const BLOCK = new Set(
  'blockquote details div dl h1 h2 h3 h4 h5 h6 hr ol p pre section table ul aside figure footer'.split(
    ' ',
  ),
)

/** Opening one of these ends the open element it cannot sit inside. */
const CLOSES: Record<string, { close: string[]; within: string[] }> = {
  li: { close: ['li'], within: ['ul', 'ol'] },
  dt: { close: ['dt', 'dd'], within: ['dl'] },
  dd: { close: ['dt', 'dd'], within: ['dl'] },
  tr: { close: ['tr'], within: ['table', 'thead', 'tbody', 'tfoot'] },
  td: { close: ['td', 'th'], within: ['tr'] },
  th: { close: ['td', 'th'], within: ['tr'] },
  thead: { close: ['thead', 'tbody', 'tfoot'], within: ['table'] },
  tbody: { close: ['thead', 'tbody', 'tfoot'], within: ['table'] },
  tfoot: { close: ['thead', 'tbody', 'tfoot'], within: ['table'] },
}

/** Attributes any element may carry, by the name HTML writes: the property React takes. */
const GLOBAL: Record<string, string> = {
  abbr: 'abbr',
  accept: 'accept',
  'accept-charset': 'acceptCharset',
  accesskey: 'accessKey',
  action: 'action',
  align: 'align',
  alt: 'alt',
  axis: 'axis',
  border: 'border',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  char: 'char',
  charoff: 'charoff',
  charset: 'charSet',
  checked: 'checked',
  clear: 'clear',
  colspan: 'colSpan',
  color: 'color',
  cols: 'cols',
  compact: 'compact',
  coords: 'coords',
  datetime: 'dateTime',
  dir: 'dir',
  enctype: 'encType',
  frame: 'frame',
  hspace: 'hspace',
  headers: 'headers',
  height: 'height',
  hreflang: 'hrefLang',
  for: 'htmlFor',
  id: 'id',
  ismap: 'ismap',
  itemprop: 'itemProp',
  label: 'label',
  lang: 'lang',
  maxlength: 'maxLength',
  media: 'media',
  method: 'method',
  multiple: 'multiple',
  name: 'name',
  nohref: 'nohref',
  noshade: 'noshade',
  nowrap: 'nowrap',
  open: 'open',
  prompt: 'prompt',
  readonly: 'readOnly',
  rev: 'rev',
  rowspan: 'rowSpan',
  rows: 'rows',
  rules: 'rules',
  scope: 'scope',
  selected: 'selected',
  shape: 'shape',
  size: 'size',
  span: 'span',
  start: 'start',
  summary: 'summary',
  tabindex: 'tabIndex',
  title: 'title',
  usemap: 'useMap',
  valign: 'valign',
  value: 'value',
  width: 'width',
  // The dialect's own data attributes: a form written as HTML draws like one written as Markdown.
  'data-callout': 'data-callout',
  'data-callout-title': 'data-callout-title',
  'data-verdict': 'data-verdict',
  'data-label': 'data-label',
  'data-title': 'data-title',
}

const ARIA = {
  'aria-describedby': 'aria-describedby',
  'aria-label': 'aria-label',
  'aria-labelledby': 'aria-labelledby',
}

/** Attributes only some elements may carry. */
const OWN: Record<string, Record<string, string>> = {
  a: {
    ...ARIA,
    'data-footnote-backref': 'data-footnote-backref',
    'data-footnote-ref': 'data-footnote-ref',
    href: 'href',
    target: 'target',
    rel: 'rel',
  },
  blockquote: { cite: 'cite' },
  del: { cite: 'cite' },
  ins: { cite: 'cite' },
  q: { cite: 'cite' },
  div: { itemscope: 'itemScope', itemtype: 'itemType' },
  dl: ARIA,
  ol: ARIA,
  ul: ARIA,
  summary: ARIA,
  table: ARIA,
  img: { ...ARIA, longdesc: 'longdesc', src: 'src' },
  section: { 'data-footnotes': 'data-footnotes' },
  source: { srcset: 'srcSet', media: 'media', type: 'type' },
}

/** Attributes that are on or off, as React wants them: `true`, not the empty string. */
const BOOLEAN = new Set(['checked', 'multiple', 'open', 'readOnly', 'selected', 'itemScope'])

/** The classes content may set: the dialect's own on any element, and these on theirs. */
const CLASSES: Record<string, RegExp> = {
  code: /^(?:language-.+|math-inline|math-display)$/,
  ol: /^contains-task-list$/,
  ul: /^contains-task-list$/,
  li: /^task-list-item$/,
  a: /^data-footnote-backref$/,
  h2: /^sr-only$/,
  section: /^footnotes$/,
}
const DIALECT_CLASS = /^fd-/

/** Where a URL may lead, by attribute. A URL with no scheme is the page's own and passes. */
const PROTOCOLS: Record<string, RegExp> = {
  href: /^(?:https?|ircs?|mailto|xmpp)$/i,
  src: /^https?$/i,
  cite: /^https?$/i,
  longdesc: /^https?$/i,
}

/** Ids and the attributes that point at them are prefixed, so content cannot stand in for one of the page's own. */
const PREFIXED = new Set(['id', 'name', 'aria-describedby', 'aria-labelledby'])
const PREFIX = 'user-content-'

const safeUrl = (url: string, allowed: RegExp): boolean => {
  const colon = url.indexOf(':')
  if (colon === -1) return true
  const slash = url.indexOf('/')
  const question = url.indexOf('?')
  const hash = url.indexOf('#')
  if (
    (slash !== -1 && colon > slash) ||
    (question !== -1 && colon > question) ||
    (hash !== -1 && colon > hash)
  )
    return true
  return allowed.test(url.slice(0, colon))
}

const reEntity = /&(?:#x[a-f0-9]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});/gi
const decode = (text: string): string =>
  text.includes('&') ? text.replace(reEntity, (entity) => decodeEntity(entity) ?? entity) : text

type Attributes = Array<[name: string, value: string]>

/** The properties an element of raw HTML is drawn with: only what the lists allow. */
function properties(tag: string, attributes: Attributes): Record<string, unknown> | undefined {
  // A box in content is a task's box: it shows a state and cannot be changed.
  if (tag === 'input') {
    const checked = attributes.some(([name]) => name === 'checked')
    return {
      type: 'checkbox',
      disabled: true,
      ...(checked ? { checked } : null),
    }
  }
  let out: Record<string, unknown> | undefined
  const own = OWN[tag]
  for (const [name, raw] of attributes) {
    let value = raw
    if (name === 'class') {
      const allowed = CLASSES[tag]
      const kept = value
        .split(/\s+/)
        .filter((token) => token !== '' && (DIALECT_CLASS.test(token) || allowed?.test(token)))
      if (kept.length > 0) (out ??= {}).className = kept.join(' ')
      continue
    }
    const property = own?.[name] ?? GLOBAL[name]
    if (property === undefined || (out !== undefined && property in out)) continue
    const protocols = PROTOCOLS[name]
    if (protocols !== undefined && !safeUrl(value, protocols)) continue
    // A list of image candidates is held to an image's rule, each of them: one bad URL drops the list.
    if (
      name === 'srcset' &&
      !value.split(',').every((candidate) => safeUrl(candidate.trim(), PROTOCOLS.src as RegExp))
    )
      continue
    if (PREFIXED.has(name))
      value = value
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => PREFIX + id)
        .join(' ')
    ;(out ??= {})[property] = BOOLEAN.has(property) ? true : value
  }
  // A link that opens elsewhere never hands the page it opens a handle on this one.
  if (tag === 'a' && out?.target !== undefined) {
    const rel = typeof out.rel === 'string' ? out.rel : ''
    if (!/(?:^|\s)noopener(?:\s|$)/i.test(rel)) out.rel = rel ? `${rel} noopener` : 'noopener'
  }
  return out
}

interface Handlers {
  text: (value: string) => void
  open: (tag: string, attributes: Attributes) => void
  close: (tag: string) => void
}

const isLetter = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90)
const isSpace = (code: number): boolean =>
  code === 32 || code === 10 || code === 9 || code === 13 || code === 12

/**
 * Reads a run of HTML into tags and text the way a browser does, in one pass with no
 * backtracking: `<` and a letter start a tag, which runs to the next `>` outside a quoted value.
 * A tag the text ends inside is left out, so a reply that is still arriving does not flash
 * `<div align="cen` as text.
 */
function tokenize(html: string, handlers: Handlers): void {
  const length = html.length
  let from = 0
  let at = 0
  const flush = (to: number): void => {
    if (to > from) handlers.text(decode(html.slice(from, to)))
  }
  while ((at = html.indexOf('<', at)) !== -1) {
    const next = html.charCodeAt(at + 1)
    // Comments, doctypes and processing instructions draw nothing.
    if (next === 33 || next === 63) {
      let end: number
      if (html.startsWith('<!--', at)) {
        end = html.indexOf('-->', at + 4)
        end = end === -1 ? length : end + 3
      } else {
        end = html.indexOf('>', at)
        end = end === -1 ? length : end + 1
      }
      flush(at)
      at = from = end
      continue
    }
    const closing = next === 47
    const start = at + (closing ? 2 : 1)
    if (!isLetter(html.charCodeAt(start))) {
      at++
      continue
    }
    let cursor = start
    while (cursor < length) {
      const code = html.charCodeAt(cursor)
      if (isSpace(code) || code === 47 || code === 62) break
      cursor++
    }
    const tag = html.slice(start, cursor).toLowerCase()
    const attributes: Attributes = []
    let complete = false
    while (cursor < length) {
      const code = html.charCodeAt(cursor)
      if (code === 62) {
        cursor++
        complete = true
        break
      }
      if (isSpace(code) || code === 47) {
        cursor++
        continue
      }
      const nameStart = cursor
      // A name runs to white space, `/`, `>` or `=` (an `=` that opens it is part of it).
      cursor++
      while (cursor < length) {
        const end = html.charCodeAt(cursor)
        if (isSpace(end) || end === 47 || end === 62 || end === 61) break
        cursor++
      }
      const name = html.slice(nameStart, cursor).toLowerCase()
      let value = ''
      let ahead = cursor
      while (ahead < length && isSpace(html.charCodeAt(ahead))) ahead++
      if (html.charCodeAt(ahead) === 61) {
        ahead++
        while (ahead < length && isSpace(html.charCodeAt(ahead))) ahead++
        const quote = html.charCodeAt(ahead)
        if (quote === 34 || quote === 39) {
          const close = html.indexOf(quote === 34 ? '"' : "'", ahead + 1)
          // A value the text ends inside: the tag is unfinished.
          if (close === -1) {
            cursor = length
            break
          }
          value = html.slice(ahead + 1, close)
          cursor = close + 1
        } else {
          const valueStart = ahead
          while (
            ahead < length &&
            !isSpace(html.charCodeAt(ahead)) &&
            html.charCodeAt(ahead) !== 62
          )
            ahead++
          value = html.slice(valueStart, ahead)
          cursor = ahead
        }
      }
      attributes.push([name, decode(value)])
    }
    flush(at)
    at = from = cursor
    // The text ended inside the tag: nothing of it is drawn.
    if (!complete) break
    if (closing) {
      handlers.close(tag)
      continue
    }
    handlers.open(tag, attributes)
    if (RAW_TEXT.has(tag)) {
      // What these hold is text, up to their own closing tag.
      const end = html.toLowerCase().indexOf(`</${tag}`, cursor)
      const stop = end === -1 ? length : end
      if (stop > cursor) handlers.text(html.slice(cursor, stop))
      at = from = stop
    }
  }
  flush(length)
}

const WHITESPACE = /^[ \t\n\r\f]*$/
const TABLE_PARTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])
/** The nodes whose children are blocks. */
const BLOCK_PARENTS = new Set(['blockquote', 'listItem', 'footnoteDefinition', 'root'])

/** Whether a table part may hold the node directly. */
const fits = (parent: string, node: Node): boolean => {
  if (node.type !== 'element') return false
  const tag = node.data?.hName
  if (parent === 'tr') return tag === 'td' || tag === 'th'
  if (parent === 'table') return tag === 'thead' || tag === 'tbody' || tag === 'tfoot'
  return tag === 'tr'
}

/**
 * One run of sibling nodes with its raw HTML made into elements. A tag opened in one `html` node
 * and closed in a later one takes the Markdown between them as its children, which is how
 * `<details>` around paragraphs works; a tag left open is closed where its parent ends.
 */
function rebuild(nodes: Node[], outer: readonly string[], block: boolean, root = false): Node[] {
  const out: Node[] = []
  const stack: Array<{ tag: string; node: Node }> = []
  /** Inside a `<script>` or `<style>`: nothing is kept until it closes. */
  let dropping: string | null = null

  /** A `<pre>` was just opened: the line break right after its tag is not content. */
  let fresh = false

  const top = (): string | undefined => stack[stack.length - 1]?.tag
  const add = (node: Node): void => {
    fresh = false
    const depth = stack.length - 1
    const parent = stack[depth]
    if (!parent) {
      out.push(node)
      return
    }
    // What a table cannot hold directly is put before the table, as a browser puts it.
    if (TABLE_PARTS.has(parent.tag) && !fits(parent.tag, node)) {
      let table = depth
      while (table > 0 && (stack[table] as { tag: string }).tag !== 'table') table--
      const around =
        table > 0 ? ((stack[table - 1] as { node: Node }).node.children as Node[]) : out
      const before = around.lastIndexOf((stack[table] as { node: Node }).node)
      if (before === -1) around.push(node)
      else around.splice(before, 0, node)
      return
    }
    ;(parent.node.children as Node[]).push(node)
  }
  const inside = (tag: string): boolean =>
    outer.includes(tag) || stack.some((open) => open.tag === tag)

  const handlers: Handlers = {
    text(value) {
      if (dropping !== null) return
      if (fresh && value.charCodeAt(0) === 10) value = value.slice(1)
      if (value === '') return
      // White space between the parts of a table is not content.
      const parent = top()
      if (parent !== undefined && TABLE_PARTS.has(parent) && WHITESPACE.test(value)) return
      add({ type: 'text', value })
    },
    open(tag, attributes) {
      if (dropping !== null) return
      if (DROPPED.has(tag)) {
        dropping = tag
        return
      }
      if (!TAGS.has(tag)) return
      if (NEEDS_TABLE.has(tag) && !inside('table')) return
      // A tag that ends the open one it cannot sit inside: `<li>` after `<li>`.
      const rule = CLOSES[tag]
      if (rule) {
        for (let depth = stack.length - 1; depth >= 0; depth--) {
          const open = (stack[depth] as { tag: string }).tag
          if (rule.within.includes(open)) break
          if (rule.close.includes(open)) {
            stack.length = depth
            break
          }
        }
      } else if (BLOCK.has(tag) && top() === 'p') stack.pop()
      // A row straight inside a table sits in a body, as a browser would put it.
      if (tag === 'tr' && top() === 'table') {
        const body: Node = {
          type: 'element',
          data: { hName: 'tbody' },
          children: [],
        }
        add(body)
        stack.push({ tag: 'tbody', node: body })
      }
      const made = properties(tag, attributes)
      const node: Node = {
        type: 'element',
        data: made === undefined ? { hName: tag } : { hName: tag, hProperties: made },
        children: [],
      }
      add(node)
      if (!VOID.has(tag)) stack.push({ tag, node })
      fresh = tag === 'pre'
    },
    close(tag) {
      if (dropping !== null) {
        if (dropping === tag) dropping = null
        return
      }
      for (let depth = stack.length - 1; depth >= 0; depth--) {
        if ((stack[depth] as { tag: string }).tag === tag) {
          stack.length = depth
          return
        }
      }
    },
  }

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index] as Node
    // Blocks are a line apart. Inside an element that is still open the line is its content
    // (it shows in a `<pre>`); between the blocks this run gives back, the renderer writes it.
    if (block && index > 0) {
      if (stack.length > 0) handlers.text('\n')
      // At the top of a document the line is written here, one for every block of the source even
      // when a block draws nothing (a stray `</div>`): a document drawn block by block has one
      // between every two blocks too, so both ways give the same text.
      else if (root) out.push({ type: 'text', value: '\n' })
    }
    if (node.type === 'html') {
      tokenize(node.value ?? '', handlers)
      continue
    }
    if (dropping !== null) continue
    if (node.children !== undefined && node.children.length > 0) {
      const within = stack.length === 0 ? outer : [...outer, ...stack.map((open) => open.tag)]
      node.children = rebuild(node.children, within, BLOCK_PARENTS.has(node.type))
      // A paragraph cannot hold a block: one that got a block is a `<div>`.
      if (
        node.type === 'paragraph' &&
        node.data?.hName === undefined &&
        node.children.some(
          (child) => child.type === 'element' && BLOCK.has(child.data?.hName as string),
        )
      )
        node.data = { ...node.data, hName: 'div' }
    }
    add(node)
  }
  return out
}

// HTML is where the rarer named references are written: with this stage every HTML5 name is decoded.
addEntities(ENTITY_TABLE)

/** The raw HTML stage: what `<Markdown html>` takes. */
export const html: Extension = {
  name: 'html',
  transform(root) {
    if (root.children !== undefined) root.children = rebuild(root.children, [], true, true)
  },
}

export default html
