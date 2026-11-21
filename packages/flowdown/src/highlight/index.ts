/**
 * `@localix-ai/flowdown/highlight`: a highlighter for `<Markdown highlight={…}>`, with the languages
 * replies, READMEs and agents mostly write and their usual aliases: shell and shell sessions,
 * JavaScript and TypeScript, Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, PHP, Ruby, SQL,
 * JSON, YAML, TOML, INI, Dockerfile, CSS, SCSS, HTML, Markdown and diffs.
 *
 * It is `@localix-ai/highlight`, built in: no dependency to install. A page that highlights with
 * Shiki or not at all imports none of it. Colours come from the `--fd-code-*` tokens in
 * `styles.css`.
 */
import { highlight } from './highlight'

export { highlight, highlightCode } from './highlight'

export default highlight
