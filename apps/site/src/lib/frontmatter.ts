export interface FrontMatter {
  title?: string
  description?: string
  [key: string]: string | undefined
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * A page's `---` block of `key: value` lines and the Markdown after it. Only flat string values:
 * a page's title and description are all the site reads, and a YAML parser for two keys would be
 * the largest dependency the site has.
 */
export function parseFrontMatter(raw: string): { data: FrontMatter; body: string } {
  const match = raw.match(FENCE)
  if (!match) return { data: {}, body: raw }
  const data: FrontMatter = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!pair) continue
    let value = pair[2]!.trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    data[pair[1]!] = value
  }
  return { data, body: raw.slice(match[0].length).replace(/^\s*\n/, '') }
}
