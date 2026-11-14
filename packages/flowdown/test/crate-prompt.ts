/**
 * The Rust crate's prompt, as this package writes it (`scripts/prompt.ts`): the section the crate's
 * `prompt()` returns. Test and script only; nothing a bundle loads imports it.
 */
import { answerFormatPrompt } from '../src/prompt'

/** Where the crate keeps it, beside the code that returns it. */
export const CRATE_PROMPT = new URL('../../../crates/flowdown/src/prompt.md', import.meta.url)

/** The section with formulas taught, which the crate reads; diagrams are a renderer's, not its. */
export const cratePrompt = (): string => `${answerFormatPrompt({ math: true })}\n`
