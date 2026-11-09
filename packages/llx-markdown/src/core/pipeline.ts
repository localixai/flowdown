import type { PluggableList } from 'unified'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'
import type { Element as HastElement, Root as HastRoot } from 'hast'
import { remarkAnswerBlocks } from './remark-answer-blocks'

/**
 * The math stage, supplied by `llx-markdown/math` (or anything with the same shape). A plugin
 * object rather than a dependency: KaTeX is a quarter of a megabyte, and only a page that imports
 * that entry ever bundles it.
 */
export interface MathPlugin {
  remarkPlugins: PluggableList
  rehypePlugins: PluggableList
}

/**
 * The grammar every document is read with: GitHub Markdown and the dialect's blocks (callouts,
 * forms, figures, quote sources, section numbers). The same list while a reply streams and after
 * it settles, so nothing re-flows at the moment it finishes.
 */
export const remarkLlx: PluggableList = [remarkGfm, remarkAnswerBlocks]

// Embedded raw HTML (READMEs with <p align>, <img> badges, <div>, …) is parsed by rehype-raw then
// sanitized: this content comes from a model or from arbitrary files, so script, style and event
// handler attributes are stripped. The schema extends GitHub's defaults with the presentational
// bits a README relies on (alignment, image sizing, link targets).
//
// The dialect's own nodes pass too. They are made by the remark pass, not by the content, but the
// sanitizer runs after it and cannot tell: a reply that also carried one HTML tag lost every
// callout, timeline and tab set. Only our names pass: `llx-` classes, the forms' data attributes
// and the two tab elements.
const DIALECT_CLASS = /^llx-/
const defaults = defaultSchema.attributes ?? {}

export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'div',
    'span',
    'picture',
    'source',
    'aside',
    'figure',
    'figcaption',
    'footer',
    'answer-tabs',
    'answer-tab',
  ],
  attributes: {
    ...defaults,
    '*': [
      ...(defaults['*'] ?? []),
      'align',
      'width',
      'height',
      ['className', DIALECT_CLASS],
      'dataCallout',
      'dataCalloutTitle',
      'dataVerdict',
      'dataLabel',
    ],
    a: [...(defaults.a ?? []), 'target', 'rel'],
    // The math parser marks its spans `math-inline` / `math-display`, and the typesetter that runs
    // after the sanitizer finds them by those classes: GitHub's `language-*` alone loses them.
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    img: [...(defaults.img ?? []), 'width', 'height', 'align'],
    source: ['srcSet', 'srcset', 'media', 'type'],
    // GitHub's schema names `className` for these three itself (the task-list classes), which
    // overrides the `*` rule above, so ours are added to theirs instead of left to the wildcard.
    ...Object.fromEntries(
      (['ol', 'ul', 'li'] as const).map((tag) => [
        tag,
        [
          ...(defaults[tag] ?? []).filter(
            (rule) => !(Array.isArray(rule) && rule[0] === 'className'),
          ),
          ['className', 'contains-task-list', 'task-list-item', DIALECT_CLASS],
        ],
      ]),
    ),
  },
}

/**
 * Undo the sanitizer's second `user-content-` prefix. remark-rehype already prefixes the ids it
 * makes (footnotes: `user-content-fn-1`, linked from `#user-content-fn-1`), and the sanitizer
 * prefixes every id again to keep content from clobbering the page's globals. A doubled prefix
 * comes only from that pair; the link it breaks is the footnote's own.
 */
const CLOBBERED = ['id', 'name', 'ariaDescribedBy', 'ariaLabelledBy'] as const
const DOUBLED = 'user-content-user-content-'
const undouble = (value: unknown): unknown =>
  typeof value === 'string' && value.startsWith(DOUBLED)
    ? value.slice('user-content-'.length)
    : Array.isArray(value)
      ? value.map(undouble)
      : value

export function rehypeUndoubleClobber() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (element: HastElement) => {
      for (const key of CLOBBERED) {
        if (key in element.properties)
          element.properties[key] = undouble(element.properties[key]) as never
      }
    })
  }
}

/**
 * Key every GFM task box by where its item sits in the source (`data-task-key`), so a host can
 * store a tick or rewrite the `[ ]` it came from. The box is generated with no position of its
 * own; its list item has one.
 */
export function rehypeTaskKeys() {
  const isBox = (node: HastElement['children'][number]): node is HastElement =>
    node.type === 'element' && node.tagName === 'input' && node.properties?.type === 'checkbox'
  return (tree: HastRoot) => {
    visit(tree, 'element', (item: HastElement) => {
      const offset = item.position?.start.offset
      if (item.tagName !== 'li' || offset === undefined) return
      // A tight item holds its box directly; a loose one inside its first paragraph.
      const first = item.children.find((child) => child.type === 'element')
      const box =
        item.children.find(isBox) ??
        (first?.type === 'element' && first.tagName === 'p'
          ? first.children.find(isBox)
          : undefined)
      if (box) box.properties = { ...box.properties, dataTaskKey: offset }
    })
  }
}

/**
 * The raw HTML stage: the parser that turns HTML in the Markdown into elements (rehype-raw, from
 * `llx-markdown/html`). The sanitizer after it is always this package's.
 */
export interface HtmlPlugin {
  rehypePlugins: PluggableList
}

export interface PipelineOptions {
  /** Parse raw HTML with this stage, then sanitize it. Omitted, raw HTML is left to the renderer. */
  html?: HtmlPlugin | null
  /** The math stage; omitted, `$…$` stays text. */
  math?: MathPlugin | null
}

/** The remark plugins for one document. */
export function remarkPluginsFor({ math }: PipelineOptions = {}): PluggableList {
  return math ? [...remarkLlx, ...math.remarkPlugins] : [...remarkLlx]
}

/**
 * The rehype plugins for one document. Raw HTML is parsed before it is cleaned; the math
 * typesetter runs last, so its own markup is not sanitized away. `beforeMath` is where a host
 * adds a pass that must see the sanitized tree.
 */
export function rehypePluginsFor(
  { html, math }: PipelineOptions = {},
  beforeMath: PluggableList = [],
): PluggableList {
  const plugins: PluggableList = []
  if (html)
    plugins.push(...html.rehypePlugins, [rehypeSanitize, sanitizeSchema], rehypeUndoubleClobber)
  // After the sanitizer, which does not know this attribute; task boxes are rare, the walk cheap.
  plugins.push(rehypeTaskKeys, ...beforeMath)
  if (math) plugins.push(...math.rehypePlugins)
  return plugins
}
