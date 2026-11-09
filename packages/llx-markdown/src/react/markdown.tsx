'use client'
import { createElement, Fragment, memo, useMemo, type ElementType, type ReactNode } from 'react'
import ReactMarkdown, { type Components, type UrlTransform } from 'react-markdown'
import { splitBlocks } from '../core/blocks'
import { escapeLiteralDollars } from '../core/dollars'
import { closePartialMarkdown, openFenceBody } from '../core/heal'
import { headingIdsByOffset, rehypeHeadingIds } from '../core/headings'
import {
  rehypePluginsFor,
  remarkPluginsFor,
  type HtmlPlugin,
  type MathPlugin,
} from '../core/pipeline'
import { remarkBlockOffset } from '../core/positions'
import { hasHtmlSyntax, hasMathSyntax } from '../core/syntax'
import { DIAGRAM_FENCE_LANGUAGE, TREE_FENCE_LANGUAGE } from '../dialect'
import { Diagram } from '../mermaid/diagram'
import { mermaidRendererFor, type MermaidLoader } from '../mermaid/renderer'
import { Callout } from './callout'
import { Code, CodeBlock } from './code-block'
import { GrowingFence, RenderContextValue, type Highlighter, type RenderContext } from './context'
import { FileTree } from './file-tree'
import { childrenToText, getLanguage } from './helpers'
import { LabelsContext, mergeLabels, type LabelOverrides } from './labels'
import { useStage, type StageOption } from './use-stage'
import { Table } from './table'
import { Tab, Tabs } from './tabs'

export interface MarkdownProps {
  /** The Markdown. */
  children: string
  /**
   * The text is a reply still arriving. Its unfinished end is completed so it does not flash raw
   * syntax (`**bo` reads as bold, a fence still being written as code), and a caret follows it.
   */
  streaming?: boolean
  /** The caret after streaming text; on by default while `streaming`. */
  caret?: boolean
  /** Your own elements for any tag (`a`, `img`, `pre`, `table`, …) or the dialect's. */
  components?: Components
  /**
   * Give headings ids (`setup`, `setup-1`) to link to, the same ids `extractHeadings` returns.
   * It reads the whole document on each change, so leave it off for a reply that streams.
   */
  headingIds?: boolean
  /**
   * Raw HTML in the text, parsed and sanitized. `true` (the default) fetches the parser the first
   * time a document holds HTML, and leaves the tags out until it is there; pass `llx-markdown/html`
   * itself to have it in the first render (a server); `false` drops raw HTML.
   */
  html?: boolean | StageOption<HtmlPlugin>
  /** Typeset `$…$`: `llx-markdown/math`, or a loader for it. Off by default. */
  math?: StageOption<MathPlugin>
  /** Draw ```mermaid fences: `() => import('mermaid')`. Off by default: they show as code. */
  mermaid?: MermaidLoader | null
  /** Highlight fenced code: `llx-markdown/highlight`, or your own. Off by default. */
  highlight?: Highlighter | null
  /** The words the renderer adds (callout names, button labels), for a page in another language. */
  labels?: LabelOverrides
  /**
   * Rewrite or refuse a link or image URL; react-markdown's default keeps relative URLs and http,
   * https, mailto, tel, irc and xmpp, and drops everything else (`javascript:` among them).
   */
  urlTransform?: UrlTransform | null
  className?: string
}

/** What a block needs besides its text; one object per document, so blocks can compare it. */
interface BlockOptions {
  components: Components
  /**
   * The raw HTML stage, when the document has HTML and the stage is there. Without it, raw HTML
   * is left out: dropped when the page turned HTML off, not yet parsed while it loads.
   */
  html: HtmlPlugin | null
  math: MathPlugin | null
  urlTransform: UrlTransform | null | undefined
}

interface BlockProps {
  source: string
  offset: number
  line: number
  growing: boolean
  /** The anchors of the headings inside this block, by their offset in the document. */
  headingIds: ReadonlyMap<number, string> | null
  /** The same anchors as text: the memo compares this, since the map is new on every render. */
  headingKey: string
  options: BlockOptions
}

/** The package's own HTML stage, fetched as a chunk of its own the first time it is needed. */
const loadHtml = () => import('../html/index')

const special = (language: string | undefined) =>
  language === DIAGRAM_FENCE_LANGUAGE || language === TREE_FENCE_LANGUAGE

function classOf(node: unknown): string | undefined {
  const child = (
    node as { children?: Array<{ type: string; properties?: { className?: unknown } }> }
  )?.children?.[0]
  const classes = child?.type === 'element' ? child.properties?.className : undefined
  return Array.isArray(classes) ? classes.join(' ') : undefined
}

/**
 * The elements a document is drawn with: the dialect's (callouts, tabs, code blocks), then the
 * page's, with the two fences that are not code (```mermaid, ```tree) taken out of both `pre` and
 * `code`, so a page's own code block never receives a diagram.
 */
