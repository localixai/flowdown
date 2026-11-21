# Highlighter benchmark

Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores, linux 6.18.44-fc-v726, bun 1.4.4; 2026-11-21.

## Whole files

Each language’s samples repeated to about 1 MB, highlighted once; milliseconds, lower is better.

| Language | `@localix-ai/highlight` | highlight.js | Shiki |
| --- | ---: | ---: | ---: |
| bash | 134 | 207 | 2889 |
| c | 118 | 450 | 3702 |
| console | 65.1 | 244 | 1096 |
| cpp | 132 | 484 | 8539 |
| csharp | 117 | 242 | 2048 |
| css | 154 | 488 | 5409 |
| diff | 9.0 | 20.8 | 197 |
| dockerfile | 59.5 | 425 | 443 |
| go | 114 | 184 | 4128 |
| xml | 103 | 443 | 819 |
| ini | 80.0 | 348 | 455 |
| java | 106 | 302 | 1950 |
| javascript | 117 | 857 | 4634 |
| json | 82.2 | 790 | 1827 |
| kotlin | 135 | 303 | 1569 |
| markdown | 76.7 | 95.5 | 1361 |
| php | 116 | 438 | 3127 |
| python | 107 | 243 | 3631 |
| ruby | 83.7 | 523 | 3248 |
| rust | 93.0 | 268 | 2709 |
| sql | 96.9 | 229 | 3932 |
| swift | 70.0 | 364 | 2684 |
| toml | 103 | 397 | 866 |
| typescript | 133 | 659 | 3629 |
| yaml | 99.0 | 306 | 1268 |
| scss | 104 | 327 | 6873 |

On the languages both have, highlight.js takes 3.7× as long; Shiki 28×.

## A file that streams

59,597 characters of TypeScript, 8 a token, drawn on every token; stopped past 20 s.

| Highlighter | Total | Drawn |
| --- | ---: | ---: |
| @localix-ai/highlight, line by line | 44.5 ms | 100% |
| highlight.js, in pieces of 40 lines | 3401 ms | 100% |
| highlight.js, the whole text | 20011 ms | 33% |
| Shiki, the whole text | 20021 ms | 14% |

Four times the file costs 2.8× the time (exponent 0.74).
