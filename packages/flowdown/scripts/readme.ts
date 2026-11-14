/**
 * Writes the package's README on npm from the repository's (`test/npm-readme.ts` says how).
 * `src/readme.test.ts` fails when the package's copy is not what this writes.
 *
 *     bun run readme
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { NPM_README, ROOT_README, npmReadme } from '../test/npm-readme'

writeFileSync(NPM_README, npmReadme(readFileSync(ROOT_README, 'utf8')))
console.log(`wrote ${NPM_README.pathname}`)
