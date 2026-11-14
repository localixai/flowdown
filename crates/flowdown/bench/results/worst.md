| Text | Size | `flowdown` | at four times | grows | `pulldown-cmark` | at four times | grows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `[` again and again | 4.9 KB | 59 µs | 235 µs | 4.0x | 73 µs | 295 µs | 4.0x |
| `*a ` again and again | 15 KB | 118 µs | 474 µs | 4.0x | 141 µs | 567 µs | 4.0x |
| `**a` again and again | 15 KB | 117 µs | 458 µs | 3.9x | 160 µs | 1.18 ms | 7.4x |
| `_a_ *b* ` again and again | 39 KB | 456 µs | 2.01 ms | 4.4x | 563 µs | 3.05 ms | 5.4x |
| stars, a word, stars | 9.8 KB | 30 µs | 114 µs | 3.9x | 86 µs | 368 µs | 4.3x |
| brackets, a word, brackets | 9.8 KB | 63 µs | 250 µs | 4.0x | 150 µs | 614 µs | 4.1x |
| `[a](` again and again | 20 KB | 404 µs | 1.47 ms | 3.6x | 634 µs | 3.10 ms | 4.9x |
| `![[]()` again and again | 29 KB | 133 µs | 537 µs | 4.0x | 260 µs | 1.45 ms | 5.6x |
| `` `a `` again and again | 9.8 KB | 23 µs | 88 µs | 3.9x | 91 µs | 383 µs | 4.2x |
| backtick runs, each one longer | 4.9 KB | 3.85 µs | 13 µs | 3.4x | 9.15 µs | 21 µs | 2.3x |
| `<` again and again | 4.9 KB | 47 µs | 184 µs | 3.9x | 67 µs | 259 µs | 3.9x |
| `<!--` again and again | 20 KB | 0.80 µs | 3.13 µs | 3.9x | 0.78 µs | 2.93 µs | 3.7x |
| `&` again and again | 4.9 KB | 9.45 µs | 38 µs | 4.0x | 9.41 µs | 37 µs | 4.0x |
| backslashes | 4.9 KB | 8.63 µs | 33 µs | 3.9x | 21 µs | 80 µs | 3.8x |
| quotes inside quotes | 1.0 KB | 5.45 µs | 22 µs | 4.0x | 8.82 µs | 36 µs | 4.1x |
| lists inside lists | 1.0 KB | 0.36 µs | 1.27 µs | 3.5x | 1.01 µs | 3.79 µs | 3.7x |
| a table with cells missing | 1.7 KB | 17 µs | 68 µs | 4.0x | 860 µs | 5.02 ms | 5.8x |
| a definition, then its links | 1.2 KB | 13 µs | 50 µs | 4.0x | 22 µs | 67 µs | 3.0x |
| bare links | 54 KB | 3.29 µs | 13 µs | 3.9x | 13 µs | 53 µs | 4.0x |
| an address, then `)` again and again | 4.9 KB | 7.08 µs | 28 µs | 3.9x | 1.30 µs | 4.85 µs | 3.7x |
