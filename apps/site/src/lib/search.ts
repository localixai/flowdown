import type { Page } from './routes'

export interface SearchEntry {
  route: string
  /** The page, or the page › heading the hit is under. */
  title: string
  hash: string | null
  /** What is matched, lower-cased: the title weighs most, then the headings, then the text. */
  titleText: string
  text: string
}

export interface SearchResult {
  href: string
  title: string
  excerpt: string
}

const plain = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*\[![A-Z]+\][^\n]*$/gm, ' ')
    .replace(/[`*_>#|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * One entry per page and one per section of it (the text between two `##`/`###` headings), so a
 * hit can take the reader straight to the heading it is under.
 */
export function buildSearchIndex(
  pages: readonly Page[],
  headingsOf: (body: string) => { depth: number; text: string; id: string }[],
): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const page of pages) {
    const sections = page.body.split(/^(?=#{2,3}\s)/m)
    const headings = headingsOf(page.body).filter((heading) => heading.depth <= 3)
    const intro = sections[0] ?? ''
    entries.push({
      route: page.route,
      title: page.title,
      hash: null,
      titleText: `${page.title} ${page.description}`.toLowerCase(),
      text: plain(intro),
    })
    for (const [index, section] of sections.slice(1).entries()) {
      const heading = headings.filter((item) => item.depth > 1)[index]
      if (!heading) continue
      entries.push({
        route: page.route,
        title: `${page.title} › ${heading.text}`,
        hash: heading.id,
        titleText: heading.text.toLowerCase(),
        text: plain(section.replace(/^#{2,3}[^\n]*\n/, '')),
      })
    }
  }
  return entries
}

/** The best hits for a query: every word must appear; title words outrank body words. */
export function search(index: readonly SearchEntry[], query: string, limit = 8): SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored: { entry: SearchEntry; score: number; at: number }[] = []
  for (const entry of index) {
    const text = entry.text.toLowerCase()
    let score = 0
    let at = -1
    for (const word of words) {
      const inTitle = entry.titleText.includes(word)
      const inText = text.indexOf(word)
      if (!inTitle && inText === -1) {
        score = 0
        break
      }
      score += inTitle ? 10 : 1
      if (at === -1 && inText !== -1) at = inText
    }
    if (score > 0) scored.push({ entry, score: score + (entry.hash ? 0 : 0.5), at })
  }
  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, at }) => ({
      href: entry.hash ? `${entry.route}#${entry.hash}` : entry.route,
      title: entry.title,
      excerpt: excerpt(entry.text, at),
    }))
}

function excerpt(text: string, at: number) {
  const start = Math.max(0, at - 40)
  const slice = text.slice(start, start + 140)
  return `${start > 0 ? '…' : ''}${slice}${start + 140 < text.length ? '…' : ''}`
}
