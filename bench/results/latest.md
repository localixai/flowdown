# Benchmark results

- **date:** 2026-11-10T00:44:20.418Z
- **label:** compare
- **commit:** 7d05434
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** llx 0.1.0, llx+highlight 0.1.0, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 186 ms (0.24) | 164 ms (0.25) | 182 ms (0.30) | 925 ms (1.69) | 34.4 ms (0.05) | 142 ms (0.25) | 124 ms (0.19) |
| chat-5k · frame | 44.8 ms (0.31) | 43.1 ms (0.29) | 49.2 ms (0.32) | 225 ms (1.93) | 11.1 ms (0.07) | 38.3 ms (0.26) | 34.0 ms (0.23) |
| answer-20k · token | 499 ms (0.30) | 569 ms (0.38) | 1399 ms (0.62) | 14266 ms (6.00) | 487 ms (0.18) | 1349 ms (0.65) | 1293 ms (0.50) |
| answer-20k · frame | 123 ms (0.34) | 154 ms (0.44) | 282 ms (0.56) | 2887 ms (5.29) | 129 ms (0.20) | 321 ms (0.71) | 306 ms (0.53) |
| answer-20k · line | 84.6 ms (0.64) | 82.7 ms (0.57) | 112 ms (0.61) | 1082 ms (5.72) | 47.2 ms (0.24) | 134 ms (0.82) | 103 ms (0.48) |
| forms-20k · frame | 636 ms (1.65) | 712 ms (1.79) | 663 ms (1.17) | 4062 ms (7.53) | 145 ms (0.24) | 393 ms (0.92) | 503 ms (0.88) |
| math-20k · frame | 192 ms (0.61) | 222 ms (0.58) | 507 ms (1.25) | 3680 ms (8.24) | 144 ms (0.32) | 306 ms (0.68) | 359 ms (0.76) |
| code-50k · token | 2338 ms (0.40) | 6805 ms (1.07) | 26636 ms (4.73) | 16863 ms (3.19) | 436 ms (0.09) | 4614 ms (0.76) | 324 ms (0.05) |
| code-50k · frame | 593 ms (0.53) | 1348 ms (0.98) | 5494 ms (4.23) | 5676 ms (5.22) | 62.1 ms (0.05) | 1638 ms (1.26) | 81.7 ms (0.07) |
| table-20k · frame | 824 ms (6.70) | 873 ms (6.56) | 4887 ms (11.0) | 3843 ms (8.36) | 187 ms (0.41) | 1031 ms (2.73) | 329 ms (0.81) |
| long-100k · frame | 880 ms (0.43) | 1155 ms (0.57) | 7283 ms (2.86) | stopped at 65% | 2577 ms (1.11) | 6032 ms (2.57) | 9649 ms (3.51) |
| crlf-20k · frame | 126 ms (0.33) | 150 ms (0.40) | 328 ms (0.68) | 3019 ms (5.38) | 130 ms (0.26) | 272 ms (0.62) | 315 ms (0.51) |
| footnotes-20k · frame | 209 ms (0.53) | 231 ms (0.50) | 373 ms (0.73) | 3363 ms (7.02) | 122 ms (0.23) | 295 ms (0.48) | 387 ms (0.70) |
| thread-30 · frame | 134 ms (0.61) | 142 ms (0.60) | 150 ms (0.65) | 17196 ms (38.3) | 605 ms (1.92) | 131 ms (0.52) | 1818 ms (4.28) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 1.99 ms | 0 / 0 / 1.71 ms | 0 / 0 / 1.62 ms | 0 / 0 / 2.87 ms | 0 / 0 / 0.97 ms | 0 / 0 / 2.28 ms | 0 / 0 / 0.97 ms |
| chat-5k · frame | 0 / 0 / 1.83 ms | 0 / 0 / 1.45 ms | 0 / 0 / 1.78 ms | 0 / 0 / 2.96 ms | 0 / 0 / 0.11 ms | 0 / 0 / 2.07 ms | 0 / 0 / 0.44 ms |
| answer-20k · token | 0 / 0 / 2.16 ms | 0 / 0 / 3.18 ms | 0 / 0 / 3.70 ms | 14 / 2 / 149 ms | 0 / 0 / 1.79 ms | 0 / 0 / 4.02 ms | 0 / 0 / 2.07 ms |
| answer-20k · frame | 0 / 0 / 1.73 ms | 0 / 0 / 1.64 ms | 0 / 0 / 2.10 ms | 0 / 0 / 7.47 ms | 0 / 0 / 2.22 ms | 0 / 0 / 2.35 ms | 0 / 0 / 1.63 ms |
| answer-20k · line | 0 / 0 / 4.57 ms | 0 / 0 / 2.46 ms | 0 / 0 / 2.60 ms | 0 / 0 / 7.12 ms | 0 / 0 / 1.55 ms | 0 / 0 / 3.32 ms | 0 / 0 / 1.27 ms |
| forms-20k · frame | 0 / 0 / 2.89 ms | 0 / 0 / 3.16 ms | 0 / 0 / 2.79 ms | 0 / 0 / 14.0 ms | 0 / 0 / 1.21 ms | 0 / 0 / 2.96 ms | 0 / 0 / 1.87 ms |
| math-20k · frame | 0 / 0 / 2.99 ms | 0 / 0 / 2.29 ms | 0 / 0 / 11.1 ms | 0 / 0 / 14.8 ms | 0 / 0 / 1.78 ms | 0 / 0 / 3.94 ms | 0 / 0 / 2.45 ms |
| code-50k · token | 0 / 0 / 6.23 ms | 3 / 2 / 328 ms | 15 / 3 / 207 ms | 6 / 1 / 85.2 ms | 0 / 0 / 3.33 ms | 0 / 0 / 9.23 ms | 0 / 0 / 0.65 ms |
| code-50k · frame | 0 / 0 / 5.83 ms | 1 / 0 / 21.6 ms | 3 / 1 / 50.7 ms | 16 / 5 / 179 ms | 0 / 0 / 0.85 ms | 1 / 0 / 18.4 ms | 0 / 0 / 0.24 ms |
| table-20k · frame | 0 / 0 / 14.7 ms | 0 / 0 / 14.4 ms | 6 / 0 / 19.7 ms | 0 / 0 / 14.9 ms | 0 / 0 / 1.48 ms | 0 / 0 / 5.82 ms | 0 / 0 / 1.68 ms |
| long-100k · frame | 0 / 0 / 2.16 ms | 0 / 0 / 3.37 ms | 0 / 0 / 9.53 ms | 444 / 1 / 51.3 ms | 0 / 0 / 4.35 ms | 1 / 0 / 20.1 ms | 3 / 2 / 331 ms |
| crlf-20k · frame | 0 / 0 / 1.91 ms | 0 / 0 / 1.47 ms | 0 / 0 / 2.25 ms | 0 / 0 / 12.9 ms | 0 / 0 / 1.99 ms | 0 / 0 / 2.72 ms | 0 / 0 / 1.78 ms |
| footnotes-20k · frame | 0 / 0 / 12.5 ms | 0 / 0 / 12.8 ms | 0 / 0 / 15.3 ms | 0 / 0 / 9.45 ms | 0 / 0 / 2.08 ms | 0 / 0 / 4.05 ms | 0 / 0 / 1.68 ms |
| thread-30 · frame | 0 / 0 / 2.07 ms | 0 / 0 / 2.81 ms | 0 / 0 / 2.06 ms | 515 / 2 / 61.7 ms | 0 / 0 / 3.22 ms | 0 / 0 / 3.99 ms | 0 / 0 / 5.76 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.8 / 1.2 / 0.5 | 0.9 / 1.2 / 0.5 | 1.1 / 1.4 / -0.4 | 0.7 / 1.1 / 0.5 | 0.6 / 1.1 / 0.1 | 4.4 / 4.3 / 0.3 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.8 / 0.4 / 0.2 | 0.8 / 0.6 / 0.2 | 1.1 / 0.9 / 0.2 | 0.7 / 0.4 / 0.1 | 0.7 / 0.2 / 0.4 | 4.0 / 1.0 / 0.3 | 0.5 / 0.1 / 0.1 |
| answer-20k · token | 3.7 / 3.2 / -1.6 | 4.6 / 4.4 / 0.3 | 5.8 / 5.1 / -4.2 | 1.8 / 2.1 / 0.2 | 2.7 / 1.7 / 0.2 | 13.7 / 5.8 / 0.6 | 1.7 / 1.2 / -0.9 |
| answer-20k · frame | 3.7 / 1.6 / 0.2 | 4.6 / 2.7 / 0.2 | 5.7 / 2.7 / 0.2 | 1.8 / 0.8 / 0.2 | 2.6 / 0.4 / 0.2 | 10.6 / 0.6 / 0.4 | 1.6 / 0.2 / 0.2 |
| answer-20k · line | 3.5 / 1.1 / 0.3 | 4.4 / 1.3 / 0.3 | 5.8 / 0.9 / 0.2 | 1.9 / 0.4 / -1.0 | 1.6 / -0.6 / -1.4 | 10.0 / 1.3 / 0.3 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.5 / 1.6 / 0.3 | 10.4 / 1.6 / 0.3 | 9.8 / 1.7 / 0.2 | 2.3 / 0.5 / -1.6 | 2.9 / 0.5 / 0.1 | 12.9 / 2.2 / 0.4 | 2.0 / 0.6 / -1.3 |
| math-20k · frame | 3.8 / 2.0 / 0.2 | 5.3 / 2.2 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.4 | 3.5 / 1.3 / -2.4 | 13.4 / 2.0 / 0.5 | 2.3 / 1.0 / 0.1 |
| code-50k · token | 0.8 / 1.3 / 0.5 | 15.5 / 1.3 / -1.0 | 10.3 / 0.0 / 0.1 | 0.1 / -0.5 / 0.1 | 0.4 / 0.7 / 0.3 | 1.5 / 2.5 / -1.1 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 1.0 / 0.9 / 0.1 | 15.4 / 0.9 / 0.2 | 10.4 / 0.3 / -1.4 | 0.3 / 0.7 / -1.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.8 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 4.4 / 0.9 / 0.0 | 4.4 / 0.9 / 0.1 | 6.9 / 1.2 / -1.3 | 3.3 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 23.5 / 2.4 / 0.3 | 29.0 / 2.1 / 0.3 | 26.6 / 2.5 / -1.0 | 4.9 / 0.2 / -0.0 | 32.4 / 1.6 / 0.2 | 56.8 / 7.3 / -0.8 | 8.0 / 1.2 / -1.3 |
| crlf-20k · frame | 3.1 / 1.2 / 0.1 | 4.2 / 1.7 / 0.1 | 5.7 / 0.7 / 0.2 | 1.5 / 1.1 / 0.2 | 2.4 / 0.4 / 0.2 | 9.3 / 2.4 / 0.4 | 2.0 / 0.7 / 0.2 |
| footnotes-20k · frame | 3.0 / 1.4 / 0.2 | 4.4 / 2.5 / 0.2 | 6.0 / 2.4 / 0.3 | 2.1 / 1.5 / -1.3 | 2.6 / 1.2 / 0.2 | 11.9 / 4.7 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 15.0 / 0.9 / 0.2 | 19.1 / 0.8 / 0.2 | 29.2 / 1.1 / 0.3 | 9.0 / -1.2 / -0.1 | 10.3 / 0.4 / 0.1 | 57.3 / 1.7 / 0.4 | 9.9 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 65.6 ms | 245 ms | 3.7× (n^0.95) |
| `llx+highlight` | 66.2 ms | 351 ms | 5.3× (n^1.20) |
| `streamdown` | 134 ms | 890 ms | 6.6× (n^1.36) |
| `react-markdown` | 876 ms | 13180 ms | 15.0× (n^1.96) |
| `markdown-to-jsx` | 42.7 ms | 371 ms | 8.7× (n^1.56) |
| `markstream` | 149 ms | 1076 ms | 7.2× (n^1.42) |
| `marked-react` | 86.6 ms | 1092 ms | 12.6× (n^1.83) |
