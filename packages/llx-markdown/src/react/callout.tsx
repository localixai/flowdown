'use client'
import type { ComponentPropsWithoutRef } from 'react'
import type { Props } from '../render/factory'
import { callout } from '../render/views'
import { useLabels } from './labels'
import { react } from './render'

type CalloutProps = ComponentPropsWithoutRef<'blockquote'> & {
  node?: unknown
  'data-callout'?: string
  'data-callout-title'?: string
}

/** A quote, or a typed callout (`> [!WARNING]`): what `render/views.ts` says one is made of. */
export function Callout({ children, ...props }: CalloutProps) {
  return callout(react, props as Props, children === undefined ? [] : [children], useLabels())
}
