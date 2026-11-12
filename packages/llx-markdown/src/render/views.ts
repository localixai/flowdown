/**
 * What the dialect's own elements are made of, written once for every target that has elements.
 *
 * A view is a function of a {@link Factory} and of what the element shows right now: which tab is
 * open, whether the code was just copied. It keeps no state and listens to nothing: a target that
 * can (React, the DOM) holds the state and hands in the listeners, and one that cannot (a server)
 * draws the element as it first appears.
 */
import type { TreeRow } from '../core/file-tree-parse'
import { CALLOUT_KINDS, type CalloutKind } from '../dialect'
import type { Factory, Props } from './factory'
import type { MarkdownLabels } from './labels'

/**
 * The few glyphs the renderer draws, inline. A dependency on an icon library for eleven outlines
 * would cost every consumer an install, and a theme cannot restyle an icon font as simply as an
 * SVG that strokes with `currentColor`.
 *
 * Each glyph is one `<path>`: its strokes are subpaths of the same outline, and its circle or
 * rounded square is written out as arcs. A reply with a dozen code blocks and callouts draws
 * dozens of icons, and every stroke that is its own element is one more node on the page.
 *
 * Outlines from Lucide (https://lucide.dev), ISC License, Copyright (c) Lucide Contributors.
 */
export const OUTLINES = {
  info: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0zM12 16v-4M12 8h.01',
  tip: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
  important: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v2M12 13h.01',
  warning:
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  caution:
    'M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586zM12 8v4M12 16h.01',
  chevron: 'm9 18 6-6-6-6',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4',
  folder:
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  folderOpen:
    'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
  copy: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
  check: 'M20 6 9 17l-5-5',
  download: 'M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5',
} as const

/** One glyph. `props` go on its `<svg>` after its own. */
export const glyph = <E, C>(f: Factory<E, C>, outline: string, props?: Props | null): E =>
  f.element(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.75,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: 'false',
      ...props,
    },
    [f.element('path', { d: outline }, [])],
  )

/** The language a `<code>`'s class names: `language-ts` is `ts`. */
export function getLanguage(className?: string): string | undefined {
  return /language-([^\s]+)/.exec(className ?? '')?.[1]
}

/** The text of some children, whatever elements it is in. */
export function textOf<E, C>(f: Factory<E, C>, children: E[]): string {
  let out = ''
  for (const child of f.read(children))
    out += typeof child === 'string' ? child : textOf(f, child.children)
  return out
}

// A Record over the dialect's kinds, so a kind added there fails the type check here.
const CALLOUT_OUTLINES: Record<CalloutKind, string> = {
  note: OUTLINES.info,
  tip: OUTLINES.tip,
  important: OUTLINES.important,
  warning: OUTLINES.warning,
  caution: OUTLINES.caution,
}

function calloutKind(value: unknown): CalloutKind | null {
  return typeof value === 'string' && (CALLOUT_KINDS as readonly string[]).includes(value)
    ? (value as CalloutKind)
    : null
}

/**
 * A quote, or, when the dialect marked it, a typed callout (`> [!WARNING]`). An `aside` with
 * `role="note"` rather than a styled quote: a warning is not a quotation, and assistive tech should
 * announce it as the aside it is, its kind first.
 *
 * The kind is carried by the glyph alone, in its colour. Its name is spoken, not printed, and a
 * title is printed only when the author wrote one (`> [!TIP] Faster builds`).
 */
export function callout<E, C>(
  f: Factory<E, C>,
  {
    node: _node,
    'data-callout': marked,
    'data-callout-title': title,
    className,
    cite,
    ...quoteProps
  }: Props,
  children: E[],
  labels: MarkdownLabels,
): E {
  const kind = calloutKind(marked)
  if (!kind) return f.element('blockquote', { className, cite, ...quoteProps }, children)
  return f.element(
    'aside',
    {
      ...quoteProps,
      className: className ? `llx-callout ${className as string}` : 'llx-callout',
      'data-callout': kind,
      role: 'note',
      'aria-label': title || labels.callouts[kind],
    },
    [
      glyph(f, CALLOUT_OUTLINES[kind], { className: 'llx-callout-icon' }),
      f.element('div', { className: 'llx-callout-body' }, [
        ...(title
          ? [f.element('div', { className: 'llx-callout-title' }, [f.text(title as string)])]
          : []),
        ...children,
      ]),
    ],
  )
}

/**
 * Turns a fence's code into highlighted HTML, or returns null to leave it plain. The HTML goes into
 * the page as is, so a highlighter must escape the code it was given (highlight.js and Shiki do);
 * `llx-markdown/highlight` is one.
 */
export type Highlighter = (code: string, language: string) => string | null

/**
 * Code, inline or in a fence. A fenced block is highlighted when the page gave a highlighter and
 * the fence names a language it knows; otherwise its text is printed as is.
 */
