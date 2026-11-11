# Benchmark results

- **date:** 2026-11-11T03:51:10.141Z
- **label:** 0.4.1
- **commit:** ad88e30
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **passes:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** llx 0.4.1, llx+highlight 0.4.1, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 22.1 ms (0.03) | 24.1 ms (0.04) | 170 ms (0.25) | 882 ms (1.55) | 52.4 ms (0.09) | 130 ms (0.18) | 134 ms (0.20) |
| chat-5k · frame | 9.25 ms (0.07) | 11.6 ms (0.09) | 54.6 ms (0.34) | 202 ms (1.61) | 15.8 ms (0.10) | 43.0 ms (0.29) | 40.3 ms (0.24) |
| answer-20k · token | 86.9 ms (0.03) | 296 ms (0.30) | 1102 ms (0.48) | 12569 ms (5.41) | 479 ms (0.17) | 1314 ms (0.64) | 1234 ms (0.49) |
| answer-20k · frame | 34.4 ms (0.09) | 88.1 ms (0.36) | 285 ms (0.57) | 3297 ms (6.45) | 128 ms (0.19) | 330 ms (0.73) | 315 ms (0.54) |
| answer-20k · line | 16.2 ms (0.10) | 48.3 ms (0.46) | 110 ms (0.59) | 1048 ms (5.51) | 53.3 ms (0.27) | 135 ms (0.84) | 108 ms (0.50) |
| forms-20k · frame | 67.3 ms (0.15) | 189 ms (0.44) | 676 ms (1.23) | 4256 ms (7.72) | 152 ms (0.23) | 390 ms (0.95) | 565 ms (0.95) |
| math-20k · frame | 31.5 ms (0.06) | 72.1 ms (0.26) | 362 ms (0.67) | 3160 ms (6.73) | 128 ms (0.24) | 301 ms (0.72) | 323 ms (0.66) |
| code-50k · token | 125 ms (0.01) | 3506 ms (0.61) | 23183 ms (4.03) | 13479 ms (2.49) | 246 ms (0.04) | 4166 ms (0.67) | 311 ms (0.05) |
| code-50k · frame | 36.1 ms (0.02) | 810 ms (0.60) | 5379 ms (4.26) | 2955 ms (2.37) | 59.3 ms (0.03) | 932 ms (0.67) | 77.2 ms (0.05) |
| table-20k · frame | 30.5 ms (0.10) | 30.7 ms (0.10) | 3955 ms (8.73) | 3190 ms (7.08) | 176 ms (0.34) | 876 ms (2.02) | 262 ms (0.53) |
| long-100k · frame | 240 ms (0.09) | 483 ms (0.31) | 6022 ms (2.32) | stopped at 68% | 2300 ms (0.94) | 5657 ms (2.39) | 7266 ms (3.03) |
| crlf-20k · frame | 35.2 ms (0.07) | 103 ms (0.31) | 308 ms (0.55) | 2559 ms (4.90) | 113 ms (0.17) | 246 ms (0.53) | 268 ms (0.46) |
| footnotes-20k · frame | 32.4 ms (0.06) | 83.9 ms (0.31) | 323 ms (0.64) | 3009 ms (6.06) | 116 ms (0.20) | 286 ms (0.46) | 370 ms (0.65) |
| thread-30 · frame | 65.6 ms (0.18) | 111 ms (0.48) | 127 ms (0.53) | 15882 ms (35.1) | 601 ms (1.84) | 147 ms (0.60) | 1773 ms (4.25) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.14 ms | 0 / 0 / 0.16 ms | 0 / 0 / 1.74 ms | 0 / 0 / 2.88 ms | 0 / 0 / 1.47 ms | 0 / 0 / 2.37 ms | 0 / 0 / 0.96 ms |
| chat-5k · frame | 0 / 0 / 0.16 ms | 0 / 0 / 0.21 ms | 0 / 0 / 1.93 ms | 0 / 0 / 2.42 ms | 0 / 0 / 0.20 ms | 0 / 0 / 2.81 ms | 0 / 0 / 0.43 ms |
| answer-20k · token | 0 / 0 / 1.38 ms | 0 / 0 / 1.42 ms | 0 / 0 / 1.79 ms | 0 / 0 / 13.9 ms | 0 / 0 / 1.46 ms | 0 / 0 / 3.68 ms | 0 / 0 / 4.08 ms |
| answer-20k · frame | 0 / 0 / 1.54 ms | 0 / 0 / 1.86 ms | 0 / 0 / 2.34 ms | 0 / 0 / 9.30 ms | 0 / 0 / 1.35 ms | 0 / 0 / 2.60 ms | 0 / 0 / 1.80 ms |
| answer-20k · line | 0 / 0 / 0.29 ms | 0 / 0 / 2.00 ms | 0 / 0 / 2.59 ms | 0 / 0 / 7.12 ms | 0 / 0 / 1.57 ms | 0 / 0 / 3.36 ms | 0 / 0 / 1.47 ms |
| forms-20k · frame | 0 / 0 / 1.58 ms | 0 / 0 / 2.57 ms | 0 / 0 / 2.39 ms | 0 / 0 / 12.5 ms | 0 / 0 / 2.09 ms | 0 / 0 / 3.30 ms | 0 / 0 / 6.77 ms |
| math-20k · frame | 0 / 0 / 1.77 ms | 0 / 0 / 1.73 ms | 0 / 0 / 2.76 ms | 0 / 0 / 9.22 ms | 0 / 0 / 1.51 ms | 0 / 0 / 3.58 ms | 0 / 0 / 1.68 ms |
| code-50k · token | 0 / 0 / 1.74 ms | 1 / 0 / 20.1 ms | 0 / 0 / 12.4 ms | 0 / 0 / 15.3 ms | 0 / 0 / 1.54 ms | 0 / 0 / 6.48 ms | 0 / 0 / 0.68 ms |
| code-50k · frame | 0 / 0 / 1.23 ms | 1 / 0 / 19.2 ms | 0 / 0 / 9.44 ms | 0 / 0 / 4.92 ms | 0 / 0 / 0.83 ms | 0 / 0 / 2.17 ms | 0 / 0 / 0.28 ms |
| table-20k · frame | 0 / 0 / 1.53 ms | 0 / 0 / 1.68 ms | 0 / 0 / 12.0 ms | 0 / 0 / 9.64 ms | 0 / 0 / 1.71 ms | 0 / 0 / 5.80 ms | 0 / 0 / 1.61 ms |
| long-100k · frame | 0 / 0 / 1.60 ms | 0 / 0 / 1.89 ms | 0 / 0 / 5.46 ms | 382 / 1 / 51.7 ms | 0 / 0 / 3.78 ms | 0 / 0 / 11.2 ms | 0 / 0 / 14.1 ms |
| crlf-20k · frame | 0 / 0 / 1.35 ms | 0 / 0 / 1.72 ms | 0 / 0 / 2.15 ms | 0 / 0 / 7.36 ms | 0 / 0 / 1.67 ms | 0 / 0 / 2.18 ms | 0 / 0 / 1.31 ms |
| footnotes-20k · frame | 0 / 0 / 2.52 ms | 0 / 0 / 4.09 ms | 0 / 0 / 12.4 ms | 0 / 0 / 10.5 ms | 0 / 0 / 1.98 ms | 0 / 0 / 2.64 ms | 0 / 0 / 2.25 ms |
| thread-30 · frame | 0 / 0 / 1.51 ms | 0 / 0 / 1.96 ms | 0 / 0 / 1.96 ms | 515 / 1 / 63.3 ms | 0 / 0 / 3.24 ms | 0 / 0 / 4.51 ms | 0 / 0 / 6.20 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.0 / 0.5 | 0.7 / 1.0 / 0.5 | 1.2 / 1.4 / -0.4 | 0.7 / 1.0 / 0.5 | 0.6 / 1.0 / 0.2 | 4.4 / 4.4 / 0.3 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.7 / 0.5 / 0.2 | 0.7 / 0.2 / 0.2 | 1.0 / 0.5 / 0.2 | 0.7 / 0.4 / 0.1 | 0.7 / 0.2 / 0.3 | 4.0 / 1.0 / 0.3 | 0.6 / 0.3 / 0.1 |
| answer-20k · token | 3.1 / 2.1 / 0.2 | 5.7 / 3.5 / 0.2 | 5.8 / 5.1 / -4.2 | 1.8 / 2.4 / -1.4 | 2.7 / 1.7 / 0.2 | 13.7 / 5.8 / 0.6 | 1.7 / 1.2 / -0.9 |
| answer-20k · frame | 3.0 / 1.4 / 0.2 | 5.6 / 2.7 / 0.2 | 5.7 / 2.6 / 0.4 | 1.7 / 0.8 / 0.2 | 2.6 / 0.4 / 0.2 | 10.6 / 0.6 / 0.4 | 1.6 / 0.3 / 0.1 |
| answer-20k · line | 3.1 / 0.6 / 0.2 | 5.7 / 0.7 / 0.2 | 5.9 / 0.9 / 0.2 | 1.9 / 0.4 / -1.0 | 1.5 / -0.6 / -1.4 | 10.1 / 1.2 / 0.4 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.3 / 1.3 / 0.2 | 11.0 / 1.5 / 0.2 | 9.9 / 1.7 / 0.2 | 2.3 / 0.5 / -1.5 | 3.0 / 0.5 / -2.1 | 12.7 / 2.2 / 0.5 | 2.0 / 0.3 / -1.2 |
| math-20k · frame | 3.4 / 1.5 / 0.2 | 5.2 / 0.9 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.4 | 3.6 / 1.2 / -2.4 | 13.4 / 3.7 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.6 / 0.9 / 0.2 | 15.4 / 1.0 / 0.3 | 10.1 / -0.1 / -0.1 | 0.4 / 0.9 / -1.4 | 0.4 / 0.7 / 0.3 | 1.5 / 2.4 / 0.2 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.7 / 0.2 | 15.1 / 0.9 / 0.1 | 10.4 / 0.3 / -1.5 | 0.3 / 0.7 / 0.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.6 / 0.7 / 0.1 | 3.6 / 0.7 / 0.1 | 7.0 / 1.1 / 0.1 | 3.4 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 13.6 / 1.5 / 0.2 | 24.9 / 0.5 / 0.3 | 27.2 / 2.6 / -1.4 | 4.9 / 0.1 / -0.1 | 32.4 / 1.6 / 0.2 | 56.6 / 7.3 / -0.9 | 8.0 / 1.2 / -1.4 |
| crlf-20k · frame | 3.4 / 0.7 / 0.2 | 5.8 / 1.5 / 0.2 | 5.8 / 1.8 / 0.2 | 1.5 / 0.7 / 0.2 | 2.5 / 0.4 / 0.2 | 9.2 / 2.4 / 0.3 | 1.9 / 0.4 / 0.1 |
| footnotes-20k · frame | 2.6 / 0.7 / 0.2 | 4.5 / 0.8 / 0.2 | 6.0 / 2.4 / 0.3 | 2.2 / 1.1 / -1.3 | 2.3 / 1.2 / 0.2 | 11.7 / 4.7 / 0.6 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.7 / 0.7 / 0.2 | 23.1 / 0.7 / -20.9 | 29.1 / 1.1 / 0.3 | 9.1 / -1.3 / -0.1 | 10.3 / 0.5 / 0.0 | 57.2 / 1.7 / 0.4 | 9.2 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 19.7 ms | 62.3 ms | 3.2× (n^0.83) |
| `llx+highlight` | 44.2 ms | 208 ms | 4.7× (n^1.12) |
| `streamdown` | 137 ms | 770 ms | 5.6× (n^1.25) |
| `react-markdown` | 835 ms | 10636 ms | 12.7× (n^1.84) |
| `markdown-to-jsx` | 48.9 ms | 374 ms | 7.6× (n^1.47) |
| `markstream` | 126 ms | 979 ms | 7.8× (n^1.48) |
| `marked-react` | 94.9 ms | 1064 ms | 11.2× (n^1.74) |
