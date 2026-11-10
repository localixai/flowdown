'use client'
import { useContext, Fragment, memo, useMemo, useState, type ReactNode } from 'react'
import {
  blockHasHtml,
  blockHasMath,
  blockHasRareEntity,
  escapedBlock,
  headingIdsOfBlocks,
} from '../core/block-facts'
import { createBlockSplitter, normalizeLineEndings } from '../core/blocks'
import { closePartialMarkdown, openFenceBody } from '../core/heal'
import { llxDialect } from '../core/remark-answer-blocks'
import { DIAGRAM_FENCE_LANGUAGE } from '../dialect'
import { addEntities, hasAllEntities } from '../engine/entities'
import type { Extension } from '../engine/types'
import { Diagram } from '../mermaid/diagram'
import { mermaidRendererFor, type MermaidLoader } from '../mermaid/renderer'
import { Callout } from './callout'
import { Code, CodeBlock } from './code-block'
import { GrowingCode, growingFence } from './growing-code'
import {
  GrowingFence,
  RenderContextValue,
  type Highlighter,
  type MarkdownComponents,
  type RenderContext,
} from './context'
import { FileTree } from './file-tree'
import { LabelsContext, mergeLabels, type LabelOverrides } from './labels'
import { defaultUrlTransform, type UrlTransform } from '../engine/url'
import { draw, type BlockOptions } from './draw'
import type { Components, RenderOptions } from './render'
import { useStage, type StageOption } from './use-stage'
import { Table } from './table'
import { TableRows, tableRows } from './table-rows'
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
  /**
   * Your own elements for any tag (`a`, `img`, `pre`, `table`, …) or the dialect's, and your own
   * drawing of a ```mermaid fence (`diagram`) or a ```tree fence (`tree`).
   */
  components?: MarkdownComponents
  /**
   * Your own syntax, after the dialect's: inline rules, fences by language, and passes over the
   * tree, each run on every block. A node's position counts from the start of its block. Keep the
   * list's reference stable (a module constant): a new list reads every block again.
   */
  extensions?: Extension[]
  /**
   * Give headings ids (`setup`, `setup-1`) to link to, the same ids `extractHeadings` returns.
   * Each block's headings are read once, so it costs a streaming reply only its last block.
   */
  headingIds?: boolean
  /**
   * Raw HTML in the text, parsed and sanitized. `true` (the default) fetches the parser the first
   * time a document holds HTML, and leaves the tags out until it is there; pass `llx-markdown/html`
   * itself to have it in the first render (a server); `false` drops raw HTML.
   */
  html?: boolean | StageOption<Extension>
  /** Typeset `$…$`: `llx-markdown/math`, or a loader for it. Off by default. */
  math?: StageOption<Extension>
  /** Draw ```mermaid fences: `() => import('mermaid')`. Off by default: they show as code. */
  mermaid?: MermaidLoader | null
  /** Highlight fenced code: `llx-markdown/highlight`, or your own. Off by default. */
  highlight?: Highlighter | null
  /** The words the renderer adds (callout names, button labels), for a page in another language. */
  labels?: LabelOverrides
  /**
   * Rewrite or refuse a link or image URL. Omitted (or null), relative URLs and http, https,
   * mailto, irc, ircs and xmpp are kept and everything else is emptied (`javascript:`, `tel:` and
   * `data:` among them).
   */
  urlTransform?: UrlTransform | null
  className?: string
}

interface BlockProps {
  source: string
  offset: number
  growing: boolean
  /** The anchors of the headings inside this block, by their offset in the document. */
  headingIds: ReadonlyMap<number, string> | null
  /** The same anchors as text: the memo compares this, since the map is new on every render. */
  headingKey: string
  options: BlockOptions
}

export { draw, type BlockOptions } from './draw'

/** The package's own HTML stage, fetched as a chunk of its own the first time it is needed. */
const loadHtml = () => import('../html/index')

/** Every HTML5 named reference: ten kilobytes fetched the first time a document uses a rare one. */
const loadEntities = () =>
  import('../engine/entity-table').then((module) => {
    addEntities(module.ENTITY_TABLE)
    return module
  })

/** A page's own diagram, told whether its fence is the one still being written. */
function OwnDiagram({
  as: Page,
  source,
}: {
  as: NonNullable<MarkdownComponents['diagram']>
  source: string
}) {
  return <Page source={source} growing={useContext(GrowingFence)} />
}

/**
 * The elements a document is drawn with: the dialect's (callouts, tabs, code blocks), then the
 * page's. The two fences that are not code (```mermaid, ```tree) are drawn by `special`, outside
 * both `pre` and `code`, so a page's own code block never receives a diagram.
 */
export function buildComponents(overrides: MarkdownComponents | undefined): {
  components: Components
  special: RenderOptions['special']
} {
  const { diagram: PageDiagram, tree: PageTree, ...elements } = overrides ?? {}
  return {
    components: {
      blockquote: Callout,
      table: Table,
      'answer-tabs': Tabs,
      'answer-tab': Tab,
      pre: CodeBlock,
      code: Code,
      ...elements,
    } as Components,
    special: (language, source) =>
      language === DIAGRAM_FENCE_LANGUAGE ? (
        PageDiagram ? (
          <OwnDiagram as={PageDiagram} source={source} />
        ) : (
          <Diagram source={source} />
        )
      ) : PageTree ? (
        <PageTree source={source} />
      ) : (
        <FileTree source={source} />
      ),
  }
}

