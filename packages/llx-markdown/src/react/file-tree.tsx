'use client'
import {
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type SVGProps,
} from 'react'
import { parseFileTree, type TreeRow } from '../core/file-tree-parse'
import { ChevronIcon, FileIcon, FolderIcon, FolderOpenIcon } from './icons'
import { useLabels } from './labels'

export type { TreeRow } from '../core/file-tree-parse'

/** The glyph drawn before a row; a host can colour files by type (`getIcon`). */
export type TreeIcon = ComponentType<SVGProps<SVGSVGElement>>

const defaultIcon = (row: TreeRow, open: boolean): TreeIcon =>
  row.folder ? (open ? FolderOpenIcon : FolderIcon) : FileIcon

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
export function FileTree({ source, getIcon = defaultIcon }: FileTreeProps) {
  const labels = useLabels()
  const rows = useMemo(() => parseFileTree(source), [source])
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const elements = useRef(new Map<string, HTMLElement>())
  if (rows.length === 0) return null

  const hidden = (row: TreeRow): boolean => {
    for (let parent = row.parent; parent !== null; parent = rows[parent]!.parent)
      if (collapsed.has(rows[parent]!.path)) return true
    return false
  }
  const visible = rows.filter((row) => !hidden(row))
  // One Tab stop: the row last focused, or the first while it is still shown.
  const rover = visible.some((row) => row.path === focused) ? focused : visible[0]!.path

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

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: TreeRow) => {
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

  return (
    <div role="tree" aria-label={labels.fileTree} className="llx-tree">
      {visible.map((row) => {
        const open = !collapsed.has(row.path)
        const Glyph = getIcon(row, open)
        return (
          <div
            key={row.path}
            ref={(element) => {
              if (element) elements.current.set(row.path, element)
              else elements.current.delete(row.path)
            }}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={false}
            {...(row.folder ? { 'aria-expanded': open } : {})}
            tabIndex={row.path === rover ? 0 : -1}
            className="llx-tree-row"
            data-folder={row.folder || undefined}
            style={{ '--llx-tree-depth': row.depth } as Record<string, number>}
            onFocus={() => setFocused(row.path)}
            onClick={() => row.folder && toggle(row.path)}
            onKeyDown={(event) => onKeyDown(event, row)}
          >
            {row.folder && (
              <ChevronIcon className="llx-tree-chevron" data-open={open || undefined} />
            )}
            <Glyph className="llx-tree-icon" />
            <span className="llx-tree-name" title={row.name}>
              {row.name.replace(/\/$/, '')}
            </span>
            {row.comment && (
              <span className="llx-tree-comment" title={row.comment}>
                {row.comment}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
