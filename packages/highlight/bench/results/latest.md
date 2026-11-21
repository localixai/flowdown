# Highlighter benchmark

Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores, linux 6.18.44-fc-v726, bun 1.4.4; 2026-11-21.

## Whole files

Each language’s samples repeated to about 1 MB, highlighted once; milliseconds, lower is better.

| Language | `@localix-ai/highlight` | highlight.js | Shiki |
| --- | ---: | ---: | ---: |
| bash | 106 | 189 | 2519 |
| c | 111 | 403 | 4251 |
| console | 62.7 | 298 | 955 |
| cpp | 118 | 451 | 7901 |
| csharp | 75.9 | 237 | 1938 |
| css | 131 | 450 | 6009 |
| diff | 13.9 | 26.8 | 237 |
| dockerfile | 64.6 | 404 | 448 |
| go | 101 | 184 | 3656 |
| xml | 95.8 | 378 | 898 |
| ini | 43.8 | 250 | 476 |
| java | 95.0 | 375 | 2089 |
| javascript | 92.7 | 760 | 4926 |
| json | 106 | 766 | 1586 |
| kotlin | 144 | 357 | 1447 |
| markdown | 52.9 | 97.3 | 1399 |
| php | 98.6 | 413 | 3105 |
| python | 94.0 | 246 | 4166 |
| ruby | 111 | 474 | 3071 |
| rust | 97.2 | 259 | 2843 |
| sql | 141 | 243 | 4080 |
| swift | 70.1 | 355 | 2603 |
| toml | 85.8 | 394 | 1008 |
| typescript | 111 | 686 | 4189 |
| yaml | 85.9 | 277 | 1208 |
| scss | 105 | 399 | 6608 |

On the languages both have, highlight.js takes 3.9× as long; Shiki 30×.

## A file that streams

59,597 characters of TypeScript, 8 a token, drawn on every token; stopped past 20 s.

| Highlighter | Total | Drawn |
| --- | ---: | ---: |
| @localix-ai/highlight, line by line | 54.4 ms | 100% |
| highlight.js, in pieces of 40 lines | 3489 ms | 100% |
| highlight.js, the whole text | 20012 ms | 34% |
| Shiki, the whole text | 20026 ms | 14% |

Four times the file costs 4.8× the time (exponent 1.13).
