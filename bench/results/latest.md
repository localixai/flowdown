# Benchmark results

- **date:** 2026-11-10T03:01:28.219Z
- **label:** local
- **commit:** a08eb11
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
| chat-5k · token | 27.0 ms (0.04) | 24.5 ms (0.04) | 168 ms (0.25) | 860 ms (1.51) | 42.9 ms (0.05) | 126 ms (0.16) | 132 ms (0.19) |
| chat-5k · frame | 12.6 ms (0.09) | 13.7 ms (0.10) | 56.3 ms (0.35) | 206 ms (1.56) | 18.4 ms (0.14) | 40.7 ms (0.23) | 42.0 ms (0.25) |
| answer-20k · token | 96.3 ms (0.03) | 198 ms (0.22) | 1113 ms (0.49) | 12142 ms (5.18) | 469 ms (0.17) | 1239 ms (0.62) | 1194 ms (0.48) |
| answer-20k · frame | 36.8 ms (0.08) | 66.5 ms (0.29) | 311 ms (0.61) | 2773 ms (5.30) | 128 ms (0.18) | 336 ms (0.73) | 283 ms (0.48) |
| answer-20k · line | 21.4 ms (0.14) | 35.3 ms (0.40) | 107 ms (0.61) | 996 ms (5.23) | 55.7 ms (0.24) | 138 ms (0.81) | 111 ms (0.48) |
| forms-20k · frame | 76.7 ms (0.15) | 154 ms (0.31) | 665 ms (1.19) | 3670 ms (6.98) | 141 ms (0.21) | 354 ms (0.82) | 468 ms (0.79) |
| math-20k · frame | 35.7 ms (0.08) | 68.5 ms (0.27) | 321 ms (0.63) | 2844 ms (6.21) | 124 ms (0.23) | 270 ms (0.58) | 296 ms (0.58) |
| code-50k · token | 354 ms (0.05) | 3289 ms (0.55) | 20432 ms (3.63) | 12102 ms (2.27) | 218 ms (0.03) | 4058 ms (0.66) | 303 ms (0.05) |
| code-50k · frame | 93.7 ms (0.06) | 811 ms (0.60) | 5342 ms (4.15) | 2866 ms (2.33) | 58.1 ms (0.03) | 946 ms (0.67) | 79.9 ms (0.05) |
| table-20k · frame | 34.5 ms (0.12) | 29.7 ms (0.10) | 3932 ms (8.53) | 3195 ms (7.02) | 165 ms (0.31) | 856 ms (2.04) | 267 ms (0.53) |
| long-100k · frame | 254 ms (0.09) | 390 ms (0.25) | 6038 ms (2.32) | stopped at 67% | 2580 ms (1.15) | 5631 ms (2.32) | 7124 ms (2.99) |
| crlf-20k · frame | 36.0 ms (0.07) | 68.3 ms (0.27) | 334 ms (0.60) | 2531 ms (4.86) | 122 ms (0.17) | 252 ms (0.52) | 270 ms (0.45) |
| footnotes-20k · frame | 44.6 ms (0.10) | 76.7 ms (0.31) | 323 ms (0.64) | 2915 ms (5.94) | 115 ms (0.20) | 273 ms (0.42) | 368 ms (0.64) |
| thread-30 · frame | 60.9 ms (0.17) | 78.7 ms (0.35) | 145 ms (0.63) | 16607 ms (43.4) | 724 ms (2.38) | 133 ms (0.49) | 1754 ms (4.10) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.23 ms | 0 / 0 / 0.19 ms | 0 / 0 / 1.91 ms | 0 / 0 / 2.61 ms | 0 / 0 / 1.11 ms | 0 / 0 / 2.44 ms | 0 / 0 / 0.90 ms |
| chat-5k · frame | 0 / 0 / 0.23 ms | 0 / 0 / 0.28 ms | 0 / 0 / 1.53 ms | 0 / 0 / 2.52 ms | 0 / 0 / 0.24 ms | 0 / 0 / 2.56 ms | 0 / 0 / 0.31 ms |
| answer-20k · token | 0 / 0 / 1.17 ms | 0 / 0 / 1.58 ms | 0 / 0 / 2.16 ms | 0 / 0 / 7.44 ms | 0 / 0 / 1.12 ms | 0 / 0 / 2.23 ms | 0 / 0 / 1.54 ms |
| answer-20k · frame | 0 / 0 / 1.24 ms | 0 / 0 / 1.83 ms | 0 / 0 / 2.66 ms | 0 / 0 / 6.99 ms | 0 / 0 / 1.32 ms | 0 / 0 / 2.66 ms | 0 / 0 / 1.23 ms |
| answer-20k · line | 0 / 0 / 0.26 ms | 0 / 0 / 2.56 ms | 0 / 0 / 2.17 ms | 0 / 0 / 7.40 ms | 0 / 0 / 1.81 ms | 0 / 0 / 2.60 ms | 0 / 0 / 1.38 ms |
| forms-20k · frame | 0 / 0 / 1.73 ms | 0 / 0 / 2.47 ms | 0 / 0 / 2.43 ms | 0 / 0 / 8.46 ms | 0 / 0 / 1.48 ms | 0 / 0 / 2.62 ms | 0 / 0 / 1.62 ms |
| math-20k · frame | 0 / 0 / 1.43 ms | 0 / 0 / 1.54 ms | 0 / 0 / 2.39 ms | 0 / 0 / 8.48 ms | 0 / 0 / 1.58 ms | 0 / 0 / 3.03 ms | 0 / 0 / 1.72 ms |
| code-50k · token | 0 / 0 / 1.56 ms | 1 / 0 / 16.9 ms | 0 / 0 / 11.7 ms | 0 / 0 / 4.72 ms | 0 / 0 / 0.83 ms | 0 / 0 / 4.16 ms | 0 / 0 / 0.88 ms |
| code-50k · frame | 0 / 0 / 1.59 ms | 1 / 0 / 18.3 ms | 0 / 0 / 10.3 ms | 0 / 0 / 4.74 ms | 0 / 0 / 0.78 ms | 0 / 0 / 2.37 ms | 0 / 0 / 0.27 ms |
| table-20k · frame | 0 / 0 / 1.63 ms | 0 / 0 / 1.52 ms | 0 / 0 / 11.4 ms | 0 / 0 / 9.81 ms | 0 / 0 / 1.14 ms | 0 / 0 / 4.14 ms | 0 / 0 / 1.40 ms |
| long-100k · frame | 0 / 0 / 1.48 ms | 0 / 0 / 3.33 ms | 0 / 0 / 5.36 ms | 348 / 0 / 47.6 ms | 0 / 0 / 4.21 ms | 0 / 0 / 13.6 ms | 0 / 0 / 5.78 ms |
| crlf-20k · frame | 0 / 0 / 1.30 ms | 0 / 0 / 1.53 ms | 0 / 0 / 2.13 ms | 0 / 0 / 7.42 ms | 0 / 0 / 2.03 ms | 0 / 0 / 2.36 ms | 0 / 0 / 1.13 ms |
| footnotes-20k · frame | 0 / 0 / 2.54 ms | 0 / 0 / 4.55 ms | 0 / 0 / 11.8 ms | 0 / 0 / 8.15 ms | 0 / 0 / 1.90 ms | 0 / 0 / 3.03 ms | 0 / 0 / 1.68 ms |
| thread-30 · frame | 0 / 0 / 1.29 ms | 0 / 0 / 2.04 ms | 0 / 0 / 2.41 ms | 515 / 14 / 84.0 ms | 0 / 0 / 4.66 ms | 0 / 0 / 3.83 ms | 0 / 0 / 5.56 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.8 / 0.9 / 0.5 | 0.8 / 0.9 / 0.5 | 1.1 / 1.4 / -0.4 | 0.7 / 1.0 / 0.5 | 0.6 / 1.1 / 0.2 | 4.3 / 4.1 / 0.3 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.8 / 0.2 / 0.2 | 0.8 / 0.2 / 0.2 | 1.0 / 0.9 / 0.2 | 0.7 / 0.4 / 0.1 | 0.8 / 0.2 / 0.4 | 4.0 / 1.0 / 0.3 | 0.5 / 0.1 / 0.1 |
| answer-20k · token | 4.2 / 2.0 / 0.3 | 5.0 / 3.4 / 0.3 | 5.9 / 5.1 / -4.2 | 1.7 / 2.4 / -1.2 | 2.7 / 1.7 / 0.2 | 13.6 / 5.8 / 0.6 | 1.7 / 1.2 / -0.9 |
| answer-20k · frame | 4.0 / 1.4 / 0.2 | 4.9 / 2.5 / 0.2 | 5.7 / 2.6 / 0.4 | 1.7 / 0.8 / 0.2 | 2.6 / 0.6 / 0.2 | 10.6 / 0.6 / 0.4 | 1.6 / 0.2 / 0.0 |
| answer-20k · line | 3.7 / 0.6 / 0.3 | 4.5 / 1.0 / 0.3 | 5.9 / 1.0 / 0.2 | 1.8 / 0.4 / 0.2 | 1.6 / -0.5 / -1.6 | 10.1 / 1.2 / 0.3 | 1.7 / 0.4 / -0.9 |
| forms-20k · frame | 8.5 / 1.3 / 0.2 | 10.3 / 1.3 / 0.2 | 9.9 / 1.8 / 0.2 | 2.3 / 0.5 / -1.5 | 3.0 / 0.5 / 0.1 | 12.6 / 2.2 / 0.5 | 2.0 / 0.6 / -1.3 |
| math-20k · frame | 4.0 / 1.1 / 0.1 | 5.4 / 1.4 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.4 | 3.6 / 1.3 / -2.4 | 12.6 / 3.7 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.7 / 1.0 / 0.3 | 15.5 / 1.1 / 0.3 | 10.2 / 0.1 / -0.2 | 0.5 / 0.9 / -1.2 | 0.4 / 0.7 / 0.3 | 1.5 / 2.4 / -1.1 | 0.4 / 0.6 / 0.2 |
| code-50k · frame | 0.5 / 0.7 / -0.0 | 15.8 / 0.9 / 0.1 | 10.4 / 0.3 / -1.4 | 0.3 / 0.7 / 0.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.5 / 0.7 / 0.1 | 3.5 / 0.7 / 0.1 | 7.0 / 1.1 / 0.1 | 3.4 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.4 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 36.0 / 1.4 / 0.2 | 41.4 / 1.1 / 0.2 | 27.2 / 2.6 / -1.3 | 4.9 / 0.2 / -0.4 | 32.4 / 1.5 / 0.2 | 56.6 / 7.3 / -0.8 | 8.0 / 1.1 / -1.2 |
| crlf-20k · frame | 3.3 / 0.7 / -1.5 | 4.5 / 1.1 / 0.2 | 5.8 / 1.8 / 0.2 | 1.5 / 1.0 / 0.2 | 2.5 / 0.8 / 0.2 | 9.1 / 2.4 / 0.4 | 2.0 / 0.4 / 0.1 |
| footnotes-20k · frame | 2.5 / 0.6 / 0.2 | 3.8 / 1.8 / 0.2 | 6.0 / 2.4 / 0.3 | 2.2 / 1.2 / -1.3 | 2.4 / 1.2 / 0.1 | 11.3 / 4.7 / 0.6 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.6 / 0.6 / 0.2 | 18.6 / 0.6 / 0.2 | 29.1 / 1.1 / 0.2 | 9.1 / -1.1 / -0.0 | 11.2 / 0.4 / 0.1 | 57.2 / 1.7 / 0.4 | 10.0 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 18.4 ms | 71.7 ms | 3.9× (n^0.98) |
| `llx+highlight` | 21.2 ms | 176 ms | 8.3× (n^1.53) |
| `streamdown` | 148 ms | 750 ms | 5.1× (n^1.17) |
| `react-markdown` | 822 ms | 10859 ms | 13.2× (n^1.86) |
| `markdown-to-jsx` | 45.2 ms | 370 ms | 8.2× (n^1.52) |
| `markstream` | 125 ms | 973 ms | 7.8× (n^1.48) |
| `marked-react` | 93.1 ms | 1037 ms | 11.1× (n^1.74) |
