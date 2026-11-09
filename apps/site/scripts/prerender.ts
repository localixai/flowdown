/**
 * After `vite build` (the client, in `dist/`) and `vite build --ssr` (the renderer, in
 * `dist-server/`): every route becomes `<route>/index.html` with its markup and head, and the
 * Markdown, `llms.txt`, `llms-full.txt` and the sitemap are written beside them. A static host
 * then serves the site as files; the client hydrates what it finds.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fillTemplate } from '../src/lib/outputs'

const root = join(import.meta.dir, '..')
const dist = join(root, 'dist')
const server = await import(join(root, 'dist-server', 'entry-server.js'))
const template = readFileSync(join(dist, 'index.html'), 'utf8')

const write = (path: string, content: string) => {
  const file = join(dist, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const page = (route: string) => {
  const { html, head } = server.render(route) as { html: string; head: string }
  return fillTemplate(template, head, html)
}

const routes = server.routes() as string[]
for (const route of routes) write(join(route, 'index.html'), page(route))
// A static host's "not found" page, where it has one.
write('404.html', page('/__not-found__/'))
const files = server.files() as Map<string, string>
for (const [path, content] of files) write(path, content)

rmSync(join(root, 'dist-server'), { recursive: true, force: true })
console.log(`prerendered ${routes.length} routes and ${files.size} files into dist/`)
