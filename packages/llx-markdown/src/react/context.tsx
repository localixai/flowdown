'use client'
import { createContext, useContext, type ComponentType } from 'react'
import type { Components } from './render'
import type { MermaidRenderer } from '../mermaid/renderer'

/**
 * Turns a fence's code into highlighted HTML, or returns null to leave it plain. The HTML goes into
 * the page as is, so a highlighter must escape the code it was given (highlight.js and Shiki do);
 * `llx-markdown/highlight` is one.
 */
export type Highlighter = (code: string, language: string) => string | null

/**
 * What `<Markdown components>` takes: an element for any tag, and a page's own drawing of the two
 * fences that are not code. `diagram` is told whether its fence is the one still being written
 * (`growing`), so it can wait for the whole source; every diagram above it is complete.
 */
export type MarkdownComponents = Components & {
  diagram?: ComponentType<{ source: string; growing: boolean }>
  tree?: ComponentType<{ source: string }>
}

/** What every block of one document shares, beside the labels. */
export interface RenderContext {
  highlight: Highlighter | null
  mermaid: MermaidRenderer | null
}

export const RenderContextValue = createContext<RenderContext>({ highlight: null, mermaid: null })

export const useRenderContext = () => useContext(RenderContextValue)

/**
 * Whether the block being drawn is the end of a streaming reply that stops inside a fence. Such a
 * fence is still being written: a diagram in it is not drawn yet (every token would be a layout
 * and most of them a syntax error), only shown as the source it is so far.
 */
export const GrowingFence = createContext(false)
