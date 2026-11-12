import { isValidElement, type ReactNode } from 'react'
import { getLanguage } from '../render/views'

export { getLanguage }

/** Flatten a markdown node's children to their plain text (elements → their own children). */
export function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => childrenToText(child as ReactNode)).join('')
  if (isValidElement(node)) {
    return childrenToText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

export function isCodeBlock(children: ReactNode, className?: string): boolean {
  return Boolean(getLanguage(className)) || childrenToText(children).includes('\n')
}
