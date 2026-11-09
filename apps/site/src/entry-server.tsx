import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { App } from './App'
import { NAV, PAGES } from './content'
import { headFor, headHtml } from './head'
import { PLAYGROUND_ROUTE, type Page } from './lib/routes'
import { staticFiles } from './lib/outputs'

export { NAV, PAGES, PLAYGROUND_ROUTE }

/** The markup and the head of one route, for the prerender and for `vite dev`. */
export function render(route: string) {
  const html = renderToString(
    <StrictMode>
      <App route={route} />
    </StrictMode>,
  )
  const head = headFor(route)
  return { html, head: headHtml(head), found: head.found }
}

/** The page's Markdown as served at `<route>.md`: its title over its body. */
const raw = (page: Page) => `# ${page.title}\n\n${page.body.replace(/^#\s+[^\n]*\n+/, '')}`

export const files = () => staticFiles(NAV, PAGES, raw)

export const routes = () => [...PAGES.map((page) => page.route), PLAYGROUND_ROUTE]