export function code<E, C>(
  f: Factory<E, C>,
  { node: _node, className, ...props }: Props,
  children: E[],
  highlight: Highlighter | null,
): E {
  const language = getLanguage(className as string | undefined)
  const html =
    language && highlight ? highlight(textOf(f, children).replace(/\n$/, ''), language) : null
  if (html === null) return f.element('code', { className, ...props }, children)
  return f.element(
    'code',
    {
      className: [className, 'llx-highlighted'].filter(Boolean).join(' '),
      ...props,
      innerHTML: html,
    },
    [],
  )
}

/** What a code block's bar and buttons need of a `<pre>`'s children: its one `<code>`. */
export function readCodeBlock<E, C>(
  f: Factory<E, C>,
  children: E[],
): { language: string | undefined; title: string | undefined; text: string } {
  const items = f.read(children)
  const only = items.length === 1 && typeof items[0] !== 'string' ? items[0]! : null
  return {
    language: getLanguage(only?.props.className as string | undefined),
    title: only?.props['data-title'] as string | undefined,
    text: only ? textOf(f, only.children).replace(/\n$/, '') : '',
  }
}

/** The copy button of a code block, before and after a copy. */
export const copyButton = <E, C>(
  f: Factory<E, C>,
  labels: MarkdownLabels,
  copied: boolean,
  onClick?: () => void,
): E =>
  f.element(
    'button',
    {
      type: 'button',
      className: 'llx-code-copy',
      onClick,
      'aria-label': copied ? labels.copied : labels.copy,
      title: copied ? labels.copied : labels.copy,
      'data-copied': copied || undefined,
    },
    [glyph(f, copied ? OUTLINES.check : OUTLINES.copy)],
  )

/** Saves the code as a file: named as its fence's title, or `code.<ext>` from its language. */
export const downloadButton = <E, C>(
  f: Factory<E, C>,
  labels: MarkdownLabels,
  onClick?: () => void,
): E =>
  f.element(
    'button',
    {
      type: 'button',
      className: 'llx-code-download',
      onClick,
      'aria-label': labels.download,
      title: labels.download,
    },
    [glyph(f, OUTLINES.download)],
  )

/** The bar of a code block: the file its fence names, its language, and the two buttons. */
export const codeBar = <E, C>(
  f: Factory<E, C>,
  language: string | undefined,
  title: string | undefined,
  buttons: E[],
): E =>
  f.element('figcaption', { className: 'llx-code-bar' }, [
    ...(title ? [f.element('span', { className: 'llx-code-title' }, [f.text(title)])] : []),
    ...(language
      ? [f.element('span', { className: 'llx-code-language' }, [f.text(language)])]
      : []),
    ...buttons,
  ])

/**
 * The frame of a code block: the bar, then the `<pre>`. A fence that names its file
 * (` ```ts title="src/app.ts" `) shows the file first, the language after it; a fence with no
 * language shows none.
 */
export const codeFrame = <E, C>(
  f: Factory<E, C>,
  language: string | undefined,
  bar: E,
  preProps: Props | null | undefined,
  children: E[],
): E =>
  f.element('figure', { className: 'llx-code', 'data-language': language }, [
    bar,
    f.element('pre', { ...preProps }, children),
  ])

/** One variant of a `[!TABS]` form: its label and what it shows. */
export interface TabView<E> {
  label: string | undefined
  children: E[]
}

/** The variants among some children: every element, whatever is between them. */
export function readTabs<E, C>(f: Factory<E, C>, children: E[]): Array<TabView<E>> {
  const list: Array<TabView<E>> = []
  for (const child of f.read(children))
    if (typeof child !== 'string')
      list.push({
        label: child.props['data-label'] as string | undefined,
        children: child.children,
      })
  return list
}

/**
 * `[!TABS]`: the variants of one answer (an install per OS, an example per language), of which
 * the reader needs one. Every panel stays in the document, `hidden`, so a search on the page, a
 * copy of the whole reply and a screen reader's panel navigation still reach the others.
 *
 * The WAI-ARIA tabs pattern: one Tab stop for the row, each tab names the panel it controls.
 * `on` gives a tab its listeners and its handle (`onClick`, `onKeyDown`, `ref`).
 */
export function tabs<E, C>(
  f: Factory<E, C>,
  list: Array<TabView<E>>,
  current: number,
  base: string,
  labels: MarkdownLabels,
  on?: (index: number) => Props,
): E {
  const tabId = (index: number) => `${base}-tab-${index}`
  const panelId = (index: number) => `${base}-panel-${index}`
  return f.element('div', { className: 'llx-tabs' }, [
    f.element(
      'div',
      { className: 'llx-tab-list', role: 'tablist', 'aria-label': labels.variants },
      list.map((tab, index) =>
        f.element(
          'button',
          {
            key: index,
            type: 'button',
            role: 'tab',
            id: tabId(index),
            className: 'llx-tab',
            'aria-selected': index === current,
            'aria-controls': panelId(index),
            tabIndex: index === current ? 0 : -1,
            ...on?.(index),
          },
          [f.text(tab.label || String(index + 1))],
        ),
      ),
    ),
    ...list.map((tab, index) =>
      f.element(
        'div',
        {
          key: index,
          role: 'tabpanel',
          id: panelId(index),
          'aria-labelledby': tabId(index),
          className: 'llx-tab-panel',
          hidden: index !== current,
        },
        tab.children,
      ),
    ),
  ])
}

