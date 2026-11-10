'use client'
import { createContext, useContext } from 'react'
import type { CalloutKind } from '../dialect'

/**
 * Every word the renderer itself puts on the page or speaks to assistive tech. All of it is
 * replaceable (`<Markdown labels={…}>`), because a reply in Russian should not announce
 * "Warning" in English. The callout names are spoken, never printed: a visible English label over
 * a translated sentence was what read as foreign.
 */
export interface MarkdownLabels {
  callouts: Record<CalloutKind, string>
  /** The tab list of a `[!TABS]` form. */
  variants: string
  /** The tree of a ```tree fence. */
  fileTree: string
  /** A table wider than the reply, which then scrolls sideways and takes the keyboard's focus. */
  scrollableTable: string
  /** A diagram, while drawn, while drawing, and when it could not be drawn. */
  diagram: string
  drawingDiagram: string
  diagramFailed: (reason: string) => string
  /** A drawn diagram's toolbar: enlarge it, swap it for its source and back, copy, download. */
  enlarge: string
  showSource: string
  showDiagram: string
  copySource: string
  downloadSvg: string
  /** The enlarged diagram's controls. */
  zoomIn: string
  zoomOut: string
  fit: string
  actualSize: string
  close: string
  /** The copy button of a code block or a diagram, before and after a copy. */
  copy: string
  copied: string
  /** A code block's download button, which saves the code as a file. */
  download: string
}

export const DEFAULT_LABELS: MarkdownLabels = {
  callouts: {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
  },
  variants: 'Variants',
  fileTree: 'File tree',
  scrollableTable: 'Scrollable table',
  diagram: 'Diagram',
  drawingDiagram: 'Drawing diagram…',
  diagramFailed: (reason) => `Diagram could not be drawn: ${reason}`,
  enlarge: 'Enlarge diagram',
  showSource: 'Show source',
  showDiagram: 'Show diagram',
  copySource: 'Copy source',
  downloadSvg: 'Download SVG',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit to window',
  actualSize: 'Actual size',
  close: 'Close',
  copy: 'Copy code',
  copied: 'Copied',
  download: 'Download code',
}

export type LabelOverrides = Partial<Omit<MarkdownLabels, 'callouts'>> & {
  callouts?: Partial<MarkdownLabels['callouts']>
}

export function mergeLabels(overrides: LabelOverrides | undefined): MarkdownLabels {
  if (!overrides) return DEFAULT_LABELS
  return {
    ...DEFAULT_LABELS,
    ...overrides,
    callouts: { ...DEFAULT_LABELS.callouts, ...overrides.callouts },
  }
}

export const LabelsContext = createContext<MarkdownLabels>(DEFAULT_LABELS)

export const useLabels = () => useContext(LabelsContext)
