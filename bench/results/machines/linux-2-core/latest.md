# Benchmark results

- **date:** 2026-11-21T13:39:35.038Z
- **label:** 0.8.0
- **commit:** 7e4cb69
- **dirty:** false
- **cpu:** Intel(R) Xeon(R) Processor @ 2.10GHz
- **cores:** 2
- **os:** linux 6.18.44-fc-v726
- **runtime:** bun 1.4.4
- **runs:** 3
- **passes:** 3
- **quick:** false
- **budgetMs:** 30000
- **machine:** linux-2-core
- **renderers:** flowdown 0.8.0, flowdown+highlight 0.8.0, streamdown 2.7.1, react-markdown 10.1.0, markdown-to-jsx 9.10.6, markstream 2.0.24, marked-react 4.0.0
- **kept from results/machines/linux-2-core/reference.json:** streamdown, react-markdown, markdown-to-jsx, markstream, marked-react: the mean of 1 to 1 full runs, 2026-11-21 to 2026-11-21

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 132 ms (0.28) | 111 ms (0.23) | 938 ms (1.48) | 3489 ms (6.28) | 145 ms (0.26) | 735 ms (1.08) | 538 ms (0.92) |
| chat-5k · frame | 56.1 ms (0.46) | 68.9 ms (0.63) | 262 ms (1.86) | 829 ms (6.84) | 48.8 ms (0.45) | 239 ms (1.70) | 140 ms (1.07) |
| answer-20k · token | 432 ms (0.27) | 437 ms (0.22) | 5179 ms (2.25) | stopped at 78% | 1836 ms (0.79) | 5871 ms (2.75) | 5446 ms (2.35) |
| answer-20k · frame | 155 ms (0.42) | 187 ms (0.44) | 1347 ms (2.62) | 10903 ms (20.9) | 463 ms (0.92) | 1455 ms (3.30) | 1307 ms (2.83) |
| answer-20k · line | 131 ms (1.00) | 161 ms (1.42) | 527 ms (2.73) | 4185 ms (25.3) | 190 ms (1.19) | 711 ms (4.58) | 433 ms (2.31) |
| forms-20k · frame | 598 ms (1.38) | 704 ms (1.63) | 3130 ms (5.82) | 14707 ms (28.1) | 550 ms (1.00) | 1881 ms (4.13) | 1848 ms (3.60) |
| math-20k · frame | 149 ms (0.46) | 190 ms (0.44) | 1484 ms (3.31) | 11199 ms (25.2) | 473 ms (0.97) | 1367 ms (3.06) | 1318 ms (2.58) |
| code-50k · token | 624 ms (0.10) | 1420 ms (0.24) | stopped at 63% | stopped at 85% | 708 ms (0.11) | 13134 ms (2.21) | 851 ms (0.13) |
| code-50k · frame | 157 ms (0.12) | 415 ms (0.25) | 16283 ms (13.4) | 9364 ms (7.64) | 189 ms (0.12) | 3166 ms (2.47) | 198 ms (0.14) |
| table-20k · frame | 122 ms (0.58) | 162 ms (0.63) | 15646 ms (35.7) | 11999 ms (27.0) | 611 ms (1.56) | 3662 ms (8.60) | 944 ms (1.97) |
| long-100k · frame | 695 ms (0.36) | 1045 ms (0.50) | 21434 ms (8.36) | stopped at 37% | 8901 ms (3.85) | 22574 ms (10.5) | stopped at 100% |
| crlf-20k · frame | 232 ms (0.62) | 342 ms (0.75) | 1395 ms (2.60) | 10499 ms (18.7) | 500 ms (0.93) | 1224 ms (2.38) | 1102 ms (1.87) |
| footnotes-20k · frame | 222 ms (0.51) | 288 ms (0.62) | 1582 ms (3.06) | 11648 ms (22.5) | 455 ms (0.87) | 1297 ms (2.46) | 1372 ms (2.51) |
| thread-30 · frame | 268 ms (1.18) | 342 ms (1.49) | 615 ms (2.39) | stopped at 51% | 2295 ms (7.41) | 670 ms (2.38) | 7601 ms (21.7) |
| react-10k · frame | 116 ms (0.56) | 132 ms (0.81) | 719 ms (3.23) | 3481 ms (14.3) | 165 ms (0.69) | 551 ms (2.07) | 491 ms (1.74) |
| react-40k · frame | 308 ms (0.45) | 418 ms (0.52) | 3927 ms (3.88) | stopped at 74% | 2052 ms (2.01) | 3997 ms (3.95) | 6558 ms (6.29) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 3.98 ms | 0 / 0 / 4.55 ms | 0 / 0 / 7.26 ms | 0 / 0 / 16.0 ms | 0 / 0 / 4.14 ms | 0 / 0 / 10.7 ms | 0 / 0 / 4.11 ms |
| chat-5k · frame | 0 / 0 / 1.09 ms | 0 / 0 / 2.93 ms | 0 / 0 / 6.05 ms | 0 / 0 / 8.55 ms | 0 / 0 / 1.75 ms | 0 / 0 / 14.2 ms | 0 / 0 / 4.32 ms |
| answer-20k · token | 0 / 0 / 8.24 ms | 0 / 0 / 7.24 ms | 0 / 0 / 7.91 ms | 172 / 0 / 43.2 ms | 0 / 0 / 8.50 ms | 1 / 0 / 19.6 ms | 0 / 0 / 9.80 ms |
| answer-20k · frame | 0 / 0 / 5.76 ms | 0 / 0 / 8.93 ms | 0 / 0 / 8.87 ms | 170 / 0 / 35.7 ms | 0 / 0 / 6.56 ms | 0 / 0 / 13.8 ms | 0 / 0 / 6.58 ms |
| answer-20k · line | 0 / 0 / 4.87 ms | 0 / 0 / 9.23 ms | 0 / 0 / 8.57 ms | 68 / 0 / 38.6 ms | 0 / 0 / 4.52 ms | 0 / 0 / 14.2 ms | 0 / 0 / 5.57 ms |
| forms-20k · frame | 0 / 0 / 7.86 ms | 0 / 0 / 6.76 ms | 0 / 0 / 9.53 ms | 416 / 1 / 50.6 ms | 0 / 0 / 6.77 ms | 1 / 0 / 20.2 ms | 0 / 0 / 6.49 ms |
| math-20k · frame | 0 / 0 / 5.58 ms | 0 / 0 / 9.04 ms | 0 / 0 / 8.92 ms | 233 / 0 / 47.4 ms | 0 / 0 / 6.51 ms | 0 / 0 / 10.1 ms | 0 / 0 / 5.77 ms |
| code-50k · token | 0 / 0 / 6.67 ms | 1 / 1 / 62.9 ms | 18 / 0 / 31.4 ms | 4 / 0 / 21.6 ms | 0 / 0 / 2.69 ms | 0 / 0 / 12.0 ms | 0 / 0 / 3.32 ms |
| code-50k · frame | 0 / 0 / 6.46 ms | 1 / 1 / 53.4 ms | 34 / 0 / 34.7 ms | 3 / 0 / 22.6 ms | 0 / 0 / 5.30 ms | 0 / 0 / 10.1 ms | 0 / 0 / 2.05 ms |
| table-20k · frame | 0 / 0 / 3.88 ms | 0 / 0 / 9.81 ms | 441 / 3 / 66.2 ms | 320 / 0 / 43.6 ms | 0 / 0 / 7.02 ms | 4 / 0 / 26.6 ms | 0 / 0 / 5.65 ms |
| long-100k · frame | 0 / 0 / 5.76 ms | 0 / 0 / 11.2 ms | 4 / 0 / 22.6 ms | 767 / 7 / 65.8 ms | 0 / 0 / 14.0 ms | 80 / 0 / 43.4 ms | 38 / 0 / 29.9 ms |
| crlf-20k · frame | 0 / 0 / 7.29 ms | 0 / 0 / 8.30 ms | 0 / 0 / 7.43 ms | 118 / 0 / 38.5 ms | 0 / 0 / 5.13 ms | 0 / 0 / 11.8 ms | 0 / 0 / 6.04 ms |
| footnotes-20k · frame | 1 / 0 / 22.6 ms | 1 / 0 / 32.9 ms | 2 / 1 / 51.9 ms | 247 / 0 / 41.3 ms | 0 / 0 / 9.50 ms | 0 / 0 / 9.71 ms | 0 / 0 / 6.13 ms |
| thread-30 · frame | 0 / 0 / 9.95 ms | 0 / 0 / 10.8 ms | 0 / 0 / 7.46 ms | 262 / 262 / 188 ms | 0 / 0 / 15.9 ms | 0 / 0 / 15.7 ms | 68 / 0 / 32.7 ms |
| react-10k · frame | 0 / 0 / 7.85 ms | 0 / 0 / 5.55 ms | 0 / 0 / 9.16 ms | 10 / 0 / 25.4 ms | 0 / 0 / 4.64 ms | 0 / 0 / 11.2 ms | 0 / 0 / 5.73 ms |
| react-40k · frame | 0 / 0 / 7.43 ms | 0 / 0 / 6.87 ms | 0 / 0 / 12.9 ms | 868 / 15 / 64.0 ms | 0 / 0 / 9.41 ms | 0 / 0 / 16.1 ms | 0 / 0 / 15.2 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `flowdown` | `flowdown+highlight` | `streamdown` | `react-markdown` | `markdown-to-jsx` | `markstream` | `marked-react` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.7 / 1.1 / 0.5 | 0.8 / 1.1 / 0.5 | 1.2 / 1.5 / -0.4 | 0.7 / 1.1 / 0.5 | 0.6 / 0.9 / 0.2 | 4.3 / 4.3 / 0.3 | 0.5 / 0.8 / 0.2 |
| chat-5k · frame | 0.7 / 0.3 / 0.2 | 0.8 / 0.5 / 0.2 | 1.1 / 0.9 / 0.2 | 0.6 / 0.2 / 0.1 | 0.7 / 0.2 / 0.3 | 4.2 / 1.0 / 0.3 | 0.6 / 0.3 / 0.1 |
| answer-20k · token | 3.2 / 2.6 / 0.3 | 5.9 / 3.2 / 0.3 | 5.9 / 5.3 / -1.4 | 1.4 / 1.6 / 0.1 | 2.6 / 1.8 / 0.2 | 13.7 / 6.0 / -0.6 | 1.7 / 1.2 / -1.4 |
| answer-20k · frame | 3.2 / 1.7 / -1.8 | 5.8 / 2.2 / 0.2 | 5.7 / 2.7 / 0.3 | 1.6 / 0.9 / -1.0 | 2.6 / 0.4 / -1.7 | 13.5 / 3.4 / 0.6 | 1.6 / 0.8 / -0.9 |
| answer-20k · line | 3.2 / 0.9 / 0.2 | 5.7 / -2.1 / 0.3 | 5.9 / 1.0 / 0.2 | 1.9 / 0.4 / -2.6 | 2.5 / 0.4 / 0.2 | 11.2 / 1.4 / 0.5 | 1.6 / 0.4 / -0.9 |
| forms-20k · frame | 8.2 / 0.1 / -6.5 | 11.2 / 1.5 / 0.2 | 9.9 / 1.8 / 0.2 | 1.1 / -1.0 / -1.7 | 3.0 / 0.8 / -2.1 | 21.5 / 2.8 / 0.2 | 2.0 / 0.3 / 0.1 |
| math-20k · frame | 3.4 / 1.6 / 0.2 | 5.3 / 0.6 / 0.2 | 7.1 / 2.9 / 0.3 | 0.8 / 1.9 / -1.5 | 3.5 / 1.3 / -2.4 | 18.8 / 4.1 / 0.5 | 2.3 / 0.9 / 0.1 |
| code-50k · token | 0.7 / 1.2 / 0.3 | 15.7 / 1.3 / 0.4 | 14.9 / -0.7 / -0.0 | -0.1 / -0.9 / -0.0 | 0.5 / 0.8 / 0.3 | 1.0 / 2.5 / -0.3 | 0.3 / 0.6 / 0.3 |
| code-50k · frame | 0.4 / 0.8 / 0.2 | 15.3 / 0.8 / 0.2 | 10.4 / -1.5 / 0.0 | 0.3 / 0.7 / -1.4 | 0.3 / 0.6 / 0.2 | 1.0 / 1.9 / -0.2 | 0.2 / 0.5 / 0.2 |
| table-20k · frame | 3.6 / 0.8 / 0.1 | 3.6 / 0.8 / 0.1 | 6.6 / -1.7 / -0.1 | 3.2 / 0.3 / -1.4 | 6.1 / 0.5 / 0.1 | 17.4 / 2.5 / 0.2 | 3.7 / 0.6 / 0.1 |
| long-100k · frame | 13.9 / 1.7 / 0.3 | 25.7 / 0.6 / 0.3 | 27.1 / 0.8 / -0.1 | 2.5 / -0.0 / -1.9 | 32.2 / 1.6 / -1.3 | 57.6 / 5.7 / -0.1 | 7.3 / 5.0 / -5.6 |
| crlf-20k · frame | 3.5 / 0.9 / 0.3 | 6.2 / 1.4 / 0.2 | 5.8 / 1.8 / 0.4 | 1.4 / 1.0 / -1.5 | 2.5 / 0.5 / 0.3 | 10.8 / 2.5 / 0.4 | 1.9 / 0.4 / 0.2 |
| footnotes-20k · frame | 2.7 / 0.8 / 0.2 | 4.6 / 0.5 / 0.2 | 6.0 / 2.5 / 0.4 | 0.6 / 1.2 / -1.3 | 2.3 / 1.3 / 0.1 | 14.1 / 4.8 / 0.5 | 2.0 / 0.8 / -1.2 |
| thread-30 · frame | 12.7 / 0.8 / 0.2 | 24.0 / 0.9 / 0.1 | 29.1 / 1.2 / 0.3 | 8.7 / 0.1 / -1.3 | 10.4 / 0.4 / 0.1 | 57.3 / 1.8 / 0.5 | 9.1 / 0.3 / -1.4 |
| react-10k · frame | 2.3 / 0.5 / 0.1 | 2.7 / 0.3 / 0.2 | 3.9 / 2.0 / 0.2 | 1.5 / 0.7 / 0.3 | 1.9 / 0.6 / 0.3 | 8.5 / 2.0 / 0.3 | 1.4 / 0.4 / 0.3 |
| react-40k · frame | 7.3 / 1.2 / 0.2 | 12.2 / 1.1 / 0.2 | 15.1 / 2.9 / 0.3 | 3.4 / -0.6 / -0.0 | 9.2 / 1.3 / 0.2 | 32.1 / 3.7 / 0.7 | 4.4 / 0.7 / -1.5 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `flowdown` | 121 ms | 290 ms | 2.4× (n^0.63) |
| `flowdown+highlight` | 143 ms | 350 ms | 2.4× (n^0.64) |
| `streamdown` | 677 ms | 3052 ms | 4.5× (n^1.09) |
| `react-markdown` | 3267 ms | stopped | stopped |
| `markdown-to-jsx` | 236 ms | 1548 ms | 6.5× (n^1.36) |
| `markstream` | 611 ms | 3995 ms | 6.5× (n^1.35) |
| `marked-react` | 374 ms | 4205 ms | 11.3× (n^1.75) |