/**
 * A table in a box of its own that scrolls sideways: a wide comparison then scrolls inside the
 * reply instead of widening the page. A box that scrolls is a region the Tab key stops on, so the
 * arrow keys can scroll it (WCAG 2.1.1); a table that fits stays out of the Tab order.
 */
export const table = <E, C>(
  f: Factory<E, C>,
  { node: _node, ...props }: Props,
  children: E[],
  scrolls: boolean,
  labels: MarkdownLabels,
  box?: Props,
): E =>
  f.element(
    'div',
    {
      ...box,
      className: 'llx-table',
      role: scrolls ? 'region' : undefined,
      'aria-label': scrolls ? labels.scrollableTable : undefined,
      tabIndex: scrolls ? 0 : undefined,
    },
    [f.element('table', props, children)],
  )

/** What a ```tree fence shows right now: which folders are shut, which row the Tab key stops on. */
export interface TreeState<E> {
  rows: TreeRow[]
  collapsed: ReadonlySet<string>
  /** The path of the one row in the Tab order; the first row shown when null or hidden. */
  focused: string | null
  /** The glyph before a row, for a page that colours files by type. */
  icon?: (row: TreeRow, open: boolean) => E
  /** A row's listeners and its handle. */
  on?: (row: TreeRow, visible: TreeRow[]) => Props
}

/** The rows of a tree that no shut folder hides. */
export function visibleRows(rows: TreeRow[], collapsed: ReadonlySet<string>): TreeRow[] {
  const hidden = (row: TreeRow): boolean => {
    for (let parent = row.parent; parent !== null; parent = rows[parent]!.parent)
      if (collapsed.has(rows[parent]!.path)) return true
    return false
  }
  return rows.filter((row) => !hidden(row))
}

/**
 * A ```tree fence: a directory layout drawn as a tree instead of box characters in monospace. The
 * tree is one Tab stop walked with the arrow keys (the WAI-ARIA tree pattern).
 */
export function fileTree<E, C>(
  f: Factory<E, C>,
  { rows, collapsed, focused, icon, on }: TreeState<E>,
  labels: MarkdownLabels,
): E {
  const visible = visibleRows(rows, collapsed)
  // One Tab stop: the row last focused, or the first while it is still shown.
  const rover = visible.some((row) => row.path === focused) ? focused : visible[0]?.path
  return f.element(
    'div',
    { role: 'tree', 'aria-label': labels.fileTree, className: 'llx-tree' },
    visible.map((row) => {
      const open = !collapsed.has(row.path)
      return f.element(
        'div',
        {
          key: row.path,
          role: 'treeitem',
          'aria-level': row.depth + 1,
          'aria-selected': false,
          ...(row.folder ? { 'aria-expanded': open } : {}),
          tabIndex: row.path === rover ? 0 : -1,
          className: 'llx-tree-row',
          'data-folder': row.folder || undefined,
          style: { '--llx-tree-depth': row.depth },
          ...on?.(row, visible),
        },
        [
          ...(row.folder
            ? [
                glyph(f, OUTLINES.chevron, {
                  className: 'llx-tree-chevron',
                  'data-open': open || undefined,
                }),
              ]
            : []),
          icon
            ? icon(row, open)
            : glyph(
                f,
                row.folder ? (open ? OUTLINES.folderOpen : OUTLINES.folder) : OUTLINES.file,
                { className: 'llx-tree-icon' },
              ),
          f.element('span', { className: 'llx-tree-name', title: row.name }, [
            f.text(row.name.replace(/\/$/, '')),
          ]),
          ...(row.comment
            ? [
                f.element('span', { className: 'llx-tree-comment', title: row.comment }, [
                  f.text(row.comment),
                ]),
              ]
            : []),
        ],
      )
    }),
  )
}

/**
 * A ```mermaid fence shown as the source it is: before it is drawn, where nothing draws it, or
 * when it could not be drawn, with a line saying why.
 */
export const diagramSource = <E, C>(
  f: Factory<E, C>,
  source: string,
  note: string | null,
  failed: boolean,
  figure?: Props,
): E =>
  f.element(
    'figure',
    { ...figure, className: 'llx-diagram', 'data-state': failed ? 'error' : 'source' },
    [
      f.element('pre', null, [
        f.element('code', { className: 'language-mermaid' }, [f.text(source)]),
      ]),
      ...(note
        ? [
            f.element('figcaption', { className: 'llx-diagram-note', role: 'status' }, [
              f.text(note),
            ]),
          ]
        : []),
    ],
  )
