# The whole text, read once

Apple M5, Darwin 25.6.0, rustc 1.100.0 (0ef1bc386 2026-11-09)

## Over the whole corpus

| Parser | Gives | Throughput | flowdown is faster by | Allocations | Allocated |
| --- | --- | ---: | ---: | ---: | ---: |
| `flowdown` | a tree | 194 MB/s | 1.0x | 89 | 4.4 MB |
| `flowdown, walked` | a tree, every node visited | 167 MB/s | 1.2x | 89 | 4.4 MB |
| `pulldown-cmark` | events, dropped | 182 MB/s | 1.1x | 262 | 5.2 MB |
| `pulldown-cmark, kept` | events in a `Vec` | 171 MB/s | 1.1x | 339 | 13 MB |
| `comrak` | a tree | 55 MB/s | 3.5x | 217,548 | 54 MB |

## Text by text: the time of one read

| Text | Size | `flowdown` | `flowdown, walked` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reply, 1 KB | 2.0 KB | 7.06 µs | 8.08 µs | 7.22 µs | 7.60 µs | 21 µs |
| reply, 8 KB | 8.5 KB | 55 µs | 67 µs | 62 µs | 64 µs | 180 µs |
| reply, 64 KB | 64 KB | 360 µs | 433 µs | 395 µs | 406 µs | 1.31 ms |
| reply, 512 KB | 512 KB | 3.17 ms | 3.65 ms | 3.32 ms | 3.60 ms | 11 ms |
| github, 64 KB | 64 KB | 353 µs | 425 µs | 393 µs | 405 µs | 1.26 ms |
| crdt.md | 76 KB | 125 µs | 143 µs | 130 µs | 132 µs | 513 µs |
| spec.txt | 200 KB | 600 µs | 675 µs | 662 µs | 675 µs | 2.47 ms |

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
