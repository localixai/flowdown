# @localix-ai/highlight

Syntax highlighting for code that streams. An agent writes a file, a patch or a shell session a
token at a time; a highlighter that colours the whole text colours it again on every token, and a
file costs the square of its length. This one reads each line from the state the line above ended
in (inside a comment, a string, a template, a heredoc), so a line is coloured once, the line still
being written costs only itself, and what streams is coloured exactly as the finished text is.

- **26 languages** an agent writes: shell and shell sessions, diffs, TypeScript and JavaScript with
  JSX, Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, PHP, Ruby, SQL, JSON, YAML, TOML, INI and
  `.env`, Dockerfile, CSS and SCSS, HTML and XML, Markdown.
- **highlight.js's classes** (`hljs-keyword`, `hljs-string`, …), so its themes apply as they are.
- **Escaped**: the HTML can go into a page as it is. A language it does not know is `null`, never
  a guess.
- **No dependencies**, 11.6 KB minified and gzipped with every language.

It is the highlighter of [flowdown](https://github.com/localixai/flowdown)
(`@localix-ai/flowdown/highlight`, built in), and works on its own.

## Use

```ts
import { createStream, highlight } from '@localix-ai/highlight'

highlight('const x = 1', 'ts') // '<span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>'
highlight('x', 'no-such-language') // null

// Code that arrives in pieces: each update gives the lines it completed and the open one.
const stream = createStream('python')!
for await (const piece of agent.write('main.py')) {
  const { done, current } = stream.write(piece)
  for (const line of done) page.appendLine(line) // each complete line once
  page.setOpenLine(current) // the line still being written, again on each piece
}
```

`lines(language)` is the same a line at a time, for a renderer that keeps lines itself:
`line(text, state)` colours one line from the state the line above ended in and returns
`{ html, end }`; `start` is a file's first state. `highlight` carries it as `highlight.lines`.

`highlightCode(code, language)` returns escaped plain text, rather than `null`, for a language it
does not know. `languageOf('ts')` is `'typescript'`; `languages` and `names` list them all.

## How fast

From `bun run bench` (`bench/results/latest.md`), an Intel Xeon at 2.1 GHz, two cores:

| A file that streams: 59,597 characters of TypeScript, 8 a token | Total |
| --- | ---: |
| `@localix-ai/highlight`, line by line | 54.4 ms |
| highlight.js, in pieces of 40 lines | 3489 ms |
| highlight.js, the whole text on every token | stopped at 34% after 20 s |
| Shiki, the whole text on every token | stopped at 14% after 20 s |

Whole files, about 1 MB in each language: highlight.js takes 3.9× as long, Shiki 30×. Four times
the stream costs 4.8× the time.

## How close to an editor

From `bun run quality` (`bench/results/quality.md`): of every character of the code an agent
writes, of the TextMate grammars' samples and of highlight.js's markup tests, the share coloured
as Shiki (VS Code's grammars) colours it: 84.2%, where highlight.js's is 79.9%. On TypeScript
91.4% (79.3%), shell 88.0% (75.3%), Python 83.2% (77.3%).

## Checks

```sh
bun test                       # the tests: text kept, escaped, a stream = the whole, every grammar
bun run typecheck
bun run size                   # minified and gzipped, against its budget
bun run references             # clones highlight.js and the TextMate grammars into .refs/
bun run quality                # colours against Shiki and highlight.js, against floors per language
bun run bench                  # speed against highlight.js and Shiki, against bench/budgets.json
```

`test/agent/` is the code an agent writes, one file a language: the corpus the tests, the quality
check and the benchmark read. Nothing of highlight.js or the TextMate grammars is copied here;
their code is read from `.refs/` to compare.

## License

MIT
