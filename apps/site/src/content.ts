import { extractHeadings } from 'llx-markdown'
import navJson from '../../../docs/nav.json'
import { buildPages, type Nav, type Page } from './lib/routes'
import { buildSearchIndex, type SearchEntry } from './lib/search'

const modules = import.meta.glob<string>('../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const PREFIX = '../../../docs/'
const files = Object.fromEntries(
  Object.entries(modules).map(([key, raw]) => [key.slice(PREFIX.length), raw]),
)

export const NAV: Nav = navJson
export const PAGES: Page[] = buildPages(NAV, files)
const byRoute = new Map(PAGES.map((page) => [page.route, page]))

export const pageFor = (route: string) => byRoute.get(route) ?? null

let index: SearchEntry[] | null = null
/** Built the first time someone searches, not on every page load. */
export const searchIndex = () => (index ??= buildSearchIndex(PAGES, extractHeadings))
