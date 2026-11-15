/**
 * The flowdown engine: Markdown text in, a tree out. CommonMark in full, GitHub's extensions,
 * and whatever a page registers on top, with no dependency.
 */
import { parseBlocks } from './blocks'
import { isolated, specialCharacters, type Definitions, type InlineContext } from './inlines'
import type { Extension, InlineRule, Node, ParseOptions, Reference, References } from './types'

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
  References,
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

/**
 * The definitions a parse reads and asks: its own, behind the ones handed to it from the rest of
 * the document.
 */
const definitionsWith = (outer: References | undefined): Definitions => {
  const own = new Map<string, Reference>()
  if (outer === undefined) return own
  return {
    get: (label) => outer.get(label) ?? own.get(label),
    has: (label) => own.has(label),
    set: (label, reference) => own.set(label, reference),
  }
}

/**
 * The link reference definitions a text holds, by label as it is matched. Only its blocks are
 * read, not what is written in them: far less work than a parse. `mathFences` says whether `$$`
 * fences a formula there, as an extension of the parse that will draw the text does.
 */
export const definitions = (
  markdown: string,
  options: { gfm?: boolean; mathFences?: boolean } = {},
): Map<string, Reference> => {
  const refs = new Map<string, Reference>()
  const context: InlineContext = {
    refs,
    footnotes: new Map(),
    footnoteUses: new Map(),
    gfm: options.gfm !== false,
    math: options.mathFences === true,
    rules: [],
    special: specialCharacters(''),
  }
  isolated(() => parseBlocks(markdown, context, true))
  return refs
}

/** Parses Markdown into its tree. */
export const parse = (markdown: string, options: ParseOptions = {}): Node => {
  const use = preparedFor(options.gfm !== false, options.extensions ?? NO_EXTENSIONS)
  const context: InlineContext = {
    refs: definitionsWith(options.refs),
    footnotes: new Map(),
    footnoteUses: new Map(),
    gfm: use.gfm,
    math: use.math,
    rules: use.rules,
    special: use.special,
  }
  const { root, footnotes } = isolated(() => parseBlocks(markdown, context))
  if (footnotes.length > 0) root.children?.push({ type: 'footnotes', children: footnotes })
  for (const extension of use.extensions) {
    if (extension.fences) applyFences(root, [extension])
    extension.transform?.(root, markdown)
  }
  return root
}
