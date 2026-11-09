import { expect, test } from 'bun:test'
import { llmsFullTxt, llmsTxt, sitemapXml } from './llms'
import { buildPages } from './routes'

const nav = {
  sections: [
    { title: 'Start', pages: ['index.md', 'syntax.md'] },
    { title: 'Empty', pages: [] },
  ],
}
const pages = buildPages(nav, {
  'index.md': '---\ntitle: Introduction\ndescription: What it is\n---\n# Intro\n',
  'syntax.md': '---\ntitle: Syntax\ndescription: TODO\n---\n# Syntax\n',
})

test('llms.txt names the project, summarizes it and links each page to its Markdown', () => {
  const text = llmsTxt(nav, pages, 'https://x.dev', 'A renderer.')
  expect(text.startsWith('# llx-markdown\n\n> A renderer.\n\n## Start\n\n')).toBe(true)
  expect(text).toContain('- [Introduction](https://x.dev/index.md): What it is\n')
  // A placeholder description is left out rather than published.
  expect(text).toContain('- [Syntax](https://x.dev/syntax.md)\n')
  expect(text).not.toContain('## Empty')
  expect(text).toContain('[All pages in one file](https://x.dev/llms-full.txt)')
})

test('llms-full.txt holds every page body in order, and the sitemap every route', () => {
  const full = llmsFullTxt(pages, 'https://x.dev')
  expect(full.indexOf('# Intro')).toBeLessThan(full.indexOf('# Syntax'))
  expect(full).not.toContain('title:')
  expect(sitemapXml(['/', '/syntax/'], 'https://x.dev')).toContain(
    '<url><loc>https://x.dev/syntax/</loc></url>',
  )
})
