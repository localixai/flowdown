| Stream | Size | Reads | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reply, 2 KB | 2.3 KB | 73 | 340 µs | 424 µs | 455 µs | 1.36 ms |
| reply, 8 KB | 8.1 KB | 259 | 1.80 ms | 2.37 ms | 2.72 ms | 9.26 ms |
| reply, 32 KB | 34 KB | 1088 | 31 ms | 47 ms | 53 ms | 198 ms |
| reply, 128 KB | 128 KB | 4098 | 446 ms | 682 ms | 759 ms | 2.85 s |

The slowest single read of each stream:

| Stream | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: |
| reply, 2 KB | 9.75 µs | 13 µs | 14 µs | 38 µs |
| reply, 8 KB | 15 µs | 20 µs | 23 µs | 77 µs |
| reply, 32 KB | 59 µs | 89 µs | 102 µs | 374 µs |
| reply, 128 KB | 257 µs | 372 µs | 406 µs | 1.51 ms |
