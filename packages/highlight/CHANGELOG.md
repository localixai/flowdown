# @localix-ai/highlight

## 0.1.0

The first release: syntax highlighting for code that streams, made for what agents write.

- **Line by line.** Each line is read from the state the line above ended in (inside a comment, a
  string, a template, a heredoc), so a complete line is coloured once, the line being written costs
  only itself, and what streams is coloured exactly as the finished text: `createStream(language)`
  for code that arrives in pieces, `lines(language)` for a renderer that keeps its lines.
- **26 languages**: shell and shell sessions (`console`), diffs, TypeScript and JavaScript with
  JSX, Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, PHP, Ruby, SQL, JSON, YAML, TOML, INI and
  `.env`, Dockerfile, CSS and SCSS, HTML and XML, Markdown with its fences read as their language.
- **highlight.js's classes**, so its themes apply; the code is escaped; a language it does not
  know is `null`, never a guess. No dependencies, 12 KB gzipped.
