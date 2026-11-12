/**
 * `@localix/flowdown/element`: Markdown as an element of the page's own, for anything that writes HTML
 * (Vue, Svelte, Solid, Angular, a template, a plain page).
 *
 *     import { defineMarkdownElement } from '@localix/flowdown/element'
 *     import '@localix/flowdown/styles.css'
 *
 *     defineMarkdownElement()
 *
 *     <flow-down streaming></flow-down>
 *     element.markdown = text
 *
 * The text is the `markdown` property; the `streaming` attribute says the reply is still arriving.
 * Text written inside the element is shown until the property is first set. The document is drawn
 * in the page, not in a shadow tree, so the page's stylesheet and theme reach it.
 */
import { mount, type Mounted, type MountOptions } from '../dom'

export type { MountOptions } from '../dom'

export interface MarkdownElement extends HTMLElement {
  /** The Markdown shown. */
  markdown: string
  /** The reply is still arriving; the same as the `streaming` attribute. */
  streaming: boolean
}

/**
 * Registers the element under `name`. `options` are what every such element is drawn with: a
 * highlighter, math, raw HTML, labels. Registering a name twice keeps the first.
 */
export function defineMarkdownElement(name = 'flow-down', options: MountOptions = {}): void {
  // Read here, not at import: a server that renders the page has no elements to extend.
  if (typeof customElements === 'undefined' || customElements.get(name)) return

  class Element extends HTMLElement implements MarkdownElement {
    static observedAttributes = ['streaming']
    #text: string | null = null
    #mounted: Mounted | null = null

    get markdown(): string {
      return this.#text ?? ''
    }
    set markdown(value: string) {
      this.#text = value === null || value === undefined ? '' : String(value)
      this.#show()
    }

    get streaming(): boolean {
      return this.hasAttribute('streaming')
    }
    set streaming(value: boolean) {
      this.toggleAttribute('streaming', Boolean(value))
    }

    connectedCallback(): void {
      if (this.#mounted) return
      // What the page wrote inside the element is its first text.
      if (this.#text === null) this.#text = this.textContent ?? ''
      this.textContent = ''
      this.#mounted = mount(this, options)
      this.#show()
    }

    disconnectedCallback(): void {
      this.#mounted?.destroy()
      this.#mounted = null
    }

    attributeChangedCallback(): void {
      this.#show()
    }

    #show(): void {
      this.#mounted?.update(this.#text ?? '', { streaming: this.streaming })
    }
  }

  customElements.define(name, Element)
}