const Block = memo(
  function Block({ source, offset, growing, headingIds, options }: BlockProps) {
    const fence = growing && !options.ownCode ? growingFence(source) : null
    if (
      fence &&
      fence.language !== DIAGRAM_FENCE_LANGUAGE &&
      fence.language !== 'tree' &&
      // A `math` fence is a formula where the page typesets math, and code where it does not.
      !(fence.language === 'math' && options.extensions?.some((stage) => stage.name === 'math'))
    )
      return <GrowingCode {...fence} />
    // A table that is the whole block is drawn row by row, unless the page reads tables itself
    // (its own elements or extensions see the table whole).
    const table = options.ownTable ? null : tableRows(source)
    if (table) return <TableRows {...table} options={options} />
    return (
      <GrowingFence.Provider value={growing}>
        {draw(source, offset, headingIds, options)}
      </GrowingFence.Provider>
    )
  },
  (before, after) =>
    before.source === after.source &&
    before.offset === after.offset &&
    before.growing === after.growing &&
    before.headingKey === after.headingKey &&
    before.options === after.options,
)

const NO_EXTENSIONS: Extension[] = []

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
  extensions = NO_EXTENSIONS,
  headingIds = false,
  html = true,
  math: mathOption = null,
  mermaid = null,
  highlight = null,
  labels,
  urlTransform,
  className,
}: MarkdownProps): ReactNode {
  // `\r\n` from a Windows file or a server that sends it reads as `\n` everywhere below.
  const text = normalizeLineEndings(children)
  const healed = streaming ? closePartialMarkdown(text) : text
  // One splitter per rendered document: it remembers the blocks it cut, and on the next token
  // scans only the end of the reply. Blocks that did not change come back as the same objects,
  // and everything worked out from a block below is kept beside it.
  const [splitter] = useState(createBlockSplitter)
  const cut = useMemo(() => splitter.split(healed), [splitter, healed])
  // Literal dollars are escaped only where `$` can mean math: elsewhere positions stay exact.
  const blocks = useMemo(() => (mathOption ? cut.map(escapedBlock) : cut), [cut, mathOption])

  const math = useStage(mathOption, mathOption !== null && blocks.some(blockHasMath))
  // Whether the document has HTML is decided for the whole of it, not per block: a tag still
  // being typed (`<div`) is its own block, and only the whole document says it is HTML.
  const htmlStage = useStage(
    html === true ? loadHtml : html === false ? null : html,
    html !== false && blocks.some(blockHasHtml),
  )
  // A name outside the common ones shows as written until the whole table is there.
  const entities = useStage(loadEntities, !hasAllEntities() && blocks.some(blockHasRareEntity))
  const ids = useMemo(() => (headingIds ? headingIdsOfBlocks(blocks) : null), [headingIds, blocks])
  const options = useMemo<BlockOptions>(
    () => ({
      ...buildComponents(components),
      // Raw HTML is made into elements last, so every pass before it sees the text as written.
      extensions: [
        llxDialect,
        ...(math ? [math] : []),
        ...extensions,
        ...(htmlStage ? [htmlStage] : []),
      ],
      urlTransform: urlTransform ?? defaultUrlTransform,
      ownCode: Boolean(components?.pre || components?.code),
      ownTable: Boolean(
        components?.table || components?.thead || components?.tbody || extensions.length,
      ),
    }),
    // `entities` is here so that blocks are read again once every name can be decoded.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [htmlStage, math, urlTransform, components, extensions, entities],
  )
  const context = useMemo<RenderContext>(
    () => ({ highlight, mermaid: mermaid ? mermaidRendererFor(mermaid) : null }),
    [highlight, mermaid],
  )
  const labelValue = useMemo(() => mergeLabels(labels), [labels])
  const endsInFence = streaming && openFenceBody(text) !== null

  return (
    <LabelsContext.Provider value={labelValue}>
      <RenderContextValue.Provider value={context}>
        <div
          className={className ? `llx-markdown ${className}` : 'llx-markdown'}
          data-streaming={streaming || undefined}
          data-caret={(streaming && caret) || undefined}
        >
          {blocks.map((block, index) => {
            // A block gets only its own anchors, keyed by their text: a map is new on every
            // render, and comparing it would redraw every block.
            const own = ids?.[index] ?? null
            return (
              <Fragment key={index}>
                {/* One parse puts a line break between top-level blocks; so does this, so the
                    text of the page (and a copy of it) is the same either way. */}
                {index > 0 ? '\n' : null}
                <Block
                  source={block.source}
                  offset={block.offset}
                  growing={endsInFence && index === blocks.length - 1}
                  headingIds={own && own.size > 0 ? own : null}
                  headingKey={own ? [...own].map(([at, id]) => `${at}:${id}`).join(';') : ''}
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
