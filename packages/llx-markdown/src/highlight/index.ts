/**
 * `llx-markdown/highlight`: a highlighter for `<Markdown highlight={…}>`, built on highlight.js
 * with the languages replies and READMEs mostly hold and their usual aliases: shell, JavaScript and
 * TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, PHP, Ruby, SQL, JSON, YAML, TOML,
 * Dockerfile, CSS, HTML, Markdown and diffs.
 *
 * It is its own entry, and highlight.js an optional peer, so a page that highlights with Shiki or
 * not at all bundles none of it. Colours come from the `--llx-code-*` tokens in `styles.css`.
 */
import { highlightCode } from './highlight'

export { highlightCode } from './highlight'

/** The `Highlighter` shape: highlighted HTML, or null for a language it does not know. */
export function highlight(code: string, language: string): string | null {
  return highlightCode(code, language, { unknown: 'null' })
}

export default highlight
