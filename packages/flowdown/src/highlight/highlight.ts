/**
 * The highlighter of `@localix-ai/flowdown/highlight`: `@localix-ai/highlight`, built into this
 * entry so the package still has no dependency. It reads a line at a time from the state the line
 * above ended in, so a fence still being written is coloured a line once, exactly as the finished
 * block is, and it emits highlight.js's classes, which `styles.css` and the terminal colour.
 */
import { highlight as colour, highlightCode as colourCode, languageOf } from '@localix-ai/highlight'

/** The `Highlighter` shape, with `lines` for a block that grows: null for a language it does not know. */
export const highlight = colour

export function highlightCode(source: string, fenceLanguage?: string): string
export function highlightCode(
  source: string,
  fenceLanguage: string | undefined,
  options: { unknown: 'null' },
): string | null
/**
 * Highlighted HTML for the fence's language. Only a language the fence names is highlighted, never
 * a guessed one: an unknown or plain-text fence comes back escaped (or null, when asked).
 */
export function highlightCode(
  source: string,
  fenceLanguage = 'text',
  options?: { unknown: 'null' },
): string | null {
  if (options && languageOf(fenceLanguage) === null) return null
  return colourCode(source, fenceLanguage)
}
