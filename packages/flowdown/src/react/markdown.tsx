'use client'
import { DEFAULT_CATCH_UP_MS, useSmoothText } from './use-smooth-text'
import { useContext, Fragment, memo, useMemo, useState, type ReactNode } from 'react'
import { normalizeLineEndings, type MarkdownBlock } from '../core/blocks'
import { createDocument, usesHtml, usesMath, usesRareEntity } from '../document'
import { flowdownDialect } from '../core/remark-answer-blocks'
import { DIAGRAM_FENCE_LANGUAGE } from '../dialect'
import { addEntities, hasAllEntities } from '../engine/entities'
import type { Extension } from '../engine/types'
import { Diagram } from '../mermaid/diagram'
import { setMermaidLoader, type MermaidLoader } from '../mermaid/loader'
import { Callout } from './callout'
import { Code, CodeBlock } from './code-block'
import { createFenceMemory, GrowingCode, growingFence } from './growing-code'
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
  /**
   * Show a streaming reply at an even pace instead of in the bursts it arrives in: whole words,
   * a few frames behind the text, finishing at the same pace when the reply ends. `true`, or the
   * time in milliseconds a burst takes to show (240 by default). Off by default.
   */
  smooth?: boolean | number
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
   * time a document holds HTML, and leaves the tags out until it is there; pass `@localix-ai/flowdown/html`
   * itself to have it in the first render (a server); `false` drops raw HTML.
   */
  html?: boolean | StageOption<Extension>
  /** Typeset `$…$`: `@localix-ai/flowdown/math`, or a loader for it. Off by default. */
  math?: StageOption<Extension>
  /** Draw ```mermaid fences: `() => import('mermaid')`. Off by default: they show as code. */
  mermaid?: MermaidLoader | null
  /** Highlight fenced code: `@localix-ai/flowdown/highlight`, or your own. Off by default. */
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
  /**
   * Leaves the `flowdown` class off the root element, so the package's stylesheet does not
   * apply: for a small surface that draws every element with `components` at its own scale.
   */
  unstyled?: boolean
}

