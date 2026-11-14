| Text | Size | `flowdown` | at four times | grows | `pulldown-cmark` | at four times | grows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `[` again and again | 4.9 KB | 54 µs | 214 µs | 4.0x | 71 µs | 282 µs | 3.9x |
| `*a ` again and again | 15 KB | 122 µs | 498 µs | 4.1x | 150 µs | 596 µs | 4.0x |
| `**a` again and again | 15 KB | 122 µs | 490 µs | 4.0x | 165 µs | 1.31 ms | 7.9x |
| `_a_ *b* ` again and again | 39 KB | 493 µs | 2.69 ms | 5.5x | 584 µs | 3.51 ms | 6.0x |
| stars, a word, stars | 9.8 KB | 34 µs | 134 µs | 4.0x | 87 µs | 365 µs | 4.2x |
| brackets, a word, brackets | 9.8 KB | 72 µs | 287 µs | 4.0x | 166 µs | 673 µs | 4.1x |
| `[a](` again and again | 20 KB | 390 µs | 1.55 ms | 4.0x | 708 µs | 3.61 ms | 5.1x |
| `![[]()` again and again | 29 KB | 141 µs | 570 µs | 4.0x | 277 µs | 1.65 ms | 6.0x |
| `` `a `` again and again | 9.8 KB | 24 µs | 94 µs | 3.9x | 97 µs | 411 µs | 4.2x |
| backtick runs, each one longer | 4.9 KB | 4.06 µs | 14 µs | 3.6x | 9.55 µs | 22 µs | 2.3x |
| `<` again and again | 4.9 KB | 52 µs | 207 µs | 4.0x | 70 µs | 270 µs | 3.9x |
| `<!--` again and again | 20 KB | 0.88 µs | 3.45 µs | 3.9x | 0.87 µs | 3.24 µs | 3.7x |
| `&` again and again | 4.9 KB | 11 µs | 42 µs | 4.0x | 10 µs | 41 µs | 4.0x |
| backslashes | 4.9 KB | 9.44 µs | 38 µs | 4.0x | 24 µs | 89 µs | 3.8x |
| quotes inside quotes | 1.0 KB | 6.10 µs | 24 µs | 4.0x | 10 µs | 41 µs | 4.0x |
| lists inside lists | 1.0 KB | 0.40 µs | 1.40 µs | 3.5x | 0.96 µs | 3.61 µs | 3.8x |
| a table with cells missing | 1.7 KB | 19 µs | 74 µs | 4.0x | 942 µs | 6.55 ms | 6.9x |
| a definition, then its links | 1.2 KB | 14 µs | 55 µs | 3.8x | 25 µs | 72 µs | 2.9x |
| bare links | 54 KB | 3.48 µs | 14 µs | 3.9x | 14 µs | 55 µs | 4.0x |
