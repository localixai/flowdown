import { describe, expect, test } from 'bun:test'
import { buildPages, neighbours, normalizeRoute, resolveDocHref, routeFor } from './routes'

const nav = {
  sections: [
    { title: 'Start', pages: ['index.md', 'getting-started.md', 'missing.md'] },
    { title: 'Recipes', pages: ['recipes/ai-sdk.md', '_draft.md'] },
  ],
}
const files = {
  'index.md': '---\ntitle: Introduction\ndescription: What it is\n---\n# Intro',
  'getting-started.md': '# Getting started\n\nInstall it.',
  'recipes/ai-sdk.md': '---\ntitle: AI SDK\n---\n# AI SDK',
  '_draft.md': '# Draft',
  'unlisted.md': '# Unlisted',
}
const pages = buildPages(nav, files)

describe('pages and routes', () => {
  test('a page is served at its path, the index at the root, with its Markdown beside it', () => {
    expect(routeFor('index.md')).toBe('/')
    expect(routeFor('recipes/ai-sdk.md')).toBe('/recipes/ai-sdk/')
    expect(routeFor('recipes/index.md')).toBe('/recipes/')
    expect(pages.map((page) => [page.route, page.markdownUrl])).toEqual([
      ['/', '/index.md'],
      ['/getting-started/', '/getting-started.md'],
      ['/recipes/ai-sdk/', '/recipes/ai-sdk.md'],
    ])
  })

  test('only listed, existing, non-underscore pages are published, titled by front matter or H1', () => {
    expect(pages.map((page) => page.title)).toEqual(['Introduction', 'Getting started', 'AI SDK'])
    expect(pages[0]!.body).toBe('# Intro')
    expect(pages[2]!.section).toBe('Recipes')
  })

  test('prev and next follow the navigation across sections', () => {
    expect(neighbours(pages, '/getting-started/')).toMatchObject({
      prev: { route: '/' },
      next: { route: '/recipes/ai-sdk/' },
    })
    expect(neighbours(pages, '/').prev).toBeNull()
    expect(neighbours(pages, '/nowhere/')).toEqual({ prev: null, next: null })
  })

  test('a request path maps to its route', () => {
    expect(normalizeRoute('/syntax')).toBe('/syntax/')
    expect(normalizeRoute('/syntax/index.html')).toBe('/syntax/')
    expect(normalizeRoute('/')).toBe('/')
  })
})

describe('links between pages', () => {
  test('relative .md links become routes, with their anchor', () => {
    expect(resolveDocHref('./getting-started.md', 'index.md', pages)).toBe('/getting-started/')
    expect(resolveDocHref('recipes/ai-sdk.md#stream', 'index.md', pages)).toBe(
      '/recipes/ai-sdk/#stream',
    )
    expect(resolveDocHref('../index.md', 'recipes/ai-sdk.md', pages)).toBe('/')
  })

  test('everything else stays as written', () => {
    for (const href of [
      'https://example.com/a.md',
      'mailto:a@example.com',
      '#local',
      '/absolute/',
      './unlisted.md',
      './image.png',
    ])
      expect(resolveDocHref(href, 'index.md', pages)).toBe(href)
  })
})
