# Parser speed

The parser alone, with no React and no DOM: how long each one takes to read a whole text once.
`bun run parse` in bench/ writes this file; [src/parse.ts](../src/parse.ts) says how it is
measured and [src/parsers.ts](../src/parsers.ts) how each parser is set up. The streaming
benchmark, React and the DOM included, is [latest.md](latest.md).

- **date:** 2026-11-11T14:11:36.994Z
- **commit:** f34895b (with uncommitted changes)
- **cpu:** Apple M5, 10 cores, darwin 25.6.0
- **runtimes:** bun 1.4.4 (JavaScriptCore), node 25.6.1 (V8)
- **runs:** 3, one process per parser and run; the median of the runs' median parse

## Throughput

Every text of the corpus read once, its bytes over its time, in MB (2²⁰ bytes) a second. Higher is
better.

### bun 1.4.4 (JavaScriptCore)

| Parser | Output | Throughput | llx-markdown is faster by |
| --- | --- | ---: | ---: |
| `llx-markdown` | tree | 187 MB/s | 1.0× |
| `llx-markdown → HTML` | html | 131 MB/s | 1.4× |
| `markdown-it` | html | 51 MB/s | 3.7× |
| `marked` | html | 33 MB/s | 5.7× |
| `micromark` | html | 4 MB/s | 50.2× |
| `mdast-util-from-markdown` | tree | 4 MB/s | 53.4× |

### node 25.6.1 (V8)

| Parser | Output | Throughput | llx-markdown is faster by |
| --- | --- | ---: | ---: |
| `llx-markdown` | tree | 187 MB/s | 1.0× |
| `llx-markdown → HTML` | html | 139 MB/s | 1.4× |
| `marked` | html | 48 MB/s | 3.9× |
| `markdown-it` | html | 43 MB/s | 4.4× |
| `micromark` | html | 4 MB/s | 49.5× |
| `mdast-util-from-markdown` | tree | 3 MB/s | 54.1× |

## Each text

The median time of one whole parse.

### bun 1.4.4

| Text | Size | `llx-markdown` | `llx-markdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.03 ms | 1.60 ms | 1.53 ms | 0.21 ms | 0.12 ms |
| answer-20k | 20 KB | 0.09 ms | 0.12 ms | 5.34 ms | 5.02 ms | 0.53 ms | 0.37 ms |
| forms-20k | 20 KB | 0.15 ms | 0.18 ms | 6.88 ms | 6.61 ms | 0.91 ms | 0.48 ms |
| math-20k | 20 KB | 0.12 ms | 0.15 ms | 6.21 ms | 5.74 ms | 0.56 ms | 0.48 ms |
| code-50k | 48 KB | 0.02 ms | 0.04 ms | 2.57 ms | 2.65 ms | 0.08 ms | 0.10 ms |
| table-20k | 17 KB | 0.12 ms | 0.19 ms | 6.58 ms | 5.71 ms | 0.42 ms | 0.62 ms |
| long-100k | 98 KB | 0.52 ms | 0.82 ms | 27.9 ms | 26.0 ms | 2.99 ms | 2.10 ms |
| crlf-20k | 20 KB | 0.10 ms | 0.12 ms | 4.85 ms | 4.54 ms | 0.47 ms | 0.35 ms |
| footnotes-20k | 21 KB | 0.11 ms | 0.14 ms | 6.03 ms | 5.57 ms | 0.63 ms | 0.47 ms |
| answer-10k | 10 KB | 0.05 ms | 0.07 ms | 2.95 ms | 2.75 ms | 0.28 ms | 0.22 ms |
| answer-40k | 39 KB | 0.16 ms | 0.23 ms | 9.40 ms | 8.65 ms | 0.95 ms | 0.69 ms |
| commonmark-spec | 200 KB | 1.25 ms | 1.77 ms | 63.8 ms | 61.0 ms | 7.41 ms | 3.93 ms |

### node 25.6.1

| Text | Size | `llx-markdown` | `llx-markdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.03 ms | 1.33 ms | 1.17 ms | 0.13 ms | 0.12 ms |
| answer-20k | 20 KB | 0.09 ms | 0.11 ms | 4.85 ms | 4.38 ms | 0.37 ms | 0.41 ms |
| forms-20k | 20 KB | 0.13 ms | 0.16 ms | 6.38 ms | 5.65 ms | 0.55 ms | 0.53 ms |
| math-20k | 20 KB | 0.11 ms | 0.14 ms | 6.36 ms | 5.38 ms | 0.45 ms | 0.60 ms |
| code-50k | 48 KB | 0.02 ms | 0.02 ms | 2.33 ms | 2.49 ms | 0.05 ms | 0.11 ms |
| table-20k | 17 KB | 0.12 ms | 0.17 ms | 7.14 ms | 5.72 ms | 0.54 ms | 0.88 ms |
| long-100k | 98 KB | 0.51 ms | 0.61 ms | 30.9 ms | 27.4 ms | 2.05 ms | 2.38 ms |
| crlf-20k | 20 KB | 0.09 ms | 0.11 ms | 4.58 ms | 4.06 ms | 0.34 ms | 0.41 ms |
| footnotes-20k | 21 KB | 0.11 ms | 0.13 ms | 5.54 ms | 4.87 ms | 0.44 ms | 0.52 ms |
| answer-10k | 10 KB | 0.05 ms | 0.07 ms | 2.72 ms | 2.35 ms | 0.21 ms | 0.26 ms |
| answer-40k | 39 KB | 0.17 ms | 0.20 ms | 9.20 ms | 8.32 ms | 0.66 ms | 0.73 ms |
| commonmark-spec | 200 KB | 1.25 ms | 1.89 ms | 64.7 ms | 61.8 ms | 4.63 ms | 4.90 ms |

## The parsers

| Parser | Version | Output | What it reads, set up as here |
| --- | --- | --- | --- |
| `llx-markdown` | 0.4.2 | tree | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `llx-markdown → HTML` | 0.4.2 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `mdast-util-from-markdown` | 2.1.0 | tree | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `micromark` | 4.0.3 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `marked` | 18.1.3 | html | CommonMark, tables, task lists, strikethrough, bare links (no footnotes) |
| `markdown-it` | 15.0.3 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes (with markdown-it-footnote and markdown-it-task-lists) |

Raw HTML is passed through by all of them; none sanitizes. `llx-markdown` is the engine
`<Markdown>` runs, called directly: it is not a public entry of the package.
`mdast-util-from-markdown` is remark's parser, the one react-markdown and Streamdown run.
The two trees differ in one way that costs time: mdast gives every node its position in the
source, inline ones too, where llx-markdown's tree gives positions to blocks only.

## What each one read

Headings, code blocks, tables, rows, list items, strong, emphasis, strikethrough, footnote
references and checkboxes in each output, counted on the tree or the HTML, against
llx-markdown's tree. Only the differences are listed. In HTML a footnote's definition is a list
item, one more than a tree counts, and micromark heads the footnotes with a heading of its own;
marked reads no footnotes.

| Text | Parser | Counted vs llx-markdown |
| --- | --- | --- |
| footnotes-20k | `llx-markdown → HTML` | listItems 76 vs 75 |
| footnotes-20k | `micromark` | headings 9 vs 8, listItems 76 vs 75 |
| footnotes-20k | `marked` | footnoteRefs 0 vs 1 |
| footnotes-20k | `markdown-it` | listItems 76 vs 75 |
