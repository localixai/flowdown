/**
 * A whole document as plain elements (`vnode.ts`): what `<Markdown>` draws with React, for the
 * targets that have no framework. The HTML text of one (`@localix-ai/flowdown/static`) and the page kept
 * up to date from one (`@localix-ai/flowdown/dom`) are both made here, so they hold the same elements.
 */
import { parseFileTree, type TreeRow } from '../core/file-tree-parse'
import { flowdownDialect } from '../core/remark-answer-blocks'
import { DIAGRAM_FENCE_LANGUAGE } from '../dialect'
import { createDocument, usesHtml, usesMath, type MarkdownBlock } from '../document'
import { createCutter, createFenceMemory, growingFence } from '../document/fence'
import { tableRows } from '../document/table'
import { parse } from '../engine'
import type { Extension, Node } from '../engine/types'
import { defaultUrlTransform, type UrlTransform } from '../engine/url'
import type { Props } from './factory'
import { mergeLabels, type LabelOverrides, type MarkdownLabels } from './labels'
import { createRenderer } from './tree'
import * as views from './views'
import { expand, vnode, type Drawn, type DrawnElement, type VComponent, type VNode } from './vnode'

/** Your own elements for any tag (`a`, `img`, `pre`, `table`, …) or the dialect's. */
export type ViewComponents = Record<string, VComponent | undefined>

export interface ViewOptions {
  components?: ViewComponents
  /** Your own drawing of a ```mermaid fence; `growing` while the fence is still being written. */
  diagram?: (source: string, growing: boolean) => VNode
  /** Your own drawing of a ```tree fence. */
  tree?: (source: string) => VNode
  /** Your own syntax, after the dialect's (`Extension`). */
  extensions?: Extension[]
  /** Give headings ids (`setup`, `setup-1`) to link to. */
  headingIds?: boolean
  /** Raw HTML in the text, parsed and sanitized: `@localix-ai/flowdown/html`. Without it the tags are left out. */
  html?: Extension | null
  /** Typeset `$…$`: `@localix-ai/flowdown/math`. */
  math?: Extension | null
  /** Highlight fenced code: `@localix-ai/flowdown/highlight`, or your own. */
  highlight?: views.Highlighter | null
  /** The words the renderer adds (callout names, button labels), for a page in another language. */
  labels?: LabelOverrides
  /** Rewrite or refuse a link or image URL; by default only safe protocols are kept. */
  urlTransform?: UrlTransform | null
  className?: string
  /** Leaves the `flowdown` class off the root element, so the package's stylesheet does not apply. */
  unstyled?: boolean
  /** The caret after streaming text; on by default while streaming. */
  caret?: boolean
  /**
   * What the ids of a `[!TABS]` form's tabs and panels start with. Two documents on one page need
   * two prefixes; `@localix-ai/flowdown/dom` gives each of its own.
   */
  idPrefix?: string
  /** The page the view is drawn on: with one, its tabs, trees and buttons answer the reader. */
  host?: ViewHost
}

/**
 * What makes a view alive. A view drawn as HTML text has none, and its tabs, file trees and code
 * buttons are drawn and nothing more; given one, they carry listeners (`onClick`, `onKeyDown`)
 * that change what the view shows and ask the host to draw it again.
 */
export interface ViewHost {
  /** Something the reader did changed what the document shows: draw it again, now. */
  redraw(): void
  /** Put `text` on the clipboard; resolves whether it got there. */
  copy(text: string): Promise<boolean>
  /** Save `text` as a file named after its fence's title, or its language. */
  download(text: string, title: string | undefined, language: string | undefined): void
  /** The box of a table, each time it is drawn: a host that can measure makes a wide one scroll. */
  table?(box: unknown): void
}

/** What a listener is given, as far as the view reads it. */
interface KeyPress {
  key: string
  preventDefault(): void
  stopPropagation(): void
}

/** How long "Copied" stays before the button reads "Copy" again. */
const COPIED_MS = 1_600

const focusOn = (element: unknown): void =>
  (element as { focus?: () => void } | undefined)?.focus?.()

export interface View {
  /**
   * The document's root element for `text`; `streaming` while the reply is still arriving. What
   * a block drew is kept: a block that did not change gives the very same elements again, so a
   * target that compares by identity leaves them alone.
   */
  render(text: string, streaming?: boolean): DrawnElement
  /** Stops what a reader's action left running (a "Copied" that has yet to go back to "Copy"). */
  dispose(): void
}

