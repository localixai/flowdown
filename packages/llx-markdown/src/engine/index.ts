/**
 * The llx-markdown engine: Markdown text in, a tree out. CommonMark in full, GitHub's extensions,
 * and whatever a page registers on top, with no dependency.
 */
import { parseBlocks } from './blocks'
import { specialCharacters, type InlineContext } from './inlines'
import type { Extension, InlineRule, Node, ParseOptions } from './types'

export { toHtml, escapeHtml, type HtmlOptions } from './html'
export { defaultUrlTransform, type UrlTransform } from './url'
export { toText, visit, type Visitor } from './visit'
export type {
  Align,
  Extension,
  FenceRule,
  InlineRule,
  InlineState,
  Node,
  NodeType,
  ParseOptions,
  Reference,
} from './types'

/** A set of extensions made ready once: the lookups the parser uses on every character. */
interface Prepared {
  gfm: boolean
  math: boolean
  rules: (InlineRule['parse'][] | undefined)[]
  special: Uint8Array
  extensions: Extension[]
}

const prepare = (gfm: boolean, extensions: Extension[]): Prepared => {
  const rules: (InlineRule['parse'][] | undefined)[] = []
  let chars = ''
  for (const extension of extensions) {
    for (const rule of extension.inline ?? []) {
      chars += rule.chars
      for (const char of rule.chars) (rules[char.charCodeAt(0)] ??= []).push(rule.parse)
    }
  }
  return {
    gfm,
    math: extensions.some((extension) => extension.mathFences === true),
    rules,
    special: specialCharacters(chars),
    extensions,
  }
}

const NO_EXTENSIONS: Extension[] = []
const prepared = new WeakMap<Extension[], [Prepared | undefined, Prepared | undefined]>()

/** The prepared form of an options object's extensions, made once per array. */
const preparedFor = (gfm: boolean, extensions: Extension[]): Prepared => {
  let pair = prepared.get(extensions)
  if (pair === undefined) prepared.set(extensions, (pair = [undefined, undefined]))
  return (pair[gfm ? 1 : 0] ??= prepare(gfm, extensions))
}

const applyFences = (node: Node, extensions: Extension[]): void => {
  const children = node.children
  if (children === undefined) return
  for (let index = 0; index < children.length; index++) {
    const child = children[index] as Node
    if (child.type === 'code' && child.lang !== undefined) {
      for (const extension of extensions) {
        const replaced = extension.fences?.[child.lang]?.(child)
        if (replaced) {
          children[index] = replaced
          break
        }
      }
    } else applyFences(child, extensions)
  }
}

/** Parses Markdown into its tree. */
export const parse = (markdown: string, options: ParseOptions = {}): Node => {
  const use = preparedFor(options.gfm !== false, options.extensions ?? NO_EXTENSIONS)
  const context: InlineContext = {
    refs: new Map(),
    footnotes: new Map(),
    footnoteUses: new Map(),
    gfm: use.gfm,
    math: use.math,
    rules: use.rules,
    special: use.special,
  }
  const { root, footnotes } = parseBlocks(markdown, context)
  if (footnotes.length > 0) root.children?.push({ type: 'footnotes', children: footnotes })
  for (const extension of use.extensions) {
    if (extension.fences) applyFences(root, [extension])
    extension.transform?.(root, markdown)
  }
  return root
}