interface BlockProps {
  source: string
  /**
   * The line that closes the fence the reply ends inside, on the last block only: kept beside
   * the text, not joined to it, so a long fence is not copied on every token.
   */
  closer: string
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
  function Block({ source: open, closer, offset, growing, headingIds, options }: BlockProps) {
    const [memory] = useState(createFenceMemory)
    const fence = growing && !options.ownCode ? growingFence(open, closer, memory) : null
    if (
      fence &&
      fence.language !== DIAGRAM_FENCE_LANGUAGE &&
      fence.language !== 'tree' &&
      // A `math` fence is a formula where the page typesets math, and code where it does not.
      !(fence.language === 'math' && options.extensions?.some((stage) => stage.name === 'math'))
    )
      return <GrowingCode {...fence} />
    const source = closer ? open + closer : open
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
    before.closer === after.closer &&
    before.offset === after.offset &&
    before.growing === after.growing &&
    before.headingKey === after.headingKey &&
    before.options === after.options,
)

const NO_EXTENSIONS: Extension[] = []

/**
 * How many blocks a group holds. Small enough that the group a reply is growing in is cheap to
 * go through on every token, large enough that a long reply is few groups.
 */
const GROUP = 32

const headingKeyOf = (own: ReadonlyMap<number, string> | null | undefined): string =>
  own ? [...own].map(([at, id]) => `${at}:${id}`).join(';') : ''

interface BlockGroupProps {
  /** The document's blocks and anchors; the group draws the ones from `from` up to `to`. */
  blocks: readonly MarkdownBlock[]
  ids: ReadonlyArray<ReadonlyMap<number, string>> | null
  from: number
  to: number
  /** The closing line and the growing fence of the document's last block, when it is in here. */
  closer: string
  growing: boolean
  options: BlockOptions
}

/**
 * The blocks at one run of places in the document. A block never moves to another group, so it
 * keeps what it holds (an open tab, a drawn diagram) for as long as it is there. While a reply
 * streams only its last group changes: React passes over each group above as one element, where
 * a flat list had it compare every block of the reply on every token.
 */
const BlockGroup = memo(
  function BlockGroup({ blocks, ids, from, to, closer, growing, options }: BlockGroupProps) {
    const drawn: ReactNode[] = []
    for (let index = from; index < to; index++) {
      const block = blocks[index]!
      // A block gets only its own anchors, keyed by their text: a map is new on every render,
      // and comparing it would redraw every block.
      const own = ids?.[index] ?? null
      const last = index === to - 1
      drawn.push(
        <Fragment key={index}>
          {/* One parse puts a line break between top-level blocks; so does this, so the text of
              the page (and a copy of it) is the same either way. */}
          {index > 0 ? '\n' : null}
          <Block
            source={block.source}
            closer={last ? closer : ''}
            offset={block.offset}
            growing={last && growing}
            headingIds={own && own.size > 0 ? own : null}
            headingKey={headingKeyOf(own)}
            options={options}
          />
        </Fragment>,
      )
    }
    return drawn
  },
  (before, after) => {
    if (
      before.from !== after.from ||
      before.to !== after.to ||
      before.closer !== after.closer ||
      before.growing !== after.growing ||
      before.options !== after.options ||
      (before.ids === null) !== (after.ids === null)
    )
      return false
    // From the end: in the group a reply is growing in, the block that changed is the last one.
    for (let index = after.to - 1; index >= after.from; index--) {
      const was = before.blocks[index]!
      const is = after.blocks[index]!
      // The splitter hands back a block that did not change as the same object.
      if (was !== is && (was.source !== is.source || was.offset !== is.offset)) return false
      if (after.ids) {
        const had = before.ids![index]
        const has = after.ids[index]
        // Most blocks have no heading: two empty maps are not spelled out to be compared.
        if (had !== has && ((had?.size ?? 0) > 0 || (has?.size ?? 0) > 0)) {
          if (headingKeyOf(had) !== headingKeyOf(has)) return false
        }
      }
    }
    return true
  },
)

/**
 * Markdown with the flowdown dialect: GitHub Markdown, callouts, steps, tabs, stats, pros and cons,
 * figures, file trees and, when the page supplies them, diagrams, formulas and highlighted code.
 *
 * The document is drawn as its top-level blocks, each remembered by its text: while a reply
 * streams, the blocks above its end do not change, and only the last one is parsed and drawn
 * again on each token.
 */
export function Markdown({
  children,
  streaming: arriving = false,
  smooth = false,
  caret: caretOption,
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
  unstyled = false,
}: MarkdownProps): ReactNode {
  // `\r\n` from a Windows file or a server that sends it reads as `\n` everywhere below.
  const whole = normalizeLineEndings(children)
  // Paced, the reply is still "streaming" until all of it is shown, a moment after it ended.
  const [text, behind] = useSmoothText(
    whole,
    arriving && smooth !== false,
    typeof smooth === 'number' ? smooth : DEFAULT_CATCH_UP_MS,
  )
  const streaming = arriving || behind
  const caret = caretOption ?? streaming
  // One document per `<Markdown>`: it completes the unfinished end of a streaming reply, cuts the
  // text into blocks and remembers them, so on the next token only the end of the reply is read.
  // Blocks that did not change come back as the same objects.
  const [doc] = useState(createDocument)
  const {
    blocks,
    closer,
    growing: endsInFence,
    headingIds: ids,
  } = doc.update(text, { streaming, math: Boolean(mathOption), headingIds })

  const math = useStage(mathOption, mathOption !== null && usesMath(blocks))
  // Whether the document has HTML is decided for the whole of it, not per block: a tag still
  // being typed (`<div`) is its own block, and only the whole document says it is HTML.
  const htmlStage = useStage(
    html === true ? loadHtml : html === false ? null : html,
    html !== false && usesHtml(blocks),
  )
  // A name outside the common ones shows as written until the whole table is there.
  const entities = useStage(loadEntities, !hasAllEntities() && usesRareEntity(blocks))
  const labelValue = useMemo(() => mergeLabels(labels), [labels])
  const options = useMemo<BlockOptions>(
    () => ({
      ...buildComponents(components),
      labels: labelValue,
      // Raw HTML is made into elements last, so every pass before it sees the text as written.
      extensions: [
        flowdownDialect,
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
    [htmlStage, math, urlTransform, components, extensions, entities, labelValue],
  )
  const context = useMemo<RenderContext>(() => {
    if (mermaid) setMermaidLoader(mermaid)
    return { highlight, mermaid: mermaid ? 'page' : null }
  }, [highlight, mermaid])
  const groups: ReactNode[] = []
  for (let from = 0; from < blocks.length; from += GROUP) {
    const to = Math.min(from + GROUP, blocks.length)
    const last = to === blocks.length
    groups.push(
      <BlockGroup
        key={from}
        blocks={blocks}
        ids={ids}
        from={from}
        to={to}
        closer={last ? closer : ''}
        growing={last && endsInFence}
        options={options}
      />,
    )
  }

  return (
    <LabelsContext.Provider value={labelValue}>
      <RenderContextValue.Provider value={context}>
        <div
          className={unstyled ? className : className ? `flowdown ${className}` : 'flowdown'}
          data-streaming={streaming || undefined}
          data-caret={(streaming && caret) || undefined}
        >
          {groups}
        </div>
      </RenderContextValue.Provider>
    </LabelsContext.Provider>
  )
}
