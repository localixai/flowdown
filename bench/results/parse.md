# Parser speed

The parser alone, with no React and no DOM: how long each one takes to read a whole text once.
`bun run parse` in bench/ writes this file; [src/parse.ts](../src/parse.ts) says how it is
measured and [src/parsers.ts](../src/parsers.ts) how each parser is set up. The streaming
benchmark, React and the DOM included, is [latest.md](latest.md).

- **date:** 2026-11-11T02:14:34.972Z
- **commit:** ad88e30 (with uncommitted changes)
- **cpu:** Apple M5, 10 cores, darwin 25.6.0
- **runtimes:** bun 1.4.4 (JavaScriptCore), node 25.6.1 (V8)
- **runs:** 3, one process per parser and run; the median of the runs' median parse

## Throughput

Every text of the corpus read once, its bytes over its time, in MB (2²⁰ bytes) a second. Higher is
better.

### bun 1.4.4 (JavaScriptCore)

| Parser | Output | Throughput | llx-markdown is faster by |
| --- | --- | ---: | ---: |
| `llx-markdown` | tree | 179 MB/s | 1.0× |
| `llx-markdown → HTML` | html | 122 MB/s | 1.5× |
| `markdown-it` | html | 49 MB/s | 3.7× |
| `marked` | html | 32 MB/s | 5.7× |
| `micromark` | html | 3 MB/s | 53.6× |
| `mdast-util-from-markdown` | tree | 3 MB/s | 55.3× |

### node 25.6.1 (V8)

| Parser | Output | Throughput | llx-markdown is faster by |
| --- | --- | ---: | ---: |
| `llx-markdown` | tree | 176 MB/s | 1.0× |
| `llx-markdown → HTML` | html | 135 MB/s | 1.3× |
| `marked` | html | 46 MB/s | 3.9× |
| `markdown-it` | html | 39 MB/s | 4.5× |
| `micromark` | html | 4 MB/s | 48.6× |
| `mdast-util-from-markdown` | tree | 3 MB/s | 52.9× |

## Each text

The median time of one whole parse.

### bun 1.4.4

| Text | Size | `llx-markdown` | `llx-markdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.03 ms | 1.66 ms | 1.63 ms | 0.22 ms | 0.13 ms |
| answer-20k | 20 KB | 0.09 ms | 0.12 ms | 5.54 ms | 5.63 ms | 0.56 ms | 0.40 ms |
| forms-20k | 20 KB | 0.15 ms | 0.19 ms | 7.38 ms | 7.15 ms | 0.94 ms | 0.51 ms |
| math-20k | 20 KB | 0.12 ms | 0.16 ms | 6.60 ms | 6.60 ms | 0.60 ms | 0.52 ms |
| code-50k | 48 KB | 0.02 ms | 0.04 ms | 2.70 ms | 2.92 ms | 0.08 ms | 0.10 ms |
| table-20k | 17 KB | 0.12 ms | 0.19 ms | 6.96 ms | 6.26 ms | 0.44 ms | 0.64 ms |
| long-100k | 98 KB | 0.54 ms | 0.84 ms | 29.5 ms | 29.1 ms | 3.08 ms | 2.20 ms |
| crlf-20k | 20 KB | 0.10 ms | 0.13 ms | 5.54 ms | 5.00 ms | 0.49 ms | 0.37 ms |
| footnotes-20k | 21 KB | 0.11 ms | 0.15 ms | 6.48 ms | 6.03 ms | 0.66 ms | 0.48 ms |
| answer-10k | 10 KB | 0.05 ms | 0.08 ms | 3.08 ms | 2.95 ms | 0.29 ms | 0.24 ms |
| answer-40k | 39 KB | 0.17 ms | 0.24 ms | 10.4 ms | 9.75 ms | 1.01 ms | 0.75 ms |
| commonmark-spec | 200 KB | 1.32 ms | 1.97 ms | 70.5 ms | 68.4 ms | 7.61 ms | 4.07 ms |

### node 25.6.1

| Text | Size | `llx-markdown` | `llx-markdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.04 ms | 1.36 ms | 1.19 ms | 0.14 ms | 0.13 ms |
| answer-20k | 20 KB | 0.10 ms | 0.11 ms | 5.20 ms | 4.48 ms | 0.37 ms | 0.46 ms |
| forms-20k | 20 KB | 0.15 ms | 0.16 ms | 6.53 ms | 5.76 ms | 0.57 ms | 0.56 ms |
| math-20k | 20 KB | 0.12 ms | 0.14 ms | 6.76 ms | 5.91 ms | 0.47 ms | 0.64 ms |
| code-50k | 48 KB | 0.02 ms | 0.02 ms | 2.45 ms | 2.60 ms | 0.05 ms | 0.11 ms |
| table-20k | 17 KB | 0.14 ms | 0.18 ms | 7.60 ms | 6.43 ms | 0.55 ms | 0.94 ms |
| long-100k | 98 KB | 0.56 ms | 0.61 ms | 32.4 ms | 29.6 ms | 2.07 ms | 2.53 ms |
| crlf-20k | 20 KB | 0.10 ms | 0.11 ms | 5.16 ms | 4.11 ms | 0.34 ms | 0.45 ms |
| footnotes-20k | 21 KB | 0.12 ms | 0.13 ms | 6.18 ms | 5.42 ms | 0.47 ms | 0.58 ms |
| answer-10k | 10 KB | 0.05 ms | 0.06 ms | 2.80 ms | 2.46 ms | 0.23 ms | 0.28 ms |
| answer-40k | 39 KB | 0.17 ms | 0.20 ms | 9.37 ms | 8.51 ms | 0.69 ms | 0.82 ms |
| commonmark-spec | 200 KB | 1.31 ms | 1.97 ms | 66.4 ms | 63.2 ms | 5.15 ms | 5.47 ms |

## The parsers

| Parser | Version | Output | What it reads, set up as here |
| --- | --- | --- | --- |
| `llx-markdown` | 0.4.0 | tree | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `llx-markdown → HTML` | 0.4.0 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
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
