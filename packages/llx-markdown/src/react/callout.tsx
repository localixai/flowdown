'use client'
import type { ComponentPropsWithoutRef, ComponentType, SVGProps } from 'react'
import { CALLOUT_KINDS, type CalloutKind } from '../dialect'
import { CautionIcon, ImportantIcon, InfoIcon, TipIcon, WarningIcon } from './icons'
import { useLabels } from './labels'

type CalloutProps = ComponentPropsWithoutRef<'blockquote'> & {
  node?: unknown
  'data-callout'?: string
  'data-callout-title'?: string
}

// A Record over the dialect's kinds, so a kind added there fails the type check here.
const GLYPHS: Record<CalloutKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  note: InfoIcon,
  tip: TipIcon,
  important: ImportantIcon,
  warning: WarningIcon,
  caution: CautionIcon,
}

function calloutKind(value: string | undefined): CalloutKind | null {
  return value && (CALLOUT_KINDS as readonly string[]).includes(value)
    ? (value as CalloutKind)
    : null
}

/**
 * A quote, or, when the remark pass marked it, a typed callout (`> [!WARNING]`). An `aside` with
 * `role="note"` rather than a styled quote: a warning is not a quotation, and assistive tech should
 * announce it as the aside it is, its kind first.
 *
 * The kind is carried by the glyph alone, in its colour. Its name is spoken, not printed, and a
 * title is printed only when the author wrote one (`> [!TIP] Faster builds`).
 */
export function Callout({
  children,
  node: _node,
  'data-callout': callout,
  'data-callout-title': title,
  ...quoteProps
}: CalloutProps) {
  const labels = useLabels()
  const kind = calloutKind(callout)
  if (!kind) return <blockquote {...quoteProps}>{children}</blockquote>
  const Glyph = GLYPHS[kind]
  return (
    <aside
      className="llx-callout"
      data-callout={kind}
      role="note"
      aria-label={title || labels.callouts[kind]}
    >
      <Glyph className="llx-callout-icon" />
      <div className="llx-callout-body">
        {title && <div className="llx-callout-title">{title}</div>}
        {children}
      </div>
    </aside>
  )
}
