/**
 * `bun scripts/each.ts <script>`: runs a package script in every package that has it, the ones
 * others build in first (flowdown, which takes all of them in, last), stopping at the first that
 * fails. The root's build, test, typecheck, check and size go through it, so a new package is in
 * them the moment it exists.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const script = process.argv[2]
if (!script) throw new Error('usage: bun scripts/each.ts <script>')
const packages = join(import.meta.dir, '..', 'packages')
const names = readdirSync(packages)
  .filter((name) => existsSync(join(packages, name, 'package.json')))
  .toSorted((a, b) => Number(a === 'flowdown') - Number(b === 'flowdown') || a.localeCompare(b))

for (const name of names) {
  const manifest = JSON.parse(readFileSync(join(packages, name, 'package.json'), 'utf8'))
  if (!manifest.scripts?.[script]) continue
  console.log(`\n── ${name}: ${script}`)
  const run = Bun.spawnSync(['bun', 'run', script], {
    cwd: join(packages, name),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: process.env,
  })
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1)
}
