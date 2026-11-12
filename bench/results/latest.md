# Benchmark results

- **date:** 2026-11-12T17:44:42.368Z
- **label:** reference
- **commit:** ffec00c
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **passes:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** flowdown 0.5.0, flowdown+highlight 0.5.0, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0
- **kept from results/reference.json:** streamdown, react-markdown, markdown-to-jsx, markstream, marked-react: the mean of 5 to 7 full runs, 2026-11-09 to 2026-11-12

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 24.2 ms (0.03) | 23.4 ms (0.04) | 173 ms (0.27) | 908 ms (1.63) | 43.7 ms (0.06) | 129 ms (0.19) | 131 ms (0.20) |
| chat-5k · frame | 11.8 ms (0.09) | 12.1 ms (0.10) | 51.2 ms (0.34) | 213 ms (1.67) | 15.3 ms (0.09) | 41.2 ms (0.25) | 36.8 ms (0.23) |
| answer-20k · token | 81.8 ms (0.03) | 293 ms (0.30) | 1185 ms (0.52) | 13129 ms (5.64) | 476 ms (0.17) | 1285 ms (0.63) | 1239 ms (0.49) |
| answer-20k · frame | 29.2 ms (0.07) | 84.8 ms (0.34) | 291 ms (0.58) | 3002 ms (5.76) | 127 ms (0.19) | 331 ms (0.73) | 298 ms (0.51) |
| answer-20k · line | 17.3 ms (0.12) | 48.0 ms (0.44) | 108 ms (0.58) | 1057 ms (5.54) | 51.3 ms (0.25) | 136 ms (0.85) | 107 ms (0.49) |
| forms-20k · frame | 75.0 ms (0.15) | 181 ms (0.37) | 683 ms (1.24) | 3952 ms (7.50) | 144 ms (0.22) | 376 ms (0.86) | 496 ms (0.84) |
| math-20k · frame | 28.0 ms (0.07) | 68.0 ms (0.25) | 361 ms (0.75) | 3131 ms (6.83) | 131 ms (0.25) | 289 ms (0.60) | 320 ms (0.64) |
| code-50k · token | 159 ms (0.02) | 3257 ms (0.55) | 23639 ms (4.20) | 13900 ms (2.58) | 273 ms (0.05) | 4221 ms (0.69) | 314 ms (0.05) |
| code-50k · frame | 48.7 ms (0.02) | 749 ms (0.54) | 5926 ms (4.88) | 3808 ms (3.18) | 62.8 ms (0.04) | 1076 ms (0.79) | 80.3 ms (0.05) |
| table-20k · frame | 25.6 ms (0.10) | 25.0 ms (0.10) | 4248 ms (9.53) | 3473 ms (7.65) | 173 ms (0.33) | 908 ms (2.16) | 280 ms (0.58) |
| long-100k · frame | 138 ms (0.05) | 374 ms (0.30) | 6529 ms (2.54) | stopped at 65.85714285714286% | 2393 ms (0.98) | 5714 ms (2.41) | 7709 ms (3.11) |
| crlf-20k · frame | 35.1 ms (0.06) | 96.8 ms (0.30) | 326 ms (0.63) | 2716 ms (5.06) | 120 ms (0.20) | 255 ms (0.55) | 282 ms (0.48) |
| footnotes-20k · frame | 38.3 ms (0.08) | 81.4 ms (0.31) | 351 ms (0.68) | 3160 ms (6.36) | 121 ms (0.21) | 284 ms (0.45) | 371 ms (0.65) |
| thread-30 · frame | 40.9 ms (0.11) | 81.6 ms (0.41) | 137 ms (0.58) | 16506 ms (36.0) | 591 ms (1.87) | 133 ms (0.52) | 1765 ms (4.17) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.16 ms | 0 / 0 / 0.19 ms | 0 / 0 / 1.76 ms | 0 / 0 / 2.75 ms | 0 / 0 / 1.26 ms | 0 / 0 / 2.70 ms | 0 / 0 / 1.15 ms |
| chat-5k · frame | 0 / 0 / 0.20 ms | 0 / 0 / 0.23 ms | 0 / 0 / 1.78 ms | 0 / 0 / 2.68 ms | 0 / 0 / 0.18 ms | 0 / 0 / 2.46 ms | 0 / 0 / 0.33 ms |
| answer-20k · token | 0 / 0 / 1.46 ms | 0 / 0 / 1.55 ms | 0 / 0 / 2.24 ms | 2.4285714285714284 / 0.2857142857142857 / 32.4 ms | 0 / 0 / 1.53 ms | 0 / 0 / 3.16 ms | 0 / 0 / 2.39 ms |
| answer-20k · frame | 0 / 0 / 0.35 ms | 0 / 0 / 2.19 ms | 0 / 0 / 2.28 ms | 0 / 0 / 8.64 ms | 0 / 0 / 1.68 ms | 0 / 0 / 2.40 ms | 0 / 0 / 1.51 ms |
| answer-20k · line | 0 / 0 / 0.25 ms | 0 / 0 / 2.46 ms | 0 / 0 / 2.41 ms | 0 / 0 / 7.28 ms | 0 / 0 / 1.59 ms | 0 / 0 / 3.13 ms | 0 / 0 / 1.39 ms |
| forms-20k · frame | 0 / 0 / 1.78 ms | 0 / 0 / 1.70 ms | 0 / 0 / 2.54 ms | 0 / 0 / 10.8 ms | 0 / 0 / 1.52 ms | 0 / 0 / 3.01 ms | 0 / 0 / 2.73 ms |
| math-20k · frame | 0 / 0 / 0.38 ms | 0 / 0 / 2.38 ms | 0 / 0 / 3.49 ms | 0 / 0 / 10.2 ms | 0 / 0 / 1.59 ms | 0 / 0 / 3.18 ms | 0 / 0 / 1.95 ms |
| code-50k · token | 0 / 0 / 1.16 ms | 1 / 0 / 17.8 ms | 4.571428571428571 / 1 / 48.6 ms | 2.2857142857142856 / 0.14285714285714285 / 25.2 ms | 0 / 0 / 1.49 ms | 0 / 0 / 6.46 ms | 0 / 0 / 0.67 ms |
| code-50k · frame | 0 / 0 / 1.30 ms | 1 / 0 / 17.6 ms | 4.285714285714286 / 0.42857142857142855 / 36.5 ms | 5.142857142857143 / 1.1428571428571428 / 73.7 ms | 0 / 0 / 0.92 ms | 0.2 / 0 / 5.44 ms | 0 / 0 / 0.28 ms |
| table-20k · frame | 0 / 0 / 0.26 ms | 0 / 0 / 0.27 ms | 1.2857142857142858 / 0 / 14.7 ms | 0.42857142857142855 / 0 / 14.2 ms | 0 / 0 / 1.44 ms | 0 / 0 / 5.50 ms | 0 / 0 / 1.67 ms |
| long-100k · frame | 0 / 0 / 1.47 ms | 0 / 0 / 1.93 ms | 0 / 0 / 8.14 ms | 388.14285714285717 / 3.2857142857142856 / 61.7 ms | 0 / 0 / 3.99 ms | 0.2 / 0 / 12.7 ms | 0.6 / 0.4 / 73.1 ms |
| crlf-20k · frame | 0 / 0 / 1.65 ms | 0 / 0 / 1.63 ms | 0 / 0 / 2.24 ms | 0 / 0 / 7.92 ms | 0 / 0 / 1.65 ms | 0 / 0 / 2.41 ms | 0 / 0 / 1.38 ms |
| footnotes-20k · frame | 0 / 0 / 2.56 ms | 0 / 0 / 4.10 ms | 0 / 0 / 14.0 ms | 0.14285714285714285 / 0 / 10.6 ms | 0 / 0 / 2.22 ms | 0 / 0 / 3.00 ms | 0 / 0 / 1.83 ms |
| thread-30 · frame | 0 / 0 / 1.90 ms | 0 / 0 / 1.96 ms | 0 / 0 / 2.12 ms | 515 / 2.4285714285714284 / 56.8 ms | 0 / 0 / 3.22 ms | 0 / 0 / 3.92 ms | 0 / 0 / 5.85 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.0 / 0.5 | 0.7 / 1.0 / 0.5 | 1.1 / 1.3 / 0.0 | 0.7 / 1.0 / 0.0 | 0.6 / 1.1 / 0.1 | 4.4 / 4.4 / 0.8 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.7 / 0.5 / 0.2 | 0.7 / 0.2 / 0.3 | 1.0 / 0.6 / 0.0 | 0.7 / 0.4 / 0.0 | 0.7 / 0.2 / 0.3 | 4.0 / 1.0 / 0.3 | 0.5 / 0.2 / 0.1 |
| answer-20k · token | 3.1 / 2.2 / 0.3 | 5.7 / 3.7 / 0.3 | 5.8 / 5.1 / 0.0 | 1.7 / 2.2 / 0.0 | 2.7 / 1.7 / 0.2 | 13.7 / 5.8 / 0.6 | 1.7 / 1.2 / -0.7 |
| answer-20k · frame | 3.0 / 1.4 / 0.2 | 5.6 / 2.8 / 0.2 | 5.7 / 2.9 / 0.0 | 1.9 / 1.1 / 0.0 | 2.6 / 0.4 / 0.2 | 10.6 / 2.1 / 0.4 | 1.6 / 0.2 / 0.1 |
| answer-20k · line | 3.2 / 0.7 / 0.2 | 5.7 / 0.7 / 0.2 | 5.8 / 1.5 / 0.0 | 1.8 / 0.5 / 0.0 | 1.9 / -0.6 / -0.8 | 10.1 / 1.3 / 0.4 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.4 / 1.3 / 0.3 | 11.0 / 1.6 / 0.2 | 9.9 / 2.7 / 0.0 | 2.3 / 0.7 / 0.0 | 3.0 / 0.5 / -0.3 | 12.7 / 2.2 / 0.5 | 2.0 / 0.4 / -1.3 |
| math-20k · frame | 3.3 / 1.5 / 0.2 | 5.0 / 0.9 / 0.2 | 7.1 / 3.2 / 0.0 | 2.4 / 1.9 / 0.0 | 3.6 / 1.2 / -2.4 | 13.0 / 3.4 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.7 / 1.1 / 0.4 | 15.6 / 1.1 / 0.4 | 12.0 / 0.1 / 0.0 | 0.5 / 0.7 / 0.0 | 0.4 / 0.7 / 0.3 | 1.5 / 2.4 / -0.1 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.8 / 0.2 | 15.3 / 0.8 / 0.1 | 10.4 / 1.7 / 0.0 | 0.3 / 0.6 / 0.0 | 0.3 / 0.6 / 0.1 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.6 / 0.7 / 0.1 | 3.6 / 0.7 / 0.1 | 6.9 / 1.8 / 0.0 | 3.4 / 1.0 / 0.0 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 12.8 / 1.5 / 0.3 | 24.2 / 0.5 / 0.3 | 27.1 / 5.6 / 0.0 | 5.0 / 0.2 / 0.0 | 32.5 / 1.6 / 0.1 | 56.6 / 7.3 / -0.9 | 8.1 / 1.2 / -1.2 |
| crlf-20k · frame | 3.5 / 0.7 / -1.4 | 5.9 / 1.5 / 0.2 | 5.8 / 1.9 / 0.0 | 1.5 / 0.8 / 0.0 | 2.5 / 0.4 / 0.2 | 9.2 / 2.4 / 0.4 | 1.9 / 0.6 / 0.1 |
| footnotes-20k · frame | 2.6 / 0.7 / 0.2 | 4.6 / 0.9 / 0.2 | 6.0 / 2.8 / 0.0 | 2.1 / 1.3 / 0.0 | 2.3 / 1.2 / 0.2 | 11.6 / 4.6 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.4 / 0.7 / 0.2 | 22.9 / 0.8 / -21.1 | 29.1 / 4.3 / 0.0 | 9.0 / -0.1 / 0.0 | 10.4 / 0.4 / 0.1 | 57.3 / 1.7 / 0.4 | 9.6 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `flowdown` | 17.7 ms | 52.3 ms | 3.0× (n^0.78) |
| `flowdown+highlight` | 42.6 ms | 184 ms | 4.3× (n^1.06) |
| `streamdown` | 136 ms | 837 ms | 6.2× (n^1.31) |
| `react-markdown` | 897 ms | 11683 ms | 13.0× (n^1.85) |
| `markdown-to-jsx` | 47.1 ms | 370 ms | 7.8× (n^1.49) |
| `markstream` | 129 ms | 1002 ms | 7.7× (n^1.48) |
| `marked-react` | 91.7 ms | 1047 ms | 11.4× (n^1.76) |
