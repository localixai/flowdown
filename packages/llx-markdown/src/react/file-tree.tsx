'use client'
import {
  createElement,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
} from 'react'
import { parseFileTree, type TreeRow } from '../core/file-tree-parse'
import { fileTree } from '../render/views'
import { useLabels } from './labels'
import { react } from './render'

export type { TreeRow } from '../core/file-tree-parse'

/** The glyph drawn before a row; a host can colour files by type (`getIcon`). */
export type TreeIcon = ComponentType<SVGProps<SVGSVGElement>>

export interface FileTreeProps {
  /** The fence's body: `├──` / `└──` lines. */
  source: string
  getIcon?: (row: TreeRow, open: boolean) => TreeIcon
}

/**
 * A ```tree fence: a directory layout drawn as a tree instead of box characters in monospace. A
 * folder folds and unfolds on click, and the tree is one Tab stop walked with the arrow keys (the
 * WAI-ARIA tree pattern), so a long layout can be read one branch at a time.
 */
export function FileTree({ source, getIcon }: FileTreeProps) {
  const labels = useLabels()
  const rows = useMemo(() => parseFileTree(source), [source])
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const elements = useRef(new Map<string, HTMLElement>())
  if (rows.length === 0) return null

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  const focus = (row: TreeRow | undefined) => {
    if (row) elements.current.get(row.path)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: TreeRow, visible: TreeRow[]) => {
    const index = visible.indexOf(row)
    const open = row.folder && !collapsed.has(row.path)
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
    // Handled here, so not also by the page: a board or a shortcut layer around the reply would
    // otherwise move a card or scroll on the same arrow press. Keys the tree leaves (Escape, Tab)
    // still reach it.
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  return fileTree<ReactNode, never>(
    react as never,
    {
      rows,
      collapsed,
      focused,
      ...(getIcon
        ? {
            icon: (row: TreeRow, open: boolean) =>
              createElement(getIcon(row, open), { className: 'llx-tree-icon' }),
          }
        : null),
      on: (row, visible) => ({
        ref: (element: HTMLElement | null) => {
          if (element) elements.current.set(row.path, element)
          else elements.current.delete(row.path)
        },
        onFocus: () => setFocused(row.path),
        onClick: (event: MouseEvent<HTMLElement>) => {
          // Safari leaves a clicked row unfocused; the keys must carry on from it.
          event.currentTarget.focus()
          if (row.folder) toggle(row.path)
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, row, visible),
      }),
    },
    labels,
  )
}
