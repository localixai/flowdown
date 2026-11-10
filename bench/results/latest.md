# Benchmark results

- **date:** 2026-11-10T19:43:47.068Z
- **label:** local
- **commit:** d4cbdde
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** llx 0.3.0, llx+highlight 0.3.0, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 26.1 ms (0.04) | 27.2 ms (0.04) | 168 ms (0.25) | 858 ms (1.51) | 45.0 ms (0.05) | 125 ms (0.15) | 135 ms (0.20) |
| chat-5k · frame | 15.2 ms (0.11) | 15.4 ms (0.11) | 53.9 ms (0.36) | 207 ms (1.50) | 16.6 ms (0.10) | 43.3 ms (0.24) | 35.0 ms (0.21) |
| answer-20k · token | 91.1 ms (0.03) | 182 ms (0.20) | 1071 ms (0.46) | 11862 ms (5.10) | 475 ms (0.18) | 1236 ms (0.62) | 1206 ms (0.48) |
| answer-20k · frame | 36.1 ms (0.08) | 64.3 ms (0.29) | 286 ms (0.56) | 2736 ms (5.22) | 122 ms (0.18) | 317 ms (0.69) | 289 ms (0.48) |
| answer-20k · line | 21.1 ms (0.16) | 35.8 ms (0.43) | 103 ms (0.57) | 989 ms (5.12) | 51.5 ms (0.24) | 135 ms (0.76) | 109 ms (0.48) |
| forms-20k · frame | 72.1 ms (0.16) | 152 ms (0.31) | 658 ms (1.18) | 3601 ms (6.88) | 142 ms (0.20) | 356 ms (0.78) | 483 ms (0.79) |
| math-20k · frame | 35.4 ms (0.07) | 65.7 ms (0.28) | 312 ms (0.62) | 2807 ms (6.07) | 127 ms (0.22) | 268 ms (0.46) | 298 ms (0.58) |
| code-50k · token | 124 ms (0.01) | 3144 ms (0.54) | 20519 ms (3.60) | 11945 ms (2.22) | 238 ms (0.04) | 4033 ms (0.66) | 315 ms (0.05) |
| code-50k · frame | 39.5 ms (0.02) | 776 ms (0.56) | 4795 ms (3.60) | 2740 ms (2.17) | 68.9 ms (0.04) | 947 ms (0.67) | 83.7 ms (0.05) |
| table-20k · frame | 37.8 ms (0.12) | 36.7 ms (0.12) | 3924 ms (8.69) | 3067 ms (6.79) | 170 ms (0.31) | 903 ms (2.07) | 281 ms (0.54) |
| long-100k · frame | 245 ms (0.10) | 379 ms (0.26) | 6310 ms (2.43) | stopped at 68% | 2420 ms (0.94) | 5917 ms (2.55) | 7187 ms (3.00) |
| crlf-20k · frame | 35.8 ms (0.07) | 87.0 ms (0.30) | 371 ms (0.75) | 2519 ms (4.76) | 117 ms (0.18) | 250 ms (0.52) | 271 ms (0.46) |
| footnotes-20k · frame | 35.0 ms (0.07) | 75.2 ms (0.29) | 321 ms (0.64) | 3005 ms (6.11) | 131 ms (0.21) | 273 ms (0.42) | 366 ms (0.64) |
| thread-30 · frame | 63.2 ms (0.18) | 82.4 ms (0.33) | 143 ms (0.61) | 15620 ms (32.0) | 572 ms (1.82) | 127 ms (0.47) | 1724 ms (4.05) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.20 ms | 0 / 0 / 0.20 ms | 0 / 0 / 1.41 ms | 0 / 0 / 2.49 ms | 0 / 0 / 1.17 ms | 0 / 0 / 3.35 ms | 0 / 0 / 1.40 ms |
| chat-5k · frame | 0 / 0 / 0.27 ms | 0 / 0 / 0.28 ms | 0 / 0 / 1.68 ms | 0 / 0 / 2.57 ms | 0 / 0 / 0.19 ms | 0 / 0 / 2.68 ms | 0 / 0 / 0.25 ms |
| answer-20k · token | 0 / 0 / 1.09 ms | 0 / 0 / 1.66 ms | 0 / 0 / 1.92 ms | 0 / 0 / 7.81 ms | 0 / 0 / 1.13 ms | 0 / 0 / 2.24 ms | 0 / 0 / 1.80 ms |
| answer-20k · frame | 0 / 0 / 1.08 ms | 0 / 0 / 1.80 ms | 0 / 0 / 1.90 ms | 0 / 0 / 7.09 ms | 0 / 0 / 1.44 ms | 0 / 0 / 1.96 ms | 0 / 0 / 1.15 ms |
| answer-20k · line | 0 / 0 / 0.31 ms | 0 / 0 / 2.47 ms | 0 / 0 / 2.31 ms | 0 / 0 / 7.02 ms | 0 / 0 / 1.81 ms | 0 / 0 / 3.14 ms | 0 / 0 / 1.42 ms |
| forms-20k · frame | 0 / 0 / 1.71 ms | 0 / 0 / 1.80 ms | 0 / 0 / 2.26 ms | 0 / 0 / 8.38 ms | 0 / 0 / 1.72 ms | 0 / 0 / 2.65 ms | 0 / 0 / 1.72 ms |
| math-20k · frame | 0 / 0 / 1.36 ms | 0 / 0 / 1.47 ms | 0 / 0 / 1.87 ms | 0 / 0 / 7.85 ms | 0 / 0 / 1.23 ms | 0 / 0 / 2.81 ms | 0 / 0 / 1.43 ms |
| code-50k · token | 0 / 0 / 1.34 ms | 1 / 0 / 16.9 ms | 0 / 0 / 9.08 ms | 0 / 0 / 6.57 ms | 0 / 0 / 0.72 ms | 0 / 0 / 3.68 ms | 0 / 0 / 0.61 ms |
| code-50k · frame | 0 / 0 / 1.03 ms | 1 / 0 / 19.4 ms | 0 / 0 / 6.48 ms | 0 / 0 / 4.15 ms | 0 / 0 / 1.07 ms | 0 / 0 / 2.54 ms | 0 / 0 / 0.36 ms |
| table-20k · frame | 0 / 0 / 1.25 ms | 0 / 0 / 1.72 ms | 0 / 0 / 13.0 ms | 0 / 0 / 8.74 ms | 0 / 0 / 1.43 ms | 0 / 0 / 6.06 ms | 0 / 0 / 1.48 ms |
| long-100k · frame | 0 / 0 / 2.17 ms | 0 / 0 / 1.82 ms | 0 / 0 / 6.64 ms | 302 / 1 / 64.7 ms | 0 / 0 / 3.70 ms | 0 / 0 / 13.7 ms | 0 / 0 / 5.90 ms |
| crlf-20k · frame | 0 / 0 / 1.84 ms | 0 / 0 / 2.05 ms | 0 / 0 / 2.76 ms | 0 / 0 / 6.67 ms | 0 / 0 / 1.23 ms | 0 / 0 / 1.99 ms | 0 / 0 / 1.17 ms |
| footnotes-20k · frame | 0 / 0 / 2.68 ms | 0 / 0 / 5.20 ms | 0 / 0 / 11.8 ms | 0 / 0 / 9.01 ms | 0 / 0 / 2.28 ms | 0 / 0 / 2.37 ms | 0 / 0 / 1.64 ms |
| thread-30 · frame | 0 / 0 / 1.54 ms | 0 / 0 / 1.72 ms | 0 / 0 / 2.19 ms | 515 / 2 / 51.2 ms | 0 / 0 / 2.92 ms | 0 / 0 / 3.94 ms | 0 / 0 / 5.69 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.0 / 0.5 | 0.7 / 1.0 / 0.5 | 1.1 / 1.4 / -0.4 | 0.7 / 1.0 / 0.5 | 0.6 / 1.1 / 0.2 | 4.4 / 4.4 / 3.1 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.7 / 0.2 / 0.2 | 0.7 / 0.5 / 0.2 | 1.0 / 0.5 / 0.2 | 0.7 / 0.4 / 0.1 | 0.7 / 0.2 / 0.3 | 4.0 / 1.0 / 0.3 | 0.5 / 0.3 / 0.1 |
| answer-20k · token | 3.3 / 2.1 / 0.2 | 4.2 / 3.5 / 0.2 | 5.8 / 5.2 / 0.3 | 1.7 / 2.4 / -1.1 | 2.7 / 1.7 / 0.2 | 13.6 / 5.8 / 0.6 | 1.7 / 1.2 / -0.9 |
| answer-20k · frame | 3.2 / 1.5 / 0.2 | 4.1 / 2.5 / 0.2 | 5.7 / 2.6 / 0.4 | 1.8 / 0.8 / 0.2 | 2.6 / 0.4 / 0.2 | 10.6 / 3.2 / 0.4 | 1.6 / 0.2 / 0.0 |
| answer-20k · line | 3.4 / 0.6 / 0.2 | 4.2 / 0.9 / 0.2 | 5.9 / 1.0 / 0.2 | 1.9 / 0.4 / -1.0 | 2.4 / -0.6 / 0.3 | 10.0 / 1.3 / 0.3 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 9.1 / 1.3 / 0.2 | 11.0 / 1.3 / 0.2 | 9.9 / 1.7 / 0.2 | 2.3 / 0.5 / -1.5 | 3.0 / 0.5 / 0.1 | 12.5 / 2.2 / 0.5 | 2.0 / 0.6 / -1.3 |
| math-20k · frame | 3.5 / 1.2 / 0.2 | 4.9 / 2.0 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.4 | 3.7 / 1.2 / -2.4 | 12.5 / 3.7 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.8 / 0.9 / 0.4 | 15.5 / 1.0 / 0.3 | 10.1 / 0.0 / -0.0 | 0.4 / 0.9 / -1.2 | 0.5 / 0.7 / 0.3 | 1.5 / 2.4 / 0.2 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.7 / -0.0 | 15.1 / 0.9 / 0.1 | 10.4 / 0.3 / -1.4 | 0.3 / 0.7 / 0.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.5 / 0.7 / 0.1 | 3.5 / 0.7 / 0.1 | 6.9 / 1.2 / 0.1 | 3.4 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 14.4 / 1.4 / 0.2 | 19.8 / 1.1 / 0.3 | 27.2 / 2.6 / -1.3 | 4.9 / 0.2 / -0.3 | 32.4 / 1.8 / 0.1 | 56.6 / 7.3 / -0.9 | 8.1 / 1.2 / -0.7 |
| crlf-20k · frame | 3.5 / 0.7 / 0.2 | 4.7 / 1.2 / 0.2 | 5.8 / 0.7 / 0.2 | 1.5 / 0.8 / 0.2 | 2.5 / 0.4 / 0.2 | 9.1 / 2.3 / 0.4 | 1.9 / 0.7 / 0.1 |
| footnotes-20k · frame | 2.7 / 0.7 / 0.2 | 4.0 / 1.8 / 0.2 | 6.0 / 2.5 / 0.3 | 2.1 / 1.1 / -1.3 | 2.2 / 1.3 / 0.2 | 11.3 / 4.6 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 13.5 / 0.7 / 0.2 | 19.5 / 0.7 / 0.2 | 29.2 / 1.1 / 0.3 | 9.1 / -1.0 / -0.1 | 10.3 / 0.4 / 0.2 | 57.2 / 1.7 / 0.4 | 9.0 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 23.1 ms | 66.9 ms | 2.9× (n^0.77) |
| `llx+highlight` | 22.9 ms | 168 ms | 7.3× (n^1.44) |
| `streamdown` | 134 ms | 743 ms | 5.5× (n^1.24) |
| `react-markdown` | 842 ms | 10040 ms | 11.9× (n^1.79) |
| `markdown-to-jsx` | 50.9 ms | 361 ms | 7.1× (n^1.41) |
| `markstream` | 123 ms | 967 ms | 7.8× (n^1.49) |
| `marked-react` | 94.4 ms | 1011 ms | 10.7× (n^1.71) |
