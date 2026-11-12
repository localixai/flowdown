# Benchmark results

- **date:** 2026-11-12T17:16:46.565Z
- **label:** after-continues
- **commit:** 702280f
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

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 24.0 ms (0.03) | 23.8 ms (0.03) | 168 ms (0.25) | 871 ms (1.52) | 45.2 ms (0.05) | 124 ms (0.16) | 130 ms (0.19) |
| chat-5k · frame | 13.3 ms (0.09) | 13.5 ms (0.09) | 59.4 ms (0.39) | 208 ms (1.61) | 18.5 ms (0.11) | 41.5 ms (0.23) | 38.8 ms (0.23) |
| answer-20k · token | 85.9 ms (0.04) | 300 ms (0.31) | 1087 ms (0.47) | 12068 ms (5.18) | 466 ms (0.17) | 1234 ms (0.61) | 1199 ms (0.48) |
| answer-20k · frame | 31.9 ms (0.08) | 87.5 ms (0.36) | 285 ms (0.56) | 2752 ms (5.23) | 126 ms (0.17) | 324 ms (0.72) | 289 ms (0.49) |
| answer-20k · line | 18.7 ms (0.12) | 49.8 ms (0.46) | 101 ms (0.56) | 997 ms (5.08) | 51.3 ms (0.24) | 128 ms (0.79) | 108 ms (0.47) |
| forms-20k · frame | 75.5 ms (0.16) | 178 ms (0.37) | 658 ms (1.18) | 3637 ms (6.93) | 138 ms (0.20) | 367 ms (0.82) | 459 ms (0.78) |
| math-20k · frame | 27.3 ms (0.06) | 70.0 ms (0.26) | 314 ms (0.62) | 2859 ms (6.25) | 120 ms (0.21) | 270 ms (0.53) | 313 ms (0.61) |
| code-50k · token | 155 ms (0.02) | 3211 ms (0.54) | 20673 ms (3.71) | 12718 ms (2.32) | 222 ms (0.04) | 4080 ms (0.67) | 309 ms (0.05) |
| code-50k · frame | 49.7 ms (0.02) | 735 ms (0.53) | 4881 ms (3.79) | 2803 ms (2.27) | 67.2 ms (0.04) | 919 ms (0.66) | 81.1 ms (0.05) |
| table-20k · frame | 25.4 ms (0.10) | 25.2 ms (0.10) | 3786 ms (8.40) | 3114 ms (6.79) | 163 ms (0.31) | 838 ms (1.90) | 259 ms (0.51) |
| long-100k · frame | 140 ms (0.05) | 416 ms (0.33) | 6113 ms (2.31) | stopped at 68% | 2375 ms (0.97) | 5442 ms (2.27) | 7072 ms (2.95) |
| crlf-20k · frame | 35.9 ms (0.06) | 101 ms (0.30) | 315 ms (0.58) | 2614 ms (4.84) | 121 ms (0.19) | 249 ms (0.52) | 281 ms (0.49) |
| footnotes-20k · frame | 47.0 ms (0.09) | 86.5 ms (0.32) | 364 ms (0.69) | 2870 ms (5.80) | 119 ms (0.20) | 280 ms (0.42) | 365 ms (0.63) |
| thread-30 · frame | 40.4 ms (0.11) | 82.0 ms (0.39) | 130 ms (0.56) | 15125 ms (31.7) | 576 ms (1.82) | 129 ms (0.51) | 1720 ms (4.06) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.17 ms | 0 / 0 / 0.16 ms | 0 / 0 / 1.85 ms | 0 / 0 / 2.41 ms | 0 / 0 / 1.26 ms | 0 / 0 / 2.30 ms | 0 / 0 / 0.95 ms |
| chat-5k · frame | 0 / 0 / 0.22 ms | 0 / 0 / 0.23 ms | 0 / 0 / 2.17 ms | 0 / 0 / 2.59 ms | 0 / 0 / 0.19 ms | 0 / 0 / 2.55 ms | 0 / 0 / 0.26 ms |
| answer-20k · token | 0 / 0 / 1.69 ms | 0 / 0 / 1.87 ms | 0 / 0 / 1.76 ms | 1 / 0 / 17.0 ms | 0 / 0 / 1.47 ms | 0 / 0 / 2.62 ms | 0 / 0 / 1.28 ms |
| answer-20k · frame | 0 / 0 / 0.28 ms | 0 / 0 / 1.91 ms | 0 / 0 / 2.32 ms | 0 / 0 / 7.35 ms | 0 / 0 / 1.54 ms | 0 / 0 / 2.60 ms | 0 / 0 / 1.58 ms |
| answer-20k · line | 0 / 0 / 0.24 ms | 0 / 0 / 2.30 ms | 0 / 0 / 2.29 ms | 0 / 0 / 6.70 ms | 0 / 0 / 1.51 ms | 0 / 0 / 2.59 ms | 0 / 0 / 1.25 ms |
| forms-20k · frame | 0 / 0 / 1.73 ms | 0 / 0 / 1.68 ms | 0 / 0 / 2.15 ms | 0 / 0 / 9.19 ms | 0 / 0 / 1.19 ms | 0 / 0 / 3.03 ms | 0 / 0 / 1.57 ms |
| math-20k · frame | 0 / 0 / 0.40 ms | 0 / 0 / 1.92 ms | 0 / 0 / 2.09 ms | 0 / 0 / 8.68 ms | 0 / 0 / 1.36 ms | 0 / 0 / 2.50 ms | 0 / 0 / 1.60 ms |
| code-50k · token | 0 / 0 / 1.12 ms | 1 / 0 / 17.1 ms | 1 / 0 / 18.6 ms | 0 / 0 / 16.4 ms | 0 / 0 / 1.09 ms | 0 / 0 / 8.70 ms | 0 / 0 / 0.63 ms |
| code-50k · frame | 0 / 0 / 1.25 ms | 1 / 0 / 18.4 ms | 0 / 0 / 11.6 ms | 0 / 0 / 4.55 ms | 0 / 0 / 0.89 ms | 0 / 0 / 2.33 ms | 0 / 0 / 0.29 ms |
| table-20k · frame | 0 / 0 / 0.29 ms | 0 / 0 / 0.27 ms | 0 / 0 / 11.9 ms | 0 / 0 / 9.52 ms | 0 / 0 / 1.16 ms | 0 / 0 / 4.66 ms | 0 / 0 / 2.04 ms |
| long-100k · frame | 0 / 0 / 1.44 ms | 0 / 0 / 1.88 ms | 0 / 0 / 7.54 ms | 337 / 0 / 41.3 ms | 0 / 0 / 4.48 ms | 0 / 0 / 9.53 ms | 0 / 0 / 7.48 ms |
| crlf-20k · frame | 0 / 0 / 1.82 ms | 0 / 0 / 1.68 ms | 0 / 0 / 2.01 ms | 0 / 0 / 6.92 ms | 0 / 0 / 1.88 ms | 0 / 0 / 2.57 ms | 0 / 0 / 1.31 ms |
| footnotes-20k · frame | 0 / 0 / 3.86 ms | 0 / 0 / 4.57 ms | 0 / 0 / 15.6 ms | 0 / 0 / 8.53 ms | 0 / 0 / 2.63 ms | 0 / 0 / 2.56 ms | 0 / 0 / 1.64 ms |
| thread-30 · frame | 0 / 0 / 1.35 ms | 0 / 0 / 2.07 ms | 0 / 0 / 2.16 ms | 515 / 1 / 51.1 ms | 0 / 0 / 3.15 ms | 0 / 0 / 3.62 ms | 0 / 0 / 5.01 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.0 / 0.5 | 0.7 / 1.0 / 0.5 | 1.2 / 1.5 / -0.4 | 0.7 / 1.0 / 0.5 | 0.6 / 1.1 / 0.2 | 4.3 / 4.4 / 0.3 | 0.5 / 0.8 / 0.1 |
| chat-5k · frame | 0.7 / 0.5 / 0.3 | 0.7 / 0.5 / 0.2 | 1.1 / 0.5 / 0.2 | 0.7 / 0.4 / 0.1 | 0.7 / 0.2 / 0.3 | 4.0 / 1.0 / 0.3 | 0.6 / 0.3 / 0.1 |
| answer-20k · token | 3.1 / 2.2 / 0.3 | 5.7 / 3.7 / 0.3 | 5.9 / 5.1 / -4.2 | 1.7 / 2.4 / -1.3 | 2.7 / 1.7 / 0.2 | 13.6 / 5.8 / 0.6 | 1.7 / 1.2 / 0.2 |
| answer-20k · frame | 3.0 / 1.4 / 0.2 | 5.7 / 2.7 / 0.2 | 5.7 / 2.6 / 0.4 | 1.7 / 0.8 / 0.2 | 2.6 / 0.4 / 0.1 | 10.6 / 3.2 / 0.4 | 1.6 / 0.3 / 0.1 |
| answer-20k · line | 3.2 / 0.7 / 0.2 | 5.7 / 0.7 / 0.2 | 5.9 / 0.9 / 0.2 | 1.9 / 0.4 / -1.0 | 1.6 / -0.6 / -1.4 | 10.0 / 1.2 / 0.4 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.3 / 1.3 / 0.2 | 11.0 / 1.6 / 0.2 | 9.9 / 1.8 / 0.2 | 2.3 / 0.5 / -1.5 | 3.0 / 0.5 / 0.1 | 12.7 / 2.2 / 0.5 | 2.0 / 0.3 / -1.3 |
| math-20k · frame | 3.3 / 1.5 / 0.2 | 5.1 / 0.9 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.4 | 3.6 / 1.2 / -2.4 | 12.9 / 3.7 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.8 / 1.1 / 0.4 | 15.5 / 1.2 / 0.5 | 10.0 / -0.1 / -0.2 | 0.5 / 0.9 / -1.4 | 0.4 / 0.7 / 0.3 | 1.6 / 2.4 / 0.2 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.5 / 0.8 / 0.2 | 15.3 / 0.8 / 0.1 | 10.4 / 0.3 / -1.5 | 0.3 / 0.7 / 0.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.8 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.6 / 0.7 / 0.1 | 3.6 / 0.7 / 0.1 | 7.0 / 1.1 / 0.1 | 3.4 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 12.8 / 1.5 / 0.3 | 24.2 / 2.0 / 0.3 | 27.2 / 2.6 / -1.5 | 5.3 / 0.1 / -0.4 | 32.5 / 1.6 / 0.1 | 56.6 / 7.3 / -0.9 | 8.2 / 1.2 / -1.4 |
| crlf-20k · frame | 3.5 / 0.7 / -1.4 | 5.9 / 1.5 / 0.2 | 5.8 / 1.8 / 0.2 | 1.5 / 0.7 / 0.2 | 2.5 / 0.5 / 0.2 | 9.1 / 2.3 / 0.3 | 1.9 / 0.7 / 0.1 |
| footnotes-20k · frame | 2.6 / 0.7 / 0.2 | 4.5 / 0.9 / 0.2 | 6.0 / 2.5 / 0.3 | 2.2 / 1.2 / -1.3 | 2.4 / 1.2 / 0.2 | 11.7 / 4.6 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.4 / 0.7 / 0.2 | 22.9 / 0.8 / -21.1 | 29.2 / 1.1 / 0.3 | 9.1 / -1.3 / -0.0 | 10.3 / 0.4 / 0.1 | 57.4 / 1.7 / 0.4 | 9.9 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `flowdown` | 18.7 ms | 51.5 ms | 2.8× (n^0.73) |
| `flowdown+highlight` | 43.6 ms | 188 ms | 4.3× (n^1.05) |
| `streamdown` | 136 ms | 761 ms | 5.6× (n^1.24) |
| `react-markdown` | 835 ms | 10269 ms | 12.3× (n^1.81) |
| `markdown-to-jsx` | 48.9 ms | 372 ms | 7.6× (n^1.46) |
| `markstream` | 125 ms | 974 ms | 7.8× (n^1.48) |
| `marked-react` | 93.8 ms | 1022 ms | 10.9× (n^1.72) |
