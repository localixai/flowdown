/**
 * The tree as HTML text, in the form the CommonMark and GFM specs print their examples: what the
 * conformance tests compare, and what a page without React can put in a document.
 *
 * Raw HTML in the source is passed through as written. A page that shows text it did not write
 * must sanitize the result; `<Markdown>` does so on its own.
 */
import { normalizeUri } from './entities'
import type { Node } from './types'

const reEscape = /[&<>"]/g
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export const escapeHtml = (text: string): string =>
  reEscape.test(text) ? text.replace(reEscape, (char) => ESCAPES[char] as string) : text

/** GFM's tag filter: the tags that change how the rest of a page is read are shown as text. */
const reFiltered =
  /<(?=\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:[\s/>]|$))/gi

export interface HtmlOptions {
  /** Applies GFM's tag filter to raw HTML. */
  tagFilter?: boolean
}

export const toHtml = (root: Node, options: HtmlOptions = {}): string => {
  let out = ''
  /** Starts a new line unless the output is already at the start of one. */
  const cr = (): void => {
    if (out !== '' && out.charCodeAt(out.length - 1) !== 10) out += '\n'
  }
  const raw = (value: string): string =>
    options.tagFilter ? value.replace(reFiltered, '&lt;') : value

  /** Whether the nodes being written are text-level: HTML among them is not a block. */
  let inline = false

  const all = (nodes: Node[] | undefined, tight: boolean): void => {
    if (nodes) for (const node of nodes) one(node, tight)
  }

  const phrasing = (nodes: Node[] | undefined): void => {
    const was = inline
    inline = true
    all(nodes, false)
    inline = was
  }

  const one = (node: Node, tight: boolean): void => {
    switch (node.type) {
      case 'root':
        all(node.children, false)
        break
      case 'text':
        out += escapeHtml(node.value ?? '')
        break
      case 'break':
        out += '<br />\n'
        break
      case 'emphasis':
        out += '<em>'
        all(node.children, false)
        out += '</em>'
        break
      case 'strong':
        out += '<strong>'
        all(node.children, false)
        out += '</strong>'
        break
      case 'delete':
        out += '<del>'
        all(node.children, false)
        out += '</del>'
        break
      case 'inlineCode':
        out += `<code>${escapeHtml(node.value ?? '')}</code>`
        break
      case 'link':
        out += `<a href="${escapeHtml(node.url ?? '')}"`
        if (node.title) out += ` title="${escapeHtml(node.title)}"`
        out += '>'
        all(node.children, false)
        out += '</a>'
        break
      case 'image':
        out += `<img src="${escapeHtml(node.url ?? '')}" alt="${escapeHtml(node.alt ?? '')}"`
        if (node.title) out += ` title="${escapeHtml(node.title)}"`
        out += ' />'
        break
      case 'footnoteReference': {
        const id = normalizeUri(node.label ?? '')
        const nth = (node.occurrence ?? 1) > 1 ? `-${node.occurrence}` : ''
        out += `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}${nth}" data-footnote-ref>${node.index}</a></sup>`
        break
      }
      case 'footnotes':
        cr()
        out += '<section class="footnotes" data-footnotes>\n<ol>\n'
        all(node.children, false)
        out += '</ol>\n</section>\n'
        break
      case 'footnoteDefinition': {
        const id = normalizeUri(node.label ?? '')
        let back = ''
        for (let nth = 1; nth <= (node.count ?? 1); nth++) {
          const suffix = nth > 1 ? `-${nth}` : ''
          back += `${nth > 1 ? ' ' : ''}<a href="#fnref-${id}${suffix}" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${node.index}${suffix}" aria-label="Back to reference ${node.index}${suffix}">↩${nth > 1 ? `<sup class="footnote-ref">${nth}</sup>` : ''}</a>`
        }
        out += `<li id="fn-${id}">\n`
        const children = node.children ?? []
        const last = children[children.length - 1]
        for (const child of children) {
          if (child === last && child.type === 'paragraph') {
            out += '<p>'
            phrasing(child.children)
            out += ` ${back}</p>\n`
          } else one(child, false)
        }
        if (last === undefined || last.type !== 'paragraph') out += `${back}\n`
        out += '</li>\n'
        break
      }
      case 'paragraph':
        if (tight) phrasing(node.children)
        else {
          cr()
          out += '<p>'
          phrasing(node.children)
          out += '</p>\n'
        }
        break
      case 'heading':
        cr()
        out += `<h${node.depth}>`
        phrasing(node.children)
        out += `</h${node.depth}>\n`
        break
      case 'thematicBreak':
        cr()
        out += '<hr />\n'
        break
      case 'blockquote':
        cr()
        out += '<blockquote>\n'
        all(node.children, false)
        cr()
        out += '</blockquote>\n'
        break
      case 'code':
        cr()
        out += node.lang ? `<pre><code class="language-${escapeHtml(node.lang)}">` : '<pre><code>'
        out += `${escapeHtml(node.value ?? '')}</code></pre>\n`
        break
      case 'html':
        if (inline) out += raw(node.value ?? '')
        else {
          cr()
          out += `${raw(node.value ?? '')}\n`
        }
        break
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul'
        cr()
        out += node.ordered && node.start !== 1 ? `<ol start="${node.start}">\n` : `<${tag}>\n`
        all(node.children, node.spread === false)
        cr()
        out += `</${tag}>\n`
        break
      }
      case 'listItem':
        out += '<li>'
        if (node.checked !== undefined)
          out += `<input ${node.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `
        all(node.children, tight)
        out += '</li>\n'
        break
      case 'table': {
        const rows = node.children ?? []
        cr()
        out += '<table>\n<thead>\n'
        if (rows[0]) one(rows[0], false)
        out += '</thead>\n'
        if (rows.length > 1) {
          out += '<tbody>\n'
          for (let index = 1; index < rows.length; index++) one(rows[index] as Node, false)
          out += '</tbody>\n'
        }
        out += '</table>\n'
        break
      }
      case 'tableRow':
        out += '<tr>\n'
        all(node.children, false)
        out += '</tr>\n'
        break
      case 'tableCell': {
        const tag = node.header ? 'th' : 'td'
        out += node.cellAlign ? `<${tag} align="${node.cellAlign}">` : `<${tag}>`
        phrasing(node.children)
        out += `</${tag}>\n`
        break
      }
      default:
        all(node.children, tight)
    }
  }
  one(root, false)
  return out
}
