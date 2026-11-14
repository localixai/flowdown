import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { NPM_README, ROOT_README, npmReadme } from '../test/npm-readme'

test("the package's README is the repository's, as bun run readme writes it", () => {
  const root = readFileSync(ROOT_README, 'utf8')
  const written = npmReadme(root)
  expect(readFileSync(NPM_README, 'utf8')).toBe(written)
  // npm resolves no link against the repository: every one is absolute or an anchor.
  for (const hit of written.matchAll(/(?:src|srcset|href)="([^"]+)"|\]\(([^)\s]+)\)/g))
    expect(hit[1] ?? hit[2]).toMatch(/^(?:https:\/\/|#)/)
  expect(written).not.toContain('## Development')
})
