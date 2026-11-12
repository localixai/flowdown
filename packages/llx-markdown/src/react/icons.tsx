import type { ReactElement, SVGProps } from 'react'
import type { Props } from '../render/factory'
import { glyph, OUTLINES } from '../render/views'
import { react } from './render'

/** The renderer's glyphs (`render/views.ts`) as React components, for a page that reuses one. */
type IconProps = SVGProps<SVGSVGElement>

export function icon(outline: string) {
  return function Icon(props: IconProps) {
    return glyph(react, outline, props as Props) as ReactElement
  }
}

export const InfoIcon = icon(OUTLINES.info)

export const TipIcon = icon(OUTLINES.tip)

export const ImportantIcon = icon(OUTLINES.important)

export const WarningIcon = icon(OUTLINES.warning)

export const CautionIcon = icon(OUTLINES.caution)

export const ChevronIcon = icon(OUTLINES.chevron)

export const FileIcon = icon(OUTLINES.file)

export const FolderIcon = icon(OUTLINES.folder)

export const FolderOpenIcon = icon(OUTLINES.folderOpen)

export const CopyIcon = icon(OUTLINES.copy)

export const CheckIcon = icon(OUTLINES.check)

export const DownloadIcon = icon(OUTLINES.download)