const draw = createRenderer(vnode)

const NOTHING: VComponent = () => []
const CHILDREN: VComponent = (_props, children) => children

/** How many body rows one piece of a table holds: the same pieces `<Markdown>` draws. */
const ROWS = 16

const headingKeyOf = (own: ReadonlyMap<number, string> | null): string =>
  own ? [...own].map(([at, id]) => `${at}:${id}`).join(';') : ''

interface Kept {
  stages: string
  closer: string
  growing: boolean
  offset: number
  headingKey: string
  nodes: Drawn[]
}

export function createView(options: ViewOptions = {}): View {
  const labels: MarkdownLabels = mergeLabels(options.labels)
  const highlight = options.highlight ?? null
  const own = options.components
  // What the document is read with. Math and raw HTML are passes a document without either does
  // not pay for, exactly as `<Markdown>` leaves them out: set for each `render`.
  let extensions: Extension[] = [flowdownDialect]
  let math: Extension | null = null
  const urlTransform = options.urlTransform ?? defaultUrlTransform
  const ownCode = Boolean(own?.pre || own?.code)
  const ownTable = Boolean(
    own?.table || own?.thead || own?.tbody || (options.extensions?.length ?? 0) > 0,
  )
  const prefix = options.idPrefix ?? 'fd-'
  const { diagram: pageDiagram, tree: pageTree } = options

  /** Where the block being drawn starts in the document, and whether it is the fence still growing. */
  let offset = 0
  let growing = false

  const host = options.host ?? null
  /** Blocks, by where they start, that a reader's action changed: drawn again at the next render. */
  const stale = new Set<number>()
  /** How many live parts the block being drawn has made: with the block's offset, a part's name. */
  let serial = 0
  const tabStates = new Map<string, { active: number; buttons: unknown[] }>()
  const treeStates = new Map<
    string,
    { collapsed: Set<string>; focused: string | null; elements: Map<string, unknown> }
  >()
  /** The code blocks that read "Copied", each with the timer that ends it. */
  const copied = new Map<string, ReturnType<typeof setTimeout>>()

  const changed = (at: number) => {
    stale.add(at)
    host!.redraw()
  }

  const buttons = (
    text: string,
    title: string | undefined,
    language: string | undefined,
  ): VNode[] => {
    if (!host) return [views.downloadButton(vnode, labels), views.copyButton(vnode, labels, false)]
    const at = offset
    const id = `${at}.${serial++}`
    const copy = () => {
      // When the clipboard refuses there is nothing to say: the code is still selectable.
      void host.copy(text).then((done) => {
        if (!done) return
        clearTimeout(copied.get(id))
        copied.set(
          id,
          setTimeout(() => {
            copied.delete(id)
            changed(at)
          }, COPIED_MS),
        )
        changed(at)
      })
    }
    return [
      views.downloadButton(vnode, labels, () => host.download(text, title, language)),
      views.copyButton(vnode, labels, copied.has(id), copy),
    ]
  }

  /** `[!TABS]` on a page: the WAI-ARIA tabs pattern, as `<Markdown>` has it. */
  const liveTabs = (list: Array<views.TabView<VNode>>, id: string): VNode => {
    const at = offset
    let state = tabStates.get(id)
    if (!state) tabStates.set(id, (state = { active: 0, buttons: [] }))
    const tab = state
    tab.buttons = []
    // A streamed form can lose a tab between renders only by being re-parsed; never point past it.
    const current = tab.active < list.length ? tab.active : 0
    const select = (index: number, focus: boolean) => {
      const next = (index + list.length) % list.length
      tab.active = next
      changed(at)
      if (focus) focusOn(tab.buttons[next])
    }
    return views.tabs(vnode, list, current, id, labels, (index) => ({
      ref: (element: unknown) => {
        tab.buttons[index] = element
      },
      onClick: () => select(index, false),
      onKeyDown: (event: KeyPress) => {
        const moves: Record<string, number> = {
          ArrowRight: index + 1,
          ArrowLeft: index - 1,
          Home: 0,
          End: list.length - 1,
        }
        const target = moves[event.key]
        if (target === undefined) return
        event.preventDefault()
        select(target, true)
      },
    }))
  }

  /** A ```tree fence on a page: folders fold, and the arrow keys walk the rows (the tree pattern). */
  const liveTree = (rows: TreeRow[]): VNode => {
    const at = offset
    const id = `${at}.${serial++}`
    let state = treeStates.get(id)
    if (!state)
      treeStates.set(id, (state = { collapsed: new Set(), focused: null, elements: new Map() }))
    const tree = state
    tree.elements = new Map()
    const toggle = (path: string) => {
      if (!tree.collapsed.delete(path)) tree.collapsed.add(path)
      changed(at)
    }
    const focus = (row: TreeRow | undefined) => {
      if (row) focusOn(tree.elements.get(row.path))
    }
    return views.fileTree(
      vnode,
      {
        rows,
        collapsed: tree.collapsed,
        focused: tree.focused,
        on: (row, visible) => ({
          ref: (element: unknown) => {
            tree.elements.set(row.path, element)
          },
          onFocus: () => {
            if (tree.focused === row.path) return
            tree.focused = row.path
            changed(at)
          },
          onClick: (event: { currentTarget: unknown }) => {
            // Safari leaves a clicked row unfocused; the keys must carry on from it.
            focusOn(event.currentTarget)
            if (row.folder) toggle(row.path)
          },
          onKeyDown: (event: KeyPress) => {
            const index = visible.indexOf(row)
            const open = row.folder && !tree.collapsed.has(row.path)
            const parent = row.parent === null ? undefined : rows[row.parent]
            const actions: Record<string, () => void> = {
              ArrowDown: () => focus(visible[index + 1]),
              ArrowUp: () => focus(visible[index - 1]),
              Home: () => focus(visible[0]),
              End: () => focus(visible.at(-1)),
              ArrowRight: () => (open ? focus(visible[index + 1]) : row.folder && toggle(row.path)),
              ArrowLeft: () => (open ? toggle(row.path) : focus(parent)),
              Enter: () => row.folder && toggle(row.path),
              ' ': () => row.folder && toggle(row.path),
            }
            const action = actions[event.key]
            if (!action) return
            // Handled here, so not also by the page around the reply; the keys the tree leaves
            // (Escape, Tab) still reach it.
            event.preventDefault()
            event.stopPropagation()
            action()
          },
        }),
      },
      labels,
    )
  }

  const components: Record<string, VComponent | undefined> = {
    blockquote: (props, children) => views.callout(vnode, props, children, labels),
    table: (props, children) =>
      views.table(
        vnode,
        props,
        children,
        false,
        labels,
        host?.table ? { ref: host.table } : undefined,
      ),
    'answer-tabs': (props, children) => {
      const list = views.readTabs(vnode, children)
      if (list.length === 0) return []
      const at = (props.node as Node | undefined)?.position?.start.offset ?? 0
      const id = `${prefix}${offset + at}`
      return host ? liveTabs(list, id) : views.tabs(vnode, list, 0, id, labels)
    },
    pre: ({ node: _node, ...props }, children) => {
      const { language, title, text } = views.readCodeBlock(vnode, children)
      return views.codeFrame(
        vnode,
        language,
        views.codeBar(vnode, language, title, buttons(text, title, language)),
        props,
        children,
      )
    },
    code: (props, children) => views.code(vnode, props, children, highlight),
    ...own,
  }

  const special = (language: string, source: string): VNode =>
    language === DIAGRAM_FENCE_LANGUAGE
      ? pageDiagram
        ? pageDiagram(source, growing)
        : views.diagramSource(vnode, source, null, false)
      : pageTree
        ? pageTree(source)
        : treeOf(source)

  const treeOf = (source: string): VNode => {
    const rows = parseFileTree(source)
    if (rows.length === 0) return []
    if (host) return liveTree(rows)
    return views.fileTree(vnode, { rows, collapsed: new Set(), focused: null }, labels)
  }

  const one = (
    source: string,
    at: number,
    ids: ReadonlyMap<number, string> | null,
    using: Record<string, VComponent | undefined>,
  ): VNode =>
    draw(parse(source, { extensions }), {
      components: using,
      urlTransform,
      special,
      offset: at,
      headingIds: ids,
    })

  // A table's own shell taken off: a piece yields its rows alone.
  const headParts = { ...components, table: CHILDREN, tbody: NOTHING }
  const bodyParts = { ...components, table: CHILDREN, thead: NOTHING, tbody: CHILDREN }

  const memory = createFenceMemory()
  const cut = createCutter()

  /** A code fence still being written, in the pieces it is highlighted by. */
  const growingCode = (language: string | undefined, title: string, body: string): VNode => {
    // The class a finished block gets when its language is one the highlighter knows.
    const known = Boolean(language && highlight && highlight('', language) !== null)
    const className = [language ? `language-${language}` : null, known ? 'fd-highlighted' : null]
      .filter(Boolean)
      .join(' ')
    const pieces: VNode[] = cut(body).parts.map((text) => {
      const html = known ? highlight!(text, language!) : null
      return html === null ? text : vnode.element('span', { innerHTML: html }, [])
    })
    // A finished block's text ends in a newline unless it is highlighted; so does this.
    if (!known && body) pieces.push('\n')
    return views.codeFrame(
      vnode,
      language,
      views.codeBar(vnode, language, title, buttons(body, title, language)),
      null,
      [vnode.element('code', { className: className || undefined }, pieces)],
    )
  }

  const block = (open: string, closer: string, ids: ReadonlyMap<number, string> | null): VNode => {
    const fence = growing && !ownCode ? growingFence(open, closer, memory) : null
    if (
      fence &&
      fence.language !== DIAGRAM_FENCE_LANGUAGE &&
      fence.language !== 'tree' &&
      // A `math` fence is a formula where the page typesets math, and code where it does not.
      !(fence.language === 'math' && math)
    )
      return growingCode(fence.language, fence.title, fence.body)
    const source = closer ? open + closer : open
    // A table that is the whole block is drawn as its header and its rows, as `<Markdown>` does.
    const rows = ownTable ? null : tableRows(source)
    if (rows) {
      const pieces: VNode[] = []
      for (let at = 0; at < rows.rows.length; at += ROWS)
        pieces.push(one(rows.head + rows.rows.slice(at, at + ROWS).join('\n'), 0, null, bodyParts))
      return vnode.element(components.table!, null, [
        one(rows.head, 0, null, headParts),
        vnode.element('tbody', null, pieces),
      ])
    }
    return one(source, offset, ids, components)
  }

  const doc = createDocument()
  /** What each block drew last: a block that did not change is not drawn again. */
  const drawn = new WeakMap<MarkdownBlock, Kept>()

  return {
    render(text, streaming = false) {
      const state = doc.update(text, {
        streaming,
        math: Boolean(options.math),
        headingIds: options.headingIds ?? false,
      })
      math = options.math && usesMath(state.blocks) ? options.math : null
      // Whether the document has HTML is decided for the whole of it, not per block: a tag still
      // being typed (`<div`) is its own block, and only the whole document says it is HTML.
      const html = options.html && usesHtml(state.blocks) ? options.html : null
      extensions = [
        flowdownDialect,
        ...(math ? [math] : []),
        ...(options.extensions ?? []),
        // Raw HTML is made into elements last, so every pass before it sees the text as written.
        ...(html ? [html] : []),
      ]
      const stages = `${math ? 'm' : ''}${html ? 'h' : ''}`
      const children: Drawn[] = []
      const last = state.blocks.length - 1
      state.blocks.forEach((item, index) => {
        const closer = index === last ? state.closer : ''
        const grows = index === last && state.growing
        const ids = state.headingIds?.[index] ?? null
        const headingKey = headingKeyOf(ids)
        let made = drawn.get(item)
        if (
          made === undefined ||
          stale.has(item.offset) ||
          made.stages !== stages ||
          made.closer !== closer ||
          made.growing !== grows ||
          made.offset !== item.offset ||
          made.headingKey !== headingKey
        ) {
          offset = item.offset
          growing = grows
          serial = 0
          const nodes = expand(block(item.source, closer, ids && ids.size > 0 ? ids : null))
          made = { stages, closer, growing: grows, offset: item.offset, headingKey, nodes }
          drawn.set(item, made)
        }
        // One parse puts a line break between top-level blocks; so does this.
        if (index > 0) children.push('\n')
        for (const node of made.nodes) children.push(node)
      })
      stale.clear()
      const caret = options.caret ?? streaming
      const { className, unstyled } = options
      const props: Props = {
        className: unstyled ? className : className ? `flowdown ${className}` : 'flowdown',
        'data-streaming': streaming || undefined,
        'data-caret': (streaming && caret) || undefined,
      }
      return { tag: 'div', props, children }
    },
    dispose() {
      for (const timer of copied.values()) clearTimeout(timer)
      copied.clear()
    },
  }
}
