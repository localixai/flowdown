| Stream | Size | Reads | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| reply, 2 KB | 2.3 KB | 73 | 157 µs | 327 µs | 408 µs | 1.28 ms |
| reply, 8 KB | 8.1 KB | 259 | 1.72 ms | 2.36 ms | 2.62 ms | 9.48 ms |
| reply, 32 KB | 34 KB | 1088 | 31 ms | 47 ms | 52 ms | 193 ms |
| reply, 128 KB | 128 KB | 4098 | 448 ms | 682 ms | 783 ms | 3.01 s |

The slowest single read of each stream:

| Stream | `flowdown` | `pulldown-cmark` | `pulldown-cmark, kept` | `comrak` |
| --- | ---: | ---: | ---: | ---: |
| reply, 2 KB | 4.29 µs | 6.62 µs | 12 µs | 36 µs |
| reply, 8 KB | 14 µs | 19 µs | 22 µs | 78 µs |
| reply, 32 KB | 67 µs | 93 µs | 99 µs | 365 µs |
| reply, 128 KB | 247 µs | 383 µs | 406 µs | 1.70 ms |
