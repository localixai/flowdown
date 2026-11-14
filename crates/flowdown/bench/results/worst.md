| Text | Size | `flowdown` | at four times | grows | `pulldown-cmark` | at four times | grows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `[` again and again | 4.9 KB | 76 µs | 303 µs | 4.0x | 83 µs | 324 µs | 3.9x |
| `*a ` again and again | 15 KB | 124 µs | 502 µs | 4.0x | 149 µs | 587 µs | 3.9x |
| `**a` again and again | 15 KB | 118 µs | 471 µs | 4.0x | 159 µs | 1.09 ms | 6.9x |
| `_a_ *b* ` again and again | 39 KB | 449 µs | 2.30 ms | 5.1x | 557 µs | 3.05 ms | 5.5x |
| stars, a word, stars | 9.8 KB | 29 µs | 114 µs | 3.9x | 86 µs | 364 µs | 4.2x |
| brackets, a word, brackets | 9.8 KB | 65 µs | 260 µs | 4.0x | 143 µs | 583 µs | 4.1x |
| `[a](` again and again | 20 KB | 365 µs | 1.46 ms | 4.0x | 627 µs | 3.17 ms | 5.1x |
| `![[]()` again and again | 29 KB | 132 µs | 542 µs | 4.1x | 267 µs | 1.53 ms | 5.7x |
| `` `a `` again and again | 9.8 KB | 22 µs | 89 µs | 4.0x | 93 µs | 395 µs | 4.3x |
| backtick runs, each one longer | 4.9 KB | 3.87 µs | 14 µs | 3.5x | 8.94 µs | 20 µs | 2.3x |
| `<` again and again | 4.9 KB | 46 µs | 180 µs | 4.0x | 67 µs | 258 µs | 3.9x |
| `<!--` again and again | 20 KB | 0.79 µs | 3.10 µs | 3.9x | 0.78 µs | 2.91 µs | 3.7x |
| `&` again and again | 4.9 KB | 8.99 µs | 36 µs | 4.1x | 9.44 µs | 38 µs | 4.0x |
| backslashes | 4.9 KB | 8.60 µs | 35 µs | 4.1x | 22 µs | 83 µs | 3.7x |
| quotes inside quotes | 1.0 KB | 5.96 µs | 24 µs | 4.0x | 9.48 µs | 39 µs | 4.1x |
| lists inside lists | 1.0 KB | 0.39 µs | 1.36 µs | 3.5x | 1.00 µs | 3.74 µs | 3.8x |
| a table with cells missing | 1.7 KB | 18 µs | 71 µs | 3.9x | 912 µs | 5.40 ms | 5.9x |
| a definition, then its links | 1.2 KB | 13 µs | 51 µs | 4.0x | 23 µs | 67 µs | 3.0x |
| bare links | 54 KB | 3.24 µs | 13 µs | 3.9x | 13 µs | 52 µs | 4.0x |
| an address, then `)` again and again | 4.9 KB | 7.09 µs | 28 µs | 4.0x | 1.29 µs | 4.82 µs | 3.7x |
