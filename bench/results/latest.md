# Benchmark results

- **date:** 2026-11-11T14:01:43.575Z
- **label:** 0.4.2
- **commit:** f34895b
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **passes:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** flowdown 0.4.2, flowdown+highlight 0.4.2, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 20.1 ms (0.03) | 22.4 ms (0.03) | 172 ms (0.27) | 885 ms (1.58) | 41.5 ms (0.06) | 125 ms (0.19) | 131 ms (0.20) |
| chat-5k · frame | 9.67 ms (0.07) | 8.71 ms (0.06) | 51.1 ms (0.33) | 204 ms (1.59) | 14.4 ms (0.09) | 40.0 ms (0.24) | 35.9 ms (0.22) |
| answer-20k · token | 70.3 ms (0.03) | 304 ms (0.32) | 1118 ms (0.48) | 12696 ms (5.49) | 473 ms (0.17) | 1291 ms (0.64) | 1261 ms (0.49) |
| answer-20k · frame | 27.4 ms (0.08) | 90.2 ms (0.39) | 285 ms (0.57) | 2869 ms (5.49) | 129 ms (0.20) | 361 ms (0.83) | 290 ms (0.49) |
| answer-20k · line | 15.1 ms (0.11) | 49.6 ms (0.43) | 112 ms (0.61) | 1096 ms (5.72) | 53.0 ms (0.25) | 147 ms (1.02) | 108 ms (0.50) |
| forms-20k · frame | 68.6 ms (0.14) | 172 ms (0.36) | 679 ms (1.23) | 3915 ms (7.62) | 145 ms (0.23) | 372 ms (0.83) | 470 ms (0.81) |
| math-20k · frame | 25.4 ms (0.06) | 67.3 ms (0.25) | 321 ms (0.64) | 2982 ms (6.68) | 137 ms (0.27) | 301 ms (0.63) | 307 ms (0.60) |
| code-50k · token | 124 ms (0.01) | 3198 ms (0.54) | 21499 ms (3.87) | 12513 ms (2.38) | 221 ms (0.04) | 4212 ms (0.69) | 312 ms (0.05) |
| code-50k · frame | 34.6 ms (0.02) | 756 ms (0.56) | 4960 ms (3.82) | 2871 ms (2.29) | 56.3 ms (0.03) | 944 ms (0.68) | 77.9 ms (0.05) |
| table-20k · frame | 20.1 ms (0.08) | 21.8 ms (0.09) | 4058 ms (8.77) | 3401 ms (7.79) | 167 ms (0.31) | 892 ms (2.11) | 269 ms (0.53) |
| long-100k · frame | 132 ms (0.06) | 394 ms (0.31) | 6265 ms (2.42) | stopped at 67% | 2293 ms (0.95) | 5522 ms (2.29) | 7371 ms (3.07) |
| crlf-20k · frame | 29.7 ms (0.06) | 101 ms (0.33) | 311 ms (0.57) | 2680 ms (5.15) | 121 ms (0.18) | 257 ms (0.53) | 272 ms (0.46) |
| footnotes-20k · frame | 32.7 ms (0.07) | 81.3 ms (0.32) | 341 ms (0.64) | 3046 ms (6.14) | 116 ms (0.21) | 286 ms (0.46) | 367 ms (0.65) |
| thread-30 · frame | 41.7 ms (0.13) | 83.5 ms (0.40) | 129 ms (0.52) | 16010 ms (34.4) | 603 ms (1.93) | 132 ms (0.48) | 1792 ms (4.20) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 0.15 ms | 0 / 0 / 0.15 ms | 0 / 0 / 1.92 ms | 0 / 0 / 2.58 ms | 0 / 0 / 1.40 ms | 0 / 0 / 3.22 ms | 0 / 0 / 1.45 ms |
| chat-5k · frame | 0 / 0 / 0.15 ms | 0 / 0 / 0.14 ms | 0 / 0 / 2.09 ms | 0 / 0 / 2.93 ms | 0 / 0 / 0.21 ms | 0 / 0 / 2.20 ms | 0 / 0 / 0.29 ms |
| answer-20k · token | 0 / 0 / 1.33 ms | 0 / 0 / 2.83 ms | 0 / 0 / 1.76 ms | 0 / 0 / 8.71 ms | 0 / 0 / 1.82 ms | 0 / 0 / 3.24 ms | 0 / 0 / 2.72 ms |
| answer-20k · frame | 0 / 0 / 0.31 ms | 0 / 0 / 2.59 ms | 0 / 0 / 2.35 ms | 0 / 0 / 8.02 ms | 0 / 0 / 1.84 ms | 0 / 0 / 2.50 ms | 0 / 0 / 1.37 ms |
| answer-20k · line | 0 / 0 / 0.22 ms | 0 / 0 / 2.37 ms | 0 / 0 / 2.54 ms | 0 / 0 / 8.03 ms | 0 / 0 / 1.52 ms | 0 / 0 / 3.26 ms | 0 / 0 / 1.54 ms |
| forms-20k · frame | 0 / 0 / 1.85 ms | 0 / 0 / 2.34 ms | 0 / 0 / 2.47 ms | 0 / 0 / 9.54 ms | 0 / 0 / 1.39 ms | 0 / 0 / 3.13 ms | 0 / 0 / 1.74 ms |
| math-20k · frame | 0 / 0 / 0.34 ms | 0 / 0 / 1.95 ms | 0 / 0 / 2.10 ms | 0 / 0 / 8.81 ms | 0 / 0 / 2.09 ms | 0 / 0 / 3.06 ms | 0 / 0 / 2.58 ms |
| code-50k · token | 0 / 0 / 1.70 ms | 1 / 0 / 17.3 ms | 0 / 0 / 7.34 ms | 0 / 0 / 5.56 ms | 0 / 0 / 0.77 ms | 0 / 0 / 4.22 ms | 0 / 0 / 0.79 ms |
| code-50k · frame | 0 / 0 / 1.26 ms | 1 / 0 / 18.4 ms | 0 / 0 / 7.86 ms | 0 / 0 / 4.37 ms | 0 / 0 / 0.97 ms | 0 / 0 / 1.73 ms | 0 / 0 / 0.25 ms |
| table-20k · frame | 0 / 0 / 0.28 ms | 0 / 0 / 0.26 ms | 0 / 0 / 11.6 ms | 0 / 0 / 12.5 ms | 0 / 0 / 1.41 ms | 0 / 0 / 5.13 ms | 0 / 0 / 1.53 ms |
| long-100k · frame | 0 / 0 / 1.66 ms | 0 / 0 / 2.13 ms | 0 / 0 / 6.54 ms | 373 / 0 / 29.6 ms | 0 / 0 / 3.66 ms | 0 / 0 / 9.10 ms | 0 / 0 / 6.99 ms |
| crlf-20k · frame | 0 / 0 / 1.55 ms | 0 / 0 / 2.14 ms | 0 / 0 / 1.92 ms | 0 / 0 / 7.43 ms | 0 / 0 / 1.50 ms | 0 / 0 / 2.58 ms | 0 / 0 / 1.33 ms |
| footnotes-20k · frame | 0 / 0 / 4.13 ms | 0 / 0 / 4.40 ms | 0 / 0 / 12.4 ms | 0 / 0 / 8.44 ms | 0 / 0 / 2.14 ms | 0 / 0 / 3.41 ms | 0 / 0 / 1.94 ms |
| thread-30 · frame | 0 / 0 / 1.43 ms | 0 / 0 / 2.26 ms | 0 / 0 / 1.87 ms | 515 / 1 / 55.1 ms | 0 / 0 / 3.58 ms | 0 / 0 / 3.53 ms | 0 / 0 / 6.57 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.0 / 0.5 | 0.7 / 1.0 / 0.5 | 1.2 / 1.4 / -0.4 | 0.7 / 1.1 / 0.5 | 0.6 / 1.1 / 0.2 | 4.3 / 4.4 / 0.3 | 0.6 / 0.8 / 0.1 |
| chat-5k · frame | 0.7 / 0.5 / 0.2 | 0.7 / 0.5 / 0.2 | 1.0 / 0.5 / 0.2 | 0.7 / 0.4 / 0.1 | 0.7 / 0.2 / 0.3 | 4.0 / 1.0 / 0.3 | 0.5 / 0.3 / 0.1 |
| answer-20k · token | 3.1 / 2.1 / 0.2 | 5.7 / 3.6 / 0.3 | 5.8 / 5.2 / 0.3 | 1.8 / 2.4 / -1.4 | 2.7 / 1.5 / 0.2 | 13.7 / 5.8 / 0.6 | 1.7 / 1.3 / -0.9 |
| answer-20k · frame | 3.0 / 1.3 / 0.2 | 5.6 / 2.7 / 0.2 | 5.7 / 2.6 / 0.4 | 1.7 / 0.8 / 0.2 | 2.6 / 0.4 / 0.2 | 10.6 / 3.2 / 0.5 | 1.6 / 0.2 / 0.0 |
| answer-20k · line | 3.2 / 0.7 / 0.2 | 5.7 / 0.7 / 0.2 | 5.9 / 0.9 / 0.2 | 1.8 / 0.4 / 0.2 | 2.4 / -0.6 / 0.2 | 10.1 / 1.3 / 0.3 | 1.7 / 0.4 / -0.9 |
| forms-20k · frame | 8.3 / 1.3 / 0.2 | 11.0 / 1.5 / 0.2 | 9.9 / 1.8 / 0.2 | 2.3 / 0.5 / -1.6 | 3.0 / 0.5 / 0.1 | 12.7 / 2.2 / 0.5 | 2.0 / 0.3 / -1.3 |
| math-20k · frame | 3.4 / 1.4 / 0.2 | 5.2 / 0.9 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.9 / -1.5 | 3.6 / 1.3 / -2.3 | 13.1 / 3.7 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.6 / 0.9 / 0.2 | 15.4 / 1.0 / 0.3 | 10.0 / -0.1 / -0.1 | 0.5 / 0.9 / -1.4 | 0.4 / 0.7 / 0.3 | 1.6 / 2.4 / 0.2 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.7 / 0.2 | 15.1 / 0.9 / 0.1 | 10.4 / 0.4 / -1.5 | 0.3 / 0.7 / 0.2 | 0.3 / 0.6 / 0.1 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.1 |
| table-20k · frame | 3.6 / 0.7 / 0.1 | 3.6 / 0.7 / 0.1 | 7.0 / 1.2 / 0.1 | 3.4 / 0.8 / 0.1 | 6.0 / -0.2 / 0.1 | 17.3 / 2.4 / 0.2 | 3.6 / 0.0 / 0.1 |
| long-100k · frame | 13.6 / 1.8 / 0.2 | 25.0 / 0.5 / 0.3 | 27.2 / 2.6 / -1.4 | 5.1 / 0.1 / -0.1 | 32.5 / 1.6 / 0.2 | 56.6 / 7.3 / -1.0 | 8.1 / 1.2 / -1.4 |
| crlf-20k · frame | 3.4 / 0.7 / -1.5 | 5.9 / 1.5 / 0.2 | 5.8 / 1.8 / 0.2 | 1.5 / 0.7 / 0.2 | 2.5 / 0.4 / 0.2 | 9.2 / 2.4 / 0.3 | 2.0 / 0.7 / 0.1 |
| footnotes-20k · frame | 2.6 / 0.7 / -1.7 | 4.5 / 0.8 / 0.2 | 6.0 / 2.4 / 0.3 | 2.1 / 1.2 / -1.3 | 2.3 / 1.2 / 0.2 | 11.7 / 4.6 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.5 / 0.7 / 0.2 | 22.9 / 0.8 / -21.0 | 29.1 / 1.1 / 0.2 | 9.3 / -1.3 / -0.0 | 10.5 / 0.5 / 0.0 | 57.4 / 1.7 / 0.4 | 10.0 / 0.3 / 0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `flowdown` | 16.1 ms | 51.6 ms | 3.2× (n^0.84) |
| `flowdown+highlight` | 37.9 ms | 191 ms | 5.0× (n^1.17) |
| `streamdown` | 145 ms | 756 ms | 5.2× (n^1.19) |
| `react-markdown` | 876 ms | 10768 ms | 12.3× (n^1.81) |
| `markdown-to-jsx` | 44.2 ms | 370 ms | 8.4× (n^1.53) |
| `markstream` | 123 ms | 1013 ms | 8.3× (n^1.52) |
| `marked-react` | 88.6 ms | 1046 ms | 11.8× (n^1.78) |
