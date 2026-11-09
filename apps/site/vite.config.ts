import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { contentTypeOf } from './src/lib/outputs'

/**
 * In `vite dev`, the pages are rendered on the server too (so the first paint is the real page,
 * as in production), and the Markdown, `llms.txt` and sitemap are served from the same code the
 * prerender writes them with.
 */
function devServer(): Plugin {
  return {
    name: 'llx-site-dev',
    apply: 'serve',
    configureServer(server) {
      return () => {
        server.middlewares.use(async (request, response, next) => {
          const url = new URL(request.url ?? '/', 'http://localhost')
          if (request.method !== 'GET' || /\.(?!md$|txt$|xml$)\w+$/.test(url.pathname))
            return next()
          try {
            const entry = await server.ssrLoadModule('/src/entry-server.tsx')
            const file = (entry.files() as Map<string, string>).get(url.pathname)
            if (file !== undefined) {
              response.setHeader('Content-Type', contentTypeOf(url.pathname))
              response.end(file)
              return
            }
            const route = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
            const { html, head, found } = entry.render(route)
            const template = await server.transformIndexHtml(
              url.pathname,
              (await import('node:fs')).readFileSync('index.html', 'utf8'),
            )
            response.statusCode = found ? 200 : 404
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            response.end(template.replace('<!--app-head-->', head).replace('<!--app-html-->', html))
          } catch (error) {
            server.ssrFixStacktrace(error as Error)
            next(error)
          }
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), devServer()],
  // The pages live in the repository's `docs/`, two levels up.
  server: { fs: { allow: ['../..'] } },
  ssr: { noExternal: ['llx-markdown'] },
  build: { target: 'es2022' },
})
