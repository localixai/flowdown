import { pageFor } from './content'
import { PLAYGROUND_ROUTE } from './lib/routes'
import { SITE_NAME, SITE_ORIGIN, SITE_SUMMARY } from './lib/site'

export interface Head {
  title: string
  description: string
  canonical: string
  markdown: string | null
  found: boolean
}

/** The title, description and canonical address of a route, for the server and for navigation. */
export function headFor(route: string): Head {
  const page = pageFor(route)
  if (page) {
    const description =
      page.description && page.description !== 'TODO' ? page.description : SITE_SUMMARY
    return {
      title: page.route === '/' ? `${SITE_NAME}: ${page.title}` : `${page.title} · ${SITE_NAME}`,
      description,
      canonical: `${SITE_ORIGIN}${page.route}`,
      markdown: page.markdownUrl,
      found: true,
    }
  }
  if (route === PLAYGROUND_ROUTE)
    return {
      title: `Playground · ${SITE_NAME}`,
      description: 'Paste Markdown and watch llx-markdown render it as it streams.',
      canonical: `${SITE_ORIGIN}${PLAYGROUND_ROUTE}`,
      markdown: null,
      found: true,
    }
  return {
    title: `Not found · ${SITE_NAME}`,
    description: SITE_SUMMARY,
    canonical: SITE_ORIGIN,
    markdown: null,
    found: false,
  }
}

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

export function headHtml(head: Head) {
  return [
    `<title>${escape(head.title)}</title>`,
    `<meta name="description" content="${escape(head.description)}" />`,
    `<link rel="canonical" href="${escape(head.canonical)}" />`,
    `<meta property="og:title" content="${escape(head.title)}" />`,
    `<meta property="og:description" content="${escape(head.description)}" />`,
    head.markdown
      ? `<link rel="alternate" type="text/markdown" href="${escape(head.markdown)}" />`
      : '',
    head.found ? '' : '<meta name="robots" content="noindex" />',
  ]
    .filter(Boolean)
    .join('\n    ')
}
