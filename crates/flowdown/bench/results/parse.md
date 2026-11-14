# The whole text, read once

Apple M5, Darwin 25.6.0, rustc 1.100.0 (0ef1bc386 2026-11-09)

## Over the whole corpus

| Parser | Gives | Throughput | flowdown is faster by | Allocations | Allocated |
| --- | --- | ---: | ---: | ---: | ---: |
| `flowdown` | a tree | 429 MB/s | 1.0x | 89 | 4.4 MB |
| `flowdown, walked` | a tree, every node visited | 407 MB/s | 1.1x | 89 | 4.4 MB |
| `pulldown-cmark` | events, dropped | 357 MB/s | 1.2x | 262 | 5.2 MB |
| `pulldown-cmark, kept` | events in a `Vec` | 314 MB/s | 1.4x | 339 | 13 MB |
| `comrak` | a tree | 90 MB/s | 4.7x | 217,548 | 54 MB |

## Text by text: the time of one read

| Text | Size | `flowdown` | `flowdown, walked` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reply, 1 KB | 2.0 KB | 2.31 µs | 2.55 µs | 3.07 µs | 3.66 µs | 13 µs |
| reply, 8 KB | 8.5 KB | 17 µs | 19 µs | 24 µs | 28 µs | 93 µs |
| reply, 64 KB | 64 KB | 117 µs | 128 µs | 181 µs | 187 µs | 762 µs |
| reply, 512 KB | 512 KB | 1.61 ms | 1.69 ms | 1.77 ms | 2.07 ms | 6.44 ms |
| github, 64 KB | 64 KB | 115 µs | 127 µs | 177 µs | 184 µs | 724 µs |
| crdt.md | 76 KB | 32 µs | 36 µs | 58 µs | 62 µs | 322 µs |
| spec.txt | 200 KB | 221 µs | 224 µs | 315 µs | 346 µs | 1.67 ms |

## Text by text: allocations of one read (exact)

| Text | `flowdown` | `flowdown, walked` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: |
| reply, 1 KB | 9 / 16 KB | 9 / 16 KB | 9 / 23 KB | 15 / 33 KB | 311 / 48 KB |
| reply, 8 KB | 11 / 60 KB | 11 / 60 KB | 17 / 116 KB | 26 / 196 KB | 2,382 / 641 KB |
| reply, 64 KB | 18 / 382 KB | 18 / 382 KB | 31 / 429 KB | 43 / 1.0 MB | 16,793 / 4.8 MB |
| reply, 512 KB | 25 / 3.0 MB | 25 / 3.0 MB | 87 / 3.3 MB | 102 / 8.3 MB | 132,283 / 38 MB |
| github, 64 KB | 13 / 374 KB | 13 / 374 KB | 33 / 430 KB | 45 / 1.0 MB | 15,977 / 3.1 MB |
| crdt.md | 5 / 114 KB | 5 / 114 KB | 15 / 249 KB | 25 / 409 KB | 7,283 / 1.6 MB |
| spec.txt | 8 / 488 KB | 8 / 488 KB | 70 / 660 KB | 83 / 1.9 MB | 42,519 / 5.9 MB |

The texts:

- **reply, 1 KB**: a short answer.
- **reply, 8 KB**: an answer with its forms.
- **reply, 64 KB**: a long report.
- **reply, 512 KB**: far past what a model writes.
- **github, 64 KB**: the same, GitHub's Markdown only.
- **crdt.md**: pulldown-cmark's own benchmark text.
- **spec.txt**: the CommonMark specification.
