/**
 * What a reader's copy of a reply puts on the clipboard. A browser's own copy of rich text writes
 * the computed style of every element inline: copied from a dark page, the text pastes into a
 * light document as light grey on white, in the page's font, with its buttons and icons. Here the
 * HTML is the reply's own elements and nothing of the page: the paste takes the destination's
 * style. The text is the browser's own.
 */

/** What a document draws that is the page's, not the reply's: controls, icons, labels of a bar. */
const NOT_THE_REPLY =
  'button, input:not([type="checkbox"]), select, textarea, script, style, template, svg, [aria-hidden="true"], .fd-code-language'

/**
 * The elements that give a part of a selection its meaning: a word copied from inside bold text
 * is still bold, a line copied from a code block is still code.
 */
const MEANING =
  /^(?:A|B|BLOCKQUOTE|CODE|DEL|EM|H[1-6]|I|KBD|LI|OL|P|PRE|S|STRONG|SU[BP]|T(?:ABLE|BODY|[DHR]|HEAD)|UL)$/

/** The attributes a paste can use; an address only if it is absolute and of the open web. */
const KEPT = new Set(['alt', 'colspan', 'rowspan', 'start', 'title'])
const LINK = /^(?:https?:|mailto:)/i
const SOURCE = /^https?:/i

/**
 * The selection `range`, inside the document drawn in `root`, as HTML for the clipboard: wrapped
 * in the elements above it that give it its meaning, without what is the page's, and with no
 * class, style or handler on any element.
 */
export function selectionHtml(root: Element, range: Range): string {
  const document = root.ownerDocument
  let content: Node = range.cloneContents()
  const above = range.commonAncestorContainer
  for (
    let element = above.nodeType === 1 ? (above as Element) : above.parentElement;
    element && element !== root && root.contains(element);
    element = element.parentElement
  ) {
    if (!MEANING.test(element.tagName)) continue
    const wrapper = element.cloneNode(false)
    wrapper.appendChild(content)
    content = wrapper
  }
  const box = document.createElement('div')
  box.appendChild(content)
  for (const element of box.querySelectorAll(NOT_THE_REPLY)) element.remove()
  // A task's box pastes as the mark of its state: in the document it goes to, nothing ticks it.
  for (const tick of box.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    tick.replaceWith(document.createTextNode(tick.checked ? '☑' : '☐'))
  for (const element of box.querySelectorAll('*')) {
    // A copy: the map is live, and an attribute taken out of it while it is walked skips the next.
    for (const { name, value } of Array.from(element.attributes)) {
      const kept =
        KEPT.has(name) ||
        (name === 'href' && element.tagName === 'A' && LINK.test(value.trim())) ||
        (name === 'src' && element.tagName === 'IMG' && SOURCE.test(value.trim()))
      if (!kept) element.removeAttribute(name)
    }
  }
  return box.innerHTML
}

/**
 * Answers a `copy` event on the document drawn in `root` when the whole selection is inside it.
 * A selection that runs out of the document onto the page is left to the browser, which knows
 * what else it holds; so is a copy something inside the document already answered.
 */
export function copySelection(root: Element, event: ClipboardEvent): void {
  const data = event.clipboardData
  const selection = root.ownerDocument.getSelection()
  if (event.defaultPrevented || !data || !selection || selection.isCollapsed) return
  const ranges = Array.from({ length: selection.rangeCount }, (_, at) => selection.getRangeAt(at))
  if (!ranges.every((range) => root.contains(range.commonAncestorContainer))) return
  event.preventDefault()
  data.setData('text/plain', selection.toString())
  data.setData(
    'text/html',
    `<meta charset="utf-8">${ranges.map((range) => selectionHtml(root, range)).join('')}`,
  )
}
