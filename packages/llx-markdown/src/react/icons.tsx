import type { SVGProps } from 'react'

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
type IconProps = SVGProps<SVGSVGElement>

export function icon(outline: string) {
  return function Icon(props: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
        {...props}
      >
        <path d={outline} />
      </svg>
    )
  }
}

export const InfoIcon = icon('M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0zM12 16v-4M12 8h.01')

export const TipIcon = icon(
  'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
)

export const ImportantIcon = icon(
  'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v2M12 13h.01',
)

export const WarningIcon = icon(
  'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
)

export const CautionIcon = icon(
  'M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586zM12 8v4M12 16h.01',
)

export const ChevronIcon = icon('m9 18 6-6-6-6')

export const FileIcon = icon(
  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4',
)

export const FolderIcon = icon(
  'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
)

export const FolderOpenIcon = icon(
  'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
)

export const CopyIcon = icon(
  'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
)

export const CheckIcon = icon('M20 6 9 17l-5-5')

export const DownloadIcon = icon('M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5')
