/**
 * The forms a document holds, one a line, as `spec/forms/spec.txt` prints them: what the Rust
 * crate's tests print of their own tree too, so the two parsers are held to the same cases.
 */
import { formOf, type Form } from '../src/core/forms'
import type { Node } from '../src/engine'

const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('')

const childrenOf = (node: Node): Node[] => node.children ?? []

/** The list a form took: the node itself when the form is on the list, else its first list. */
const items = (node: Node): number => {
  if (node.type === 'list') return childrenOf(node).length
  const list = childrenOf(node).find((child) => child.type === 'list')
  return list ? childrenOf(list).length : 0
}

/** The title a form's wrapper holds beside it: the paragraph marked `<form>-title`. */
const titleBeside = (siblings: Node[], form: string): string => {
  const title = siblings.find((node) => formOf(node)?.form === `${form}-title`)
  return title ? text(title) : ''
}

const line = (depth: number, name: string, title: string, count?: number): string =>
  `${'  '.repeat(depth)}${name}${title ? ` "${title}"` : ''}${count === undefined ? '' : ` ${count}`}`

function walk(siblings: Node[], depth: number, out: string[]): void {
  for (const node of siblings) {
    const form: Form | undefined = formOf(node)
    const children = childrenOf(node)
    switch (form?.form) {
      case 'callout':
        out.push(line(depth, `callout ${form.kind}`, form.title ?? ''))
        walk(children, depth + 1, out)
        break
      case 'steps':
      case 'stats':
      case 'sources':
        out.push(line(depth, form.form, titleBeside(siblings, form.form), items(node)))
        walk(children, depth + 1, out)
        break
      case 'verdict':
        out.push(line(depth, form.kind ?? '', titleBeside(children, 'verdict'), items(node)))
        walk(children, depth + 1, out)
        break
      case 'tabs':
        out.push(line(depth, 'tabs', titleBeside(siblings, 'tabs')))
        walk(children, depth + 1, out)
        break
      case 'tab':
        out.push(line(depth, 'tab', form.label ?? ''))
        walk(children, depth + 1, out)
        break
      case 'details': {
        const summary = children.find((child) => formOf(child)?.form === 'summary')
        out.push(line(depth, 'details', summary ? text(summary) : ''))
        walk(children, depth + 1, out)
        break
      }
      default:
        walk(children, depth, out)
    }
  }
}

/** The forms `root` holds, one a line, or `(none)`. */
export function forms(root: Node): string {
  const out: string[] = []
  walk(childrenOf(root), 0, out)
  return out.length ? `${out.join('\n')}\n` : '(none)\n'
}