export function buildComponents(overrides: Components | undefined): Components {
  const PageCode = (overrides?.code ?? Code) as ElementType
  const PagePre = (overrides?.pre ?? CodeBlock) as ElementType
  const code: Components['code'] = (props) => {
    const language = getLanguage(props.className)
    const text = childrenToText(props.children).replace(/\n$/, '')
    if (language === DIAGRAM_FENCE_LANGUAGE) return <Diagram source={text} />
    if (language === TREE_FENCE_LANGUAGE) return <FileTree source={text} />
    return createElement(PageCode, props)
  }
  // A diagram or a tree is a block of its own, not code: never inside a <pre>.
  const pre: Components['pre'] = (props) =>
    special(getLanguage(classOf(props.node))) ? (
      <>{props.children}</>
    ) : (
      createElement(PagePre, props)
    )
  return {
    blockquote: Callout,
    table: Table,
    'answer-tabs': Tabs,
    'answer-tab': Tab,
    ...overrides,
    code,
    pre,
  } as Components
}

const Block = memo(
  function Block({ source, offset, line, growing, headingIds, options }: BlockProps) {
    const { components, html, math, urlTransform } = options
    const remarkPlugins = [remarkBlockOffset({ offset, line }), ...remarkPluginsFor({ math })]
    const rehypePlugins = rehypePluginsFor(
      { html, math },
      headingIds ? [rehypeHeadingIds(headingIds)] : [],
    )
    return (
      <GrowingFence.Provider value={growing}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
          skipHtml={!html}
          {...(urlTransform === undefined ? {} : { urlTransform })}
        >
          {source}
        </ReactMarkdown>
      </GrowingFence.Provider>
    )
  },
  (before, after) =>
    before.source === after.source &&
    before.offset === after.offset &&
    before.line === after.line &&
    before.growing === after.growing &&
    before.headingKey === after.headingKey &&
    before.options === after.options,
)

/**
 * Markdown with the llx dialect: GitHub Markdown, callouts, steps, tabs, stats, pros and cons,
 * figures, file trees and, when the page supplies them, diagrams, formulas and highlighted code.
 *
 * The document is drawn as its top-level blocks, each remembered by its text: while a reply
 * streams, the blocks above its end do not change, and only the last one is parsed and drawn
 * again on each token.
 */
export function Markdown({
  children,
  streaming = false,
  caret = streaming,
  components,
  headingIds = false,
  html = true,
  math: mathOption = null,
  mermaid = null,
  highlight = null,
  labels,
  urlTransform,
  className,
}: MarkdownProps): ReactNode {
  const healed = streaming ? closePartialMarkdown(children) : children
  // Literal dollars are escaped only where `$` can mean math: elsewhere positions stay exact.
  const source = mathOption ? escapeLiteralDollars(healed) : healed
  const math = useStage(mathOption, hasMathSyntax(source))

  const ids = useMemo(() => (headingIds ? headingIdsByOffset(source) : null), [headingIds, source])
  const merged = useMemo(() => buildComponents(components), [components])
  // Whether the document has HTML is decided for the whole of it, not per block: a tag still
  // being typed (`<div`) is its own block, and only the whole document says it is HTML.
  const htmlStage = useStage(
    html === true ? loadHtml : html === false ? null : html,
    hasHtmlSyntax(source),
  )
  const options = useMemo<BlockOptions>(
    () => ({ components: merged, html: htmlStage, math, urlTransform }),
    [merged, htmlStage, math, urlTransform],
  )
  const context = useMemo<RenderContext>(
    () => ({ highlight, mermaid: mermaid ? mermaidRendererFor(mermaid) : null }),
    [highlight, mermaid],
  )
  const labelValue = useMemo(() => mergeLabels(labels), [labels])

  const blocks = useMemo(() => splitBlocks(source), [source])
  const endsInFence = streaming && openFenceBody(children) !== null

  return (
    <LabelsContext.Provider value={labelValue}>
      <RenderContextValue.Provider value={context}>
        <div
          className={className ? `llx-markdown ${className}` : 'llx-markdown'}
          data-streaming={streaming || undefined}
          data-caret={(streaming && caret) || undefined}
        >
          {blocks.map((block, index) => {
            // A block gets only its own anchors, keyed by their text: the ids of the whole
            // document change on every token, and passing them all would redraw every block.
            const end = block.offset + block.source.length
            const own = ids ? [...ids].filter(([at]) => at >= block.offset && at < end) : null
            return (
              <Fragment key={index}>
                {/* One parse puts a line break between top-level blocks; so does this, so the
                    text of the page (and a copy of it) is the same either way. */}
                {index > 0 ? '\n' : null}
                <Block
                  source={block.source}
                  offset={block.offset}
                  line={block.line}
                  growing={endsInFence && index === blocks.length - 1}
                  headingIds={own ? new Map(own) : null}
                  headingKey={own ? own.map(([at, id]) => `${at}:${id}`).join(';') : ''}
                  options={options}
                />
              </Fragment>
            )
          })}
        </div>
      </RenderContextValue.Provider>
    </LabelsContext.Provider>
  )
}
