import { parseFrontMatter } from './frontmatter'

export interface Nav {
  sections: { title: string; pages: string[] }[]
}

export interface Page {
  /** Its path under `docs/`: `recipes/ai-sdk.md`. */
  path: string
  /** Where it is served: `/recipes/ai-sdk/`, `index.md` at `/`. */
  route: string
  /** Its Markdown source: `/recipes/ai-sdk.md`. */
  markdownUrl: string
  title: string
  description: string
  section: string
  /** The Markdown without its front matter. */
  body: string
}

export const PLAYGROUND_ROUTE = '/playground/'

export function routeFor(path: string): string {
  const stem = path.replace(/\.md$/, '')
  if (stem === 'index') return '/'
  return `/${stem.replace(/(^|\/)index$/, '')}/`.replace(/\/{2,}/g, '/')
}

export const markdownUrlFor = (path: string) => `/${path}`

/** `/syntax`, `/syntax/index.html` and `/syntax/` are one page. */
export function normalizeRoute(pathname: string): string {
  const path = pathname.replace(/index\.html$/, '').replace(/\/{2,}/g, '/')
  return path.endsWith('/') ? path : `${path}/`
}

const firstHeading = (body: string) => body.match(/^#\s+(.+)$/m)?.[1]?.trim()

/**
 * The published pages, in the order of the navigation. A page that the navigation lists but that
 * does not exist is skipped; a file the navigation does not list, or whose name starts with `_`,
 * is not published.
 */
export function buildPages(nav: Nav, files: Readonly<Record<string, string>>): Page[] {
  const pages: Page[] = []
  for (const section of nav.sections) {
    for (const path of section.pages) {
      const raw = files[path]
      if (raw === undefined || path.split('/').some((part) => part.startsWith('_'))) continue
      const { data, body } = parseFrontMatter(raw)
      pages.push({
        path,
        route: routeFor(path),
        markdownUrl: markdownUrlFor(path),
        title: data.title || firstHeading(body) || path.replace(/\.md$/, ''),
        description: data.description ?? '',
        section: section.title,
        body,
      })
    }
  }
  return pages
}

export function neighbours(pages: readonly Page[], route: string) {
  const index = pages.findIndex((page) => page.route === route)
  if (index === -1) return { prev: null, next: null }
  return { prev: pages[index - 1] ?? null, next: pages[index + 1] ?? null }
}

/**
 * A link written between pages as a relative `.md` path (`./streaming.md#caret`, `../api.md`)
 * becomes the route of that page. Every other link (absolute, external, an anchor, a file the site
 * does not publish) is returned as written.
 */
export function resolveDocHref(href: string, from: string, pages: readonly Page[]): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(href)) return href
  const [pathname = '', hash] = href.split('#', 2)
  if (!pathname.endsWith('.md')) return href
  const parts = from.split('/').slice(0, -1)
  for (const part of pathname.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.' && part !== '') parts.push(part)
  }
  const target = pages.find((page) => page.path === parts.join('/'))
  if (!target) return href
  return hash ? `${target.route}#${hash}` : target.route
}
