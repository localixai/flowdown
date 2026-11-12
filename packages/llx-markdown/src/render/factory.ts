/**
 * What a renderer for HTML is written against, so that it is written once.
 *
 * Everything that decides what a document looks like as elements (which tag a node becomes, what a
 * callout or a code block is made of) is a function of a {@link Factory}: it asks for elements and
 * never says what an element is. React answers with its own, a server with text, the DOM with
 * nodes. A new framework is a factory of a few lines, and draws every document as the others do.
 */

/**
 * An element's properties, by the names the DOM gives them (`className`, `tabIndex`, `colSpan`),
 * as React takes them and hast writes them; `data-*` and `aria-*` as they are written. `style` is
 * an object. `innerHTML` is markup already made and escaped (highlighted code, a typeset formula).
 * A function is a listener (`onClick`): a target that cannot listen leaves it out.
 */
export type Props = Record<string, unknown>

/** What {@link Factory.read} tells of a child: its text, or its element taken apart. */
export type Read<E, C> = string | { tag: string | C; props: Props; children: E[] } | null

/**
 * How one target makes elements. `E` is what it makes (a React node, a virtual node), `C` what it
 * accepts in place of a tag name (a component), if anything.
 */
export interface Factory<E, C = never> {
  element(tag: string | C, props: Props | null, children: E[]): E
  /** A run of text: characters, never markup. */
  text(value: string): E
  /** Several children where one is expected. */
  fragment(children: E[]): E
  /**
   * A child taken apart again, for an element that lays its children out anew (tabs, a code
   * block): a text, an element, or null for what is neither. A fragment reads as its children.
   */
  read(children: E[]): Array<Exclude<Read<E, C>, null>>
}
