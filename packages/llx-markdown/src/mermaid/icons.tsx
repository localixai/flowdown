import { icon } from '../react/icons'

/**
 * The diagram's own glyphs, drawn like the renderer's others (`react/icons.tsx`). Outlines from
 * Lucide (https://lucide.dev), ISC License, Copyright (c) Lucide Contributors.
 */
export const EnlargeIcon = icon(
  <>
    <path d="M15 3h6v6" />
    <path d="m21 3-7 7" />
    <path d="m3 21 7-7" />
    <path d="M9 21H3v-6" />
  </>,
)

export const SourceIcon = icon(
  <>
    <path d="m18 16 4-4-4-4" />
    <path d="m6 8-4 4 4 4" />
    <path d="m14.5 4-5 16" />
  </>,
)

export const DiagramIcon = icon(
  <>
    <rect width="8" height="8" x="3" y="3" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect width="8" height="8" x="13" y="13" rx="2" />
  </>,
)

export const PlusIcon = icon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
)

export const MinusIcon = icon(<path d="M5 12h14" />)

export const FitIcon = icon(
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </>,
)

export const CloseIcon = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
)
