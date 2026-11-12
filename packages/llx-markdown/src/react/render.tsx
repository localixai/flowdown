import { createElement, Fragment, isValidElement, type ComponentType, type ReactNode } from 'react'
import type { Node } from '../engine/types'
import type { Factory, Props, Read } from '../render/factory'
import { createRenderer, type RenderOptions as TreeOptions } from '../render/tree'

export { ID_PREFIX } from '../render/tree'

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

// oxlint-disable-next-line typescript/no-explicit-any
type Component = ComponentType<any>

export type RenderOptions = Omit<TreeOptions<ReactNode, Component>, 'components'> & {
  components: Components
}

const read = (children: ReactNode[], out: Array<Exclude<Read<ReactNode, Component>, null>>) => {
  for (const child of children) {
    if (typeof child === 'string') out.push(child)
    else if (typeof child === 'number') out.push(String(child))
    else if (Array.isArray(child)) read(child as ReactNode[], out)
    else if (isValidElement(child)) {
      const props = child.props as Props & { children?: ReactNode }
      const inner =
        props.children === undefined || props.children === null
          ? []
          : Array.isArray(props.children)
            ? (props.children as ReactNode[])
            : [props.children]
      if (child.type === Fragment) read(inner, out)
      else out.push({ tag: child.type as string | Component, props, children: inner })
    }
  }
  return out
}

/** React's elements, as the factory every HTML renderer of the package is written against. */
export const react: Factory<ReactNode, Component> = {
  element(tag, props, children) {
    if (props !== null && props.innerHTML !== undefined) {
      // Markup already made (highlighted code, a typeset formula) is the element's whole inside.
      const { innerHTML, ...rest } = props
      return createElement(tag, { ...rest, dangerouslySetInnerHTML: { __html: innerHTML } })
    }
    return createElement(tag, props, ...children)
  },
  text: (value) => value,
  fragment: (children) => createElement(Fragment, null, ...children),
  read: (children) => read(children, []),
}

const draw = createRenderer(react)

/** Draws a tree. Every call gives new elements; the caller remembers them by the tree's text. */
export const render = (root: Node, options: RenderOptions): ReactNode =>
  draw(root, options as TreeOptions<ReactNode, Component>)
