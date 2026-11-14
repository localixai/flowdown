/**
 * Writes the Rust crate's prompt (`crates/flowdown/src/prompt.md`) from this package's: one text
 * teaches a model the dialect, whichever parser reads its reply. The crate reads formulas, so the
 * section is the one `<Markdown math>` is taught with. `src/prompt/prompt.test.tsx` fails when the
 * file is not what this writes.
 *
 *     bun run prompt
 */
import { writeFileSync } from 'node:fs'
import { CRATE_PROMPT, cratePrompt } from '../test/crate-prompt'

writeFileSync(CRATE_PROMPT, cratePrompt())
console.log(`wrote ${CRATE_PROMPT.pathname}`)
