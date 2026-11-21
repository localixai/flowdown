# Highlighter benchmark

Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores, linux 6.18.44-fc-v726, bun 1.4.4; 2026-11-21.

## Whole files

Each language’s samples repeated to about 1 MB, highlighted once; milliseconds, lower is better.

| Language | `@localix-ai/highlight` | highlight.js | Shiki |
| --- | ---: | ---: | ---: |
| bash | 132 | 258 | 2390 |
| c | 143 | 523 | 4014 |
| console | 66.4 | 244 | 1281 |
| cpp | 115 | 452 | 9204 |
| csharp | 160 | 324 | 2429 |
| css | 152 | 492 | 7755 |
| diff | 10.5 | 34.6 | 333 |
| dockerfile | 88.4 | 549 | 806 |
| go | 156 | 215 | 4651 |
| xml | 162 | 449 | 819 |
| ini | 47.6 | 322 | 483 |
| java | 115 | 344 | 2540 |
| javascript | 133 | 689 | 4132 |
| json | 80.3 | 787 | 1555 |
| kotlin | 108 | 386 | 1711 |
| markdown | 83.3 | 104 | 1864 |
| php | 96.6 | 534 | 3621 |
| python | 129 | 285 | 3526 |
| ruby | 87.2 | 534 | 3132 |
| rust | 92.3 | 295 | 3389 |
| sql | 108 | 280 | 4457 |
| swift | 77.6 | 385 | 3840 |
| toml | 98.3 | 407 | 959 |
| typescript | 143 | 766 | 4491 |
| yaml | 154 | 289 | 1400 |
| scss | 113 | 341 | 7053 |

On the languages both have, highlight.js takes 3.6× as long; Shiki 29×.

## A file that streams

59,597 characters of TypeScript, 8 a token, drawn on every token; stopped past 20 s.

| Highlighter | Total | Drawn |
| --- | ---: | ---: |
| @localix-ai/highlight, line by line | 30.4 ms | 100% |
| highlight.js, in pieces of 40 lines | 3145 ms | 100% |
| highlight.js, the whole text | 20011 ms | 35% |
| Shiki, the whole text | 20030 ms | 14% |

Four times the file costs 3.5× the time (exponent 0.91).
