/**
 * `bun run new <name> "<description>"`: a package made from `templates/package`, every
 * `{{name}}` and `{{description}}` filled in. The template is what `scripts/packages.test.ts`
 * holds every package to, so a new one passes it from its first commit. (`gitignore` is copied
 * to `.gitignore`: npm would drop a `.gitignore` from the template itself.)
 */
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const [name, description = ''] = process.argv.slice(2)
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    'usage: bun run new <name> "<description>": a lower-case name, words joined by hyphens',
  )
  process.exit(1)
}
const root = join(import.meta.dir, '..')
const target = join(root, 'packages', name)
if (existsSync(target)) {
  console.error(`packages/${name} already exists`)
  process.exit(1)
}
cpSync(join(root, 'templates', 'package'), target, { recursive: true })
renameSync(join(target, 'gitignore'), join(target, '.gitignore'))

const fill = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) fill(path)
    else
      writeFileSync(
        path,
        readFileSync(path, 'utf8')
          .replaceAll('{{name}}', name)
          .replaceAll('{{description}}', description),
      )
  }
}
fill(target)
console.log(`made packages/${name}: run bun install, then bun test in it`)
