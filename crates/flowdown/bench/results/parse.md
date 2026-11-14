# The whole text, read once

Apple M5, Darwin 25.6.0, rustc 1.100.0 (0ef1bc386 2026-11-09)

## Over the whole corpus

| Parser | Gives | Throughput | flowdown is faster by | Allocations | Allocated |
| --- | --- | ---: | ---: | ---: | ---: |
| `flowdown` | a tree | 414 MB/s | 1.0x | 89 | 4.4 MB |
| `flowdown, walked` | a tree, every node visited | 393 MB/s | 1.1x | 89 | 4.4 MB |
| `pulldown-cmark` | events, dropped | 349 MB/s | 1.2x | 262 | 5.2 MB |
| `pulldown-cmark, kept` | events in a `Vec` | 308 MB/s | 1.3x | 339 | 13 MB |
| `comrak` | a tree | 87 MB/s | 4.8x | 217,548 | 54 MB |

## Text by text: the time of one read

| Text | Size | `flowdown` | `flowdown, walked` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reply, 1 KB | 2.0 KB | 2.18 µs | 2.41 µs | 2.86 µs | 3.46 µs | 12 µs |
| reply, 8 KB | 8.5 KB | 16 µs | 19 µs | 24 µs | 27 µs | 91 µs |
| reply, 64 KB | 64 KB | 118 µs | 129 µs | 183 µs | 189 µs | 777 µs |
| reply, 512 KB | 512 KB | 1.68 ms | 1.77 ms | 1.84 ms | 2.14 ms | 6.81 ms |
| github, 64 KB | 64 KB | 113 µs | 127 µs | 176 µs | 184 µs | 726 µs |
| crdt.md | 76 KB | 34 µs | 38 µs | 60 µs | 65 µs | 350 µs |
| spec.txt | 200 KB | 217 µs | 219 µs | 308 µs | 334 µs | 1.66 ms |

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
