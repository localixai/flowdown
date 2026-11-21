# Benchmark results

- **date:** 2026-11-21T10:29:00.092Z
- **label:** 0.7.2-idle
- **commit:** 857bdf7
- **dirty:** true
- **cpu:** Intel(R) Xeon(R) Processor @ 2.10GHz
- **cores:** 2
- **os:** linux 6.18.44-fc-v726
- **runtime:** bun 1.4.4
- **runs:** 3
- **passes:** 3
- **quick:** false
- **budgetMs:** 30000
- **machine:** linux-2-core
- **renderers:** flowdown 0.7.2, flowdown+highlight 0.7.2, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0
- **kept from results/machines/linux-2-core/reference.json:** streamdown, react-markdown, markdown-to-jsx, markstream, marked-react: the mean of 1 to 1 full runs, 2026-11-21 to 2026-11-21

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 98.2 ms (0.19) | 89.2 ms (0.22) | 938 ms (1.48) | 3489 ms (6.28) | 145 ms (0.26) | 735 ms (1.08) | 538 ms (0.92) |
| chat-5k · frame | 49.1 ms (0.39) | 62.1 ms (0.49) | 262 ms (1.86) | 829 ms (6.84) | 48.8 ms (0.45) | 239 ms (1.70) | 140 ms (1.07) |
| answer-20k · token | 318 ms (0.16) | 1439 ms (1.51) | 5179 ms (2.25) | stopped at 78% | 1836 ms (0.79) | 5871 ms (2.75) | 5446 ms (2.35) |
| answer-20k · frame | 109 ms (0.31) | 425 ms (1.74) | 1347 ms (2.62) | 10903 ms (20.9) | 463 ms (0.92) | 1455 ms (3.30) | 1307 ms (2.83) |
| answer-20k · line | 87.3 ms (0.62) | 212 ms (2.20) | 527 ms (2.73) | 4185 ms (25.3) | 190 ms (1.19) | 711 ms (4.58) | 433 ms (2.31) |
| forms-20k · frame | 462 ms (1.08) | 1030 ms (2.37) | 3130 ms (5.82) | 14707 ms (28.1) | 550 ms (1.00) | 1881 ms (4.13) | 1848 ms (3.60) |
| math-20k · frame | 119 ms (0.37) | 302 ms (1.16) | 1484 ms (3.31) | 11199 ms (25.2) | 473 ms (0.97) | 1367 ms (3.06) | 1318 ms (2.58) |
| code-50k · token | 461 ms (0.06) | 14754 ms (3.19) | stopped at 63% | stopped at 85% | 708 ms (0.11) | 13134 ms (2.21) | 851 ms (0.13) |
| code-50k · frame | 133 ms (0.10) | 3335 ms (3.10) | 16283 ms (13.4) | 9364 ms (7.64) | 189 ms (0.12) | 3166 ms (2.47) | 198 ms (0.14) |
| table-20k · frame | 108 ms (0.57) | 105 ms (0.48) | 15646 ms (35.7) | 11999 ms (27.0) | 611 ms (1.56) | 3662 ms (8.60) | 944 ms (1.97) |
| long-100k · frame | 527 ms (0.25) | 1706 ms (1.44) | 21434 ms (8.36) | stopped at 37% | 8901 ms (3.85) | 22574 ms (10.5) | stopped at 100% |
| crlf-20k · frame | 141 ms (0.33) | 443 ms (1.41) | 1395 ms (2.60) | 10499 ms (18.7) | 500 ms (0.93) | 1224 ms (2.38) | 1102 ms (1.87) |
| footnotes-20k · frame | 176 ms (0.41) | 366 ms (1.46) | 1582 ms (3.06) | 11648 ms (22.5) | 455 ms (0.87) | 1297 ms (2.46) | 1372 ms (2.51) |
| thread-30 · frame | 192 ms (0.80) | 410 ms (1.95) | 615 ms (2.39) | stopped at 51% | 2295 ms (7.41) | 670 ms (2.38) | 7601 ms (21.7) |
| react-10k · frame | 102 ms (0.50) | 110 ms (0.71) | 719 ms (3.23) | 3481 ms (14.3) | 165 ms (0.69) | 551 ms (2.07) | 491 ms (1.74) |
| react-40k · frame | 272 ms (0.35) | 608 ms (1.40) | 3927 ms (3.88) | stopped at 74% | 2052 ms (2.01) | 3997 ms (3.95) | 6558 ms (6.29) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 4.26 ms | 0 / 0 / 3.65 ms | 0 / 0 / 7.26 ms | 0 / 0 / 16.0 ms | 0 / 0 / 4.14 ms | 0 / 0 / 10.7 ms | 0 / 0 / 4.11 ms |
| chat-5k · frame | 0 / 0 / 1.79 ms | 0 / 0 / 0.96 ms | 0 / 0 / 6.05 ms | 0 / 0 / 8.55 ms | 0 / 0 / 1.75 ms | 0 / 0 / 14.2 ms | 0 / 0 / 4.32 ms |
| answer-20k · token | 0 / 0 / 4.04 ms | 0 / 0 / 10.3 ms | 0 / 0 / 7.91 ms | 172 / 0 / 43.2 ms | 0 / 0 / 8.50 ms | 1 / 0 / 19.6 ms | 0 / 0 / 9.80 ms |
| answer-20k · frame | 0 / 0 / 5.71 ms | 0 / 0 / 7.22 ms | 0 / 0 / 8.87 ms | 170 / 0 / 35.7 ms | 0 / 0 / 6.56 ms | 0 / 0 / 13.8 ms | 0 / 0 / 6.58 ms |
| answer-20k · line | 0 / 0 / 4.51 ms | 0 / 0 / 7.68 ms | 0 / 0 / 8.57 ms | 68 / 0 / 38.6 ms | 0 / 0 / 4.52 ms | 0 / 0 / 14.2 ms | 0 / 0 / 5.57 ms |
| forms-20k · frame | 0 / 0 / 6.12 ms | 0 / 0 / 7.04 ms | 0 / 0 / 9.53 ms | 416 / 1 / 50.6 ms | 0 / 0 / 6.77 ms | 1 / 0 / 20.2 ms | 0 / 0 / 6.49 ms |
| math-20k · frame | 0 / 0 / 3.63 ms | 0 / 0 / 7.00 ms | 0 / 0 / 8.92 ms | 233 / 0 / 47.4 ms | 0 / 0 / 6.51 ms | 0 / 0 / 10.1 ms | 0 / 0 / 5.77 ms |
| code-50k · token | 0 / 0 / 4.71 ms | 1 / 1 / 63.0 ms | 18 / 0 / 31.4 ms | 4 / 0 / 21.6 ms | 0 / 0 / 2.69 ms | 0 / 0 / 12.0 ms | 0 / 0 / 3.32 ms |
| code-50k · frame | 0 / 0 / 4.60 ms | 1 / 1 / 67.0 ms | 34 / 0 / 34.7 ms | 3 / 0 / 22.6 ms | 0 / 0 / 5.30 ms | 0 / 0 / 10.1 ms | 0 / 0 / 2.05 ms |
| table-20k · frame | 0 / 0 / 3.85 ms | 0 / 0 / 5.31 ms | 441 / 3 / 66.2 ms | 320 / 0 / 43.6 ms | 0 / 0 / 7.02 ms | 4 / 0 / 26.6 ms | 0 / 0 / 5.65 ms |
| long-100k · frame | 0 / 0 / 5.67 ms | 0 / 0 / 11.2 ms | 4 / 0 / 22.6 ms | 767 / 7 / 65.8 ms | 0 / 0 / 14.0 ms | 80 / 0 / 43.4 ms | 38 / 0 / 29.9 ms |
| crlf-20k · frame | 0 / 0 / 7.47 ms | 0 / 0 / 6.81 ms | 0 / 0 / 7.43 ms | 118 / 0 / 38.5 ms | 0 / 0 / 5.13 ms | 0 / 0 / 11.8 ms | 0 / 0 / 6.04 ms |
| footnotes-20k · frame | 0 / 0 / 12.8 ms | 1 / 0 / 21.7 ms | 2 / 1 / 51.9 ms | 247 / 0 / 41.3 ms | 0 / 0 / 9.50 ms | 0 / 0 / 9.71 ms | 0 / 0 / 6.13 ms |
| thread-30 · frame | 0 / 0 / 7.76 ms | 0 / 0 / 8.88 ms | 0 / 0 / 7.46 ms | 262 / 262 / 188 ms | 0 / 0 / 15.9 ms | 0 / 0 / 15.7 ms | 68 / 0 / 32.7 ms |
| react-10k · frame | 0 / 0 / 5.42 ms | 0 / 0 / 6.54 ms | 0 / 0 / 9.16 ms | 10 / 0 / 25.4 ms | 0 / 0 / 4.64 ms | 0 / 0 / 11.2 ms | 0 / 0 / 5.73 ms |
| react-40k · frame | 0 / 0 / 6.30 ms | 0 / 0 / 9.52 ms | 0 / 0 / 12.9 ms | 868 / 15 / 64.0 ms | 0 / 0 / 9.41 ms | 0 / 0 / 16.1 ms | 0 / 0 / 15.2 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.1 / 0.5 | 0.8 / 1.0 / 0.5 | 1.2 / 1.5 / -0.4 | 0.7 / 1.1 / 0.5 | 0.6 / 0.9 / 0.2 | 4.3 / 4.3 / 0.3 | 0.5 / 0.8 / 0.2 |
| chat-5k · frame | 0.7 / 0.3 / 0.2 | 0.7 / 0.5 / 0.2 | 1.1 / 0.9 / 0.2 | 0.6 / 0.2 / 0.1 | 0.7 / 0.2 / 0.3 | 4.2 / 1.0 / 0.3 | 0.6 / 0.3 / 0.1 |
| answer-20k · token | 3.2 / 2.6 / -1.7 | 5.9 / 4.1 / 0.3 | 5.9 / 5.3 / -1.4 | 1.4 / 1.6 / 0.1 | 2.6 / 1.8 / 0.2 | 13.7 / 6.0 / -0.6 | 1.7 / 1.2 / -1.4 |
| answer-20k · frame | 3.2 / 1.6 / 0.2 | 5.8 / 2.6 / 0.2 | 5.7 / 2.7 / 0.3 | 1.6 / 0.9 / -1.0 | 2.6 / 0.4 / -1.7 | 13.5 / 3.4 / 0.6 | 1.6 / 0.8 / -0.9 |
| answer-20k · line | 3.2 / 0.9 / 0.3 | 5.8 / 0.9 / 0.3 | 5.9 / 1.0 / 0.2 | 1.9 / 0.4 / -2.6 | 2.5 / 0.4 / 0.2 | 11.2 / 1.4 / 0.5 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.4 / 1.5 / 0.2 | 11.1 / 1.7 / 0.2 | 9.9 / 1.8 / 0.2 | 1.1 / -1.0 / -1.7 | 3.0 / 0.8 / -2.1 | 21.5 / 2.8 / 0.2 | 2.0 / 0.3 / 0.1 |
| math-20k · frame | 3.4 / 1.6 / 0.2 | 5.1 / 1.9 / 0.2 | 7.1 / 2.9 / 0.3 | 0.8 / 1.9 / -1.5 | 3.5 / 1.3 / -2.4 | 18.8 / 4.1 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.7 / 1.2 / 0.4 | 15.4 / -0.4 / 0.2 | 14.9 / -0.7 / -0.0 | -0.1 / -0.9 / -0.0 | 0.5 / 0.8 / 0.3 | 1.0 / 2.5 / -0.3 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.9 / 0.2 | 15.3 / 0.8 / 0.2 | 10.4 / -1.5 / 0.0 | 0.3 / 0.7 / -1.4 | 0.3 / 0.6 / 0.2 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.2 |
| table-20k · frame | 3.7 / 0.8 / 0.1 | 3.7 / 0.8 / 0.1 | 6.6 / -1.7 / -0.1 | 3.2 / 0.3 / -1.4 | 6.1 / 0.5 / 0.1 | 17.4 / 2.5 / 0.2 | 3.7 / 0.6 / 0.1 |
| long-100k · frame | 13.9 / 1.7 / 0.3 | 25.3 / 0.8 / 0.3 | 27.1 / 0.8 / -0.1 | 2.5 / -0.0 / -1.9 | 32.2 / 1.6 / -1.3 | 57.6 / 5.7 / -0.1 | 7.3 / 5.0 / -5.6 |
| crlf-20k · frame | 3.5 / 0.9 / -1.4 | 6.0 / 1.7 / 0.2 | 5.8 / 1.8 / 0.4 | 1.4 / 1.0 / -1.5 | 2.5 / 0.5 / 0.3 | 10.8 / 2.5 / 0.4 | 1.9 / 0.4 / 0.2 |
| footnotes-20k · frame | 2.7 / 0.8 / 0.2 | 4.6 / 1.0 / 0.2 | 6.0 / 2.5 / 0.4 | 0.6 / 1.2 / -1.3 | 2.3 / 1.3 / 0.1 | 14.1 / 4.8 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.7 / 0.8 / 0.2 | 23.2 / 0.9 / -20.9 | 29.1 / 1.2 / 0.3 | 8.7 / 0.1 / -1.3 | 10.4 / 0.4 / 0.1 | 57.3 / 1.8 / 0.5 | 9.1 / 0.3 / -1.4 |
| react-10k · frame | 2.2 / 0.5 / 0.1 | 2.6 / 0.4 / 0.1 | 3.9 / 2.0 / 0.2 | 1.5 / 0.7 / 0.3 | 1.9 / 0.6 / 0.3 | 8.5 / 2.0 / 0.3 | 1.4 / 0.4 / 0.3 |
| react-40k · frame | 7.3 / 1.2 / 0.1 | 11.4 / 1.4 / 0.1 | 15.1 / 2.9 / 0.3 | 3.4 / -0.6 / -0.0 | 9.2 / 1.3 / 0.2 | 32.1 / 3.7 / 0.7 | 4.4 / 0.7 / -1.5 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `flowdown` | 88.5 ms | 214 ms | 2.4× (n^0.64) |
| `flowdown+highlight` | 187 ms | 904 ms | 4.8× (n^1.14) |
| `streamdown` | 677 ms | 3052 ms | 4.5× (n^1.09) |
| `react-markdown` | 3267 ms | stopped | stopped |
| `markdown-to-jsx` | 236 ms | 1548 ms | 6.5× (n^1.36) |
| `markstream` | 611 ms | 3995 ms | 6.5× (n^1.35) |
| `marked-react` | 374 ms | 4205 ms | 11.3× (n^1.75) |
