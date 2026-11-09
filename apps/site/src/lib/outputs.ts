import { llmsFullTxt, llmsTxt, sitemapXml } from './llms'
import { PLAYGROUND_ROUTE, type Nav, type Page } from './routes'
import { SITE_ORIGIN, SITE_SUMMARY } from './site'

/**
 * Every file the site serves besides its pages, by URL path: each page's Markdown (front matter
 * included, so a reader sees its title and description), `llms.txt`, `llms-full.txt` and the
 * sitemap. The prerender writes them; `vite dev` serves them from the same function.
 */
export function staticFiles(nav: Nav, pages: readonly Page[], raw: (page: Page) => string) {
  const files = new Map<string, string>()
  for (const page of pages) files.set(page.markdownUrl, raw(page))
  files.set('/llms.txt', llmsTxt(nav, pages, SITE_ORIGIN, SITE_SUMMARY))
  files.set('/llms-full.txt', llmsFullTxt(pages, SITE_ORIGIN))
  files.set(
    '/sitemap.xml',
    sitemapXml([...pages.map((page) => page.route), PLAYGROUND_ROUTE], SITE_ORIGIN),
  )
  return files
}

export const contentTypeOf = (path: string) =>
  path.endsWith('.md')
    ? 'text/markdown; charset=utf-8'
    : path.endsWith('.xml')
      ? 'application/xml; charset=utf-8'
      : 'text/plain; charset=utf-8'

/**
 * The page shell with a route's head and markup in place. Replacer functions, not strings: in a
 * replacement string `$$`, `$&` and `$'` are patterns, and the docs are full of dollars.
 */
export function fillTemplate(template: string, head: string, html: string): string {
  return template.replace('<!--app-head-->', () => head).replace('<!--app-html-->', () => html)
}
