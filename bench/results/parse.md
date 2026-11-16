# Parser speed

The parser alone, with no React and no DOM: how long each one takes to read a whole text once.
`bun run parse` in bench/ writes this file; [src/parse.ts](../src/parse.ts) says how it is
measured and [src/parsers.ts](../src/parsers.ts) how each parser is set up. The streaming
benchmark, React and the DOM included, is [latest.md](latest.md).

- **date:** 2026-11-16T03:27:44.446Z
- **commit:** 82bae70 (with uncommitted changes)
- **cpu:** Apple M5, 10 cores, darwin 25.6.0
- **runtimes:** bun 1.4.4 (JavaScriptCore), node 25.6.1 (V8)
- **runs:** 3, one process per parser and run; the median of the runs' median parse

## Throughput

Every text of the corpus read once, its bytes over its time, in MB (2²⁰ bytes) a second. Higher is
better.

### bun 1.4.4 (JavaScriptCore)

| Parser | Output | Throughput | flowdown is faster by |
| --- | --- | ---: | ---: |
| `flowdown` | tree | 138 MB/s | 1.0× |
| `flowdown → HTML` | html | 103 MB/s | 1.3× |
| `markdown-it` | html | 38 MB/s | 3.6× |
| `marked` | html | 28 MB/s | 5.0× |
| `mdast-util-from-markdown` | tree | 3 MB/s | 52.5× |
| `micromark` | html | 3 MB/s | 53.2× |

### node 25.6.1 (V8)

| Parser | Output | Throughput | flowdown is faster by |
| --- | --- | ---: | ---: |
| `flowdown` | tree | 182 MB/s | 1.0× |
| `flowdown → HTML` | html | 129 MB/s | 1.4× |
| `marked` | html | 46 MB/s | 4.0× |
| `markdown-it` | html | 39 MB/s | 4.6× |
| `micromark` | html | 4 MB/s | 51.7× |
| `mdast-util-from-markdown` | tree | 3 MB/s | 58.7× |

## Each text

The median time of one whole parse.

### bun 1.4.4

| Text | Size | `flowdown` | `flowdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.04 ms | 2.14 ms | 1.81 ms | 0.24 ms | 0.17 ms |
| answer-20k | 20 KB | 0.12 ms | 0.15 ms | 7.75 ms | 6.22 ms | 0.67 ms | 0.62 ms |
| forms-20k | 20 KB | 0.18 ms | 0.23 ms | 9.10 ms | 9.19 ms | 1.07 ms | 0.63 ms |
| math-20k | 20 KB | 0.15 ms | 0.22 ms | 8.71 ms | 8.49 ms | 0.68 ms | 0.63 ms |
| code-50k | 48 KB | 0.02 ms | 0.04 ms | 3.87 ms | 3.83 ms | 0.09 ms | 0.13 ms |
| table-20k | 17 KB | 0.17 ms | 0.24 ms | 9.49 ms | 8.22 ms | 0.52 ms | 0.88 ms |
| long-100k | 98 KB | 0.82 ms | 1.01 ms | 37.8 ms | 36.5 ms | 3.45 ms | 2.56 ms |
| crlf-20k | 20 KB | 0.18 ms | 0.15 ms | 8.06 ms | 7.75 ms | 0.55 ms | 0.51 ms |
| footnotes-20k | 21 KB | 0.14 ms | 0.20 ms | 7.62 ms | 7.94 ms | 0.72 ms | 0.91 ms |
| answer-10k | 10 KB | 0.07 ms | 0.09 ms | 4.01 ms | 3.83 ms | 0.32 ms | 0.28 ms |
| answer-40k | 39 KB | 0.23 ms | 0.30 ms | 12.9 ms | 12.2 ms | 1.12 ms | 0.89 ms |
| commonmark-spec | 200 KB | 1.55 ms | 2.25 ms | 80.5 ms | 88.4 ms | 8.67 ms | 4.95 ms |

### node 25.6.1

| Text | Size | `flowdown` | `flowdown → HTML` | `mdast-util-from-markdown` | `micromark` | `marked` | `markdown-it` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k | 5 KB | 0.03 ms | 0.04 ms | 1.41 ms | 1.25 ms | 0.14 ms | 0.13 ms |
| answer-20k | 20 KB | 0.10 ms | 0.12 ms | 5.15 ms | 4.67 ms | 0.41 ms | 0.45 ms |
| forms-20k | 20 KB | 0.14 ms | 0.17 ms | 6.99 ms | 6.59 ms | 0.58 ms | 0.56 ms |
| math-20k | 20 KB | 0.12 ms | 0.15 ms | 6.45 ms | 6.21 ms | 0.49 ms | 0.65 ms |
| code-50k | 48 KB | 0.02 ms | 0.02 ms | 2.44 ms | 2.57 ms | 0.06 ms | 0.12 ms |
| table-20k | 17 KB | 0.12 ms | 0.17 ms | 7.70 ms | 5.95 ms | 0.58 ms | 0.95 ms |
| long-100k | 98 KB | 0.52 ms | 0.65 ms | 32.2 ms | 29.4 ms | 2.16 ms | 2.54 ms |
| crlf-20k | 20 KB | 0.09 ms | 0.11 ms | 4.70 ms | 4.46 ms | 0.35 ms | 0.43 ms |
| footnotes-20k | 21 KB | 0.11 ms | 0.14 ms | 5.94 ms | 5.51 ms | 0.46 ms | 0.54 ms |
| answer-10k | 10 KB | 0.06 ms | 0.07 ms | 2.88 ms | 2.70 ms | 0.22 ms | 0.28 ms |
| answer-40k | 39 KB | 0.17 ms | 0.21 ms | 10.1 ms | 9.82 ms | 0.71 ms | 0.81 ms |
| commonmark-spec | 200 KB | 1.29 ms | 2.06 ms | 77.0 ms | 64.4 ms | 4.88 ms | 5.41 ms |

## The parsers

| Parser | Version | Output | What it reads, set up as here |
| --- | --- | --- | --- |
| `flowdown` | 0.6.2 | tree | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `flowdown → HTML` | 0.6.2 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `mdast-util-from-markdown` | 2.1.0 | tree | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `micromark` | 4.0.3 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes |
| `marked` | 18.1.3 | html | CommonMark, tables, task lists, strikethrough, bare links (no footnotes) |
| `markdown-it` | 15.0.3 | html | CommonMark, tables, task lists, strikethrough, bare links, footnotes (with markdown-it-footnote and markdown-it-task-lists) |

Raw HTML is passed through by all of them; none sanitizes. `flowdown` is the engine
`<Markdown>` runs, called directly: it is not a public entry of the package.
`mdast-util-from-markdown` is remark's parser, the one react-markdown and Streamdown run.
The two trees differ in one way that costs time: mdast gives every node its position in the
source, inline ones too, where flowdown's tree gives positions to blocks only.

## What each one read

Headings, code blocks, tables, rows, list items, strong, emphasis, strikethrough, footnote
references and checkboxes in each output, counted on the tree or the HTML, against
flowdown's tree. Only the differences are listed. In HTML a footnote's definition is a list
item, one more than a tree counts, and micromark heads the footnotes with a heading of its own;
marked reads no footnotes.

| Text | Parser | Counted vs flowdown |
| --- | --- | --- |
| footnotes-20k | `flowdown → HTML` | listItems 76 vs 75 |
| footnotes-20k | `micromark` | headings 9 vs 8, listItems 76 vs 75 |
| footnotes-20k | `marked` | footnoteRefs 0 vs 1 |
| footnotes-20k | `markdown-it` | listItems 76 vs 75 |
