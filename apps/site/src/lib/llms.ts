import type { Nav, Page } from './routes'
import { PLAYGROUND_ROUTE } from './routes'

/**
 * `/llms.txt` in the llmstxt.org shape: the name, a one-paragraph summary, then each section of
 * the navigation as links to the pages' Markdown, so a model reads the source, not the HTML.
 */
export function llmsTxt(nav: Nav, pages: readonly Page[], origin: string, summary: string) {
  const lines = ['# llx-markdown', '', `> ${summary}`, '']
  for (const section of nav.sections) {
    const inSection = pages.filter((page) => page.section === section.title)
    if (inSection.length === 0) continue
    lines.push(`## ${section.title}`, '')
    for (const page of inSection) {
      const description =
        page.description && page.description !== 'TODO' ? `: ${page.description}` : ''
      lines.push(`- [${page.title}](${origin}${page.markdownUrl})${description}`)
    }
    lines.push('')
  }
  lines.push(
    '## Optional',
    '',
    `- [All pages in one file](${origin}/llms-full.txt)`,
    `- [Playground](${origin}${PLAYGROUND_ROUTE}): paste Markdown and watch it stream`,
    '',
  )
  return lines.join('\n')
}

/** Every page, in navigation order, each under a line naming where it lives. */
export function llmsFullTxt(pages: readonly Page[], origin: string) {
  return pages
    .map((page) => `<!-- ${origin}${page.route} -->\n\n${page.body.trim()}\n`)
    .join('\n---\n\n')
}

export function sitemapXml(routes: readonly string[], origin: string) {
  const urls = routes.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
