/**
 * Writes the Rust crate's tables (`crates/flowdown/data/`) from what this package reads: the
 * named character references and Unicode's punctuation, so the two parsers decode and delimit
 * alike. `src/engine/entities.test.ts` fails when the files are not what this writes. Run it when
 * `character-entities` or the runtime's Unicode changes.
 *
 *     bun run crate-tables
 */
import { writeFileSync } from 'node:fs'
import {
  CRATE_ENTITIES,
  CRATE_PUNCTUATION,
  crateEntities,
  cratePunctuation,
} from '../test/crate-tables'

writeFileSync(CRATE_ENTITIES, crateEntities())
writeFileSync(CRATE_PUNCTUATION, cratePunctuation())
console.log(`wrote ${CRATE_ENTITIES.pathname} and ${CRATE_PUNCTUATION.pathname}`)
