# Benchmark results

- **date:** 2026-11-09T22:11:48.680Z
- **label:** local
- **commit:** 7cc1f25
- **dirty:** true
- **cpu:** Apple M5
- **cores:** 10
- **os:** darwin 25.6.0
- **runtime:** bun 1.4.4
- **runs:** 3
- **quick:** false
- **budgetMs:** 30000
- **renderers:** llx 0.0.0, llx+highlight 0.0.0, streamdown 2.7.1, react-markdown 10.1.0

## Whole stream

Total main-thread time to stream the reply, in milliseconds, with the 95th percentile of one
update in brackets. Lower is better. "Stopped" means the renderer used up the time budget
(30000 ms) before the reply ended.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 151 ms (0.23) | 160 ms (0.23) | 164 ms (0.25) | 913 ms (1.73) |
| chat-5k · frame | 43.6 ms (0.30) | 41.4 ms (0.27) | 46.9 ms (0.31) | 216 ms (1.74) |
| answer-20k · token | 407 ms (0.24) | 525 ms (0.34) | 1155 ms (0.51) | 13335 ms (5.75) |
| answer-20k · frame | 117 ms (0.31) | 151 ms (0.44) | 292 ms (0.58) | 3079 ms (5.87) |
| answer-20k · line | 58.8 ms (0.44) | 73.4 ms (0.58) | 105 ms (0.53) | 1107 ms (5.84) |
| forms-20k · frame | 651 ms (1.68) | 749 ms (1.96) | 702 ms (1.28) | 4044 ms (7.68) |
| math-20k · frame | 130 ms (0.38) | 150 ms (0.41) | 343 ms (0.70) | 3161 ms (6.87) |
| code-50k · token | 2250 ms (0.37) | 5717 ms (0.94) | 22964 ms (4.14) | 13703 ms (2.55) |
| code-50k · frame | 540 ms (0.39) | 1329 ms (0.95) | 5370 ms (4.08) | 3596 ms (2.76) |
| table-20k · frame | 742 ms (6.33) | 763 ms (6.45) | 4384 ms (9.84) | 3476 ms (7.50) |
| long-100k · frame | 818 ms (0.39) | 928 ms (0.44) | 6631 ms (2.68) | stopped at 66% |
| crlf-20k · frame | 115 ms (0.31) | 133 ms (0.31) | 318 ms (0.61) | 2775 ms (5.30) |
| footnotes-20k · frame | 164 ms (0.38) | 199 ms (0.42) | 351 ms (0.67) | 3245 ms (6.47) |
| thread-30 · frame | 108 ms (0.42) | 110 ms (0.42) | 131 ms (0.56) | 16485 ms (34.8) |

## Frame budget

Updates longer than a 60 Hz frame (16.7 ms) / longer than a long task
(50 ms) / the longest update.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 0 / 0 / 1.34 ms | 0 / 0 / 1.53 ms | 0 / 0 / 1.62 ms | 0 / 0 / 2.61 ms |
| chat-5k · frame | 0 / 0 / 1.59 ms | 0 / 0 / 1.41 ms | 0 / 0 / 1.51 ms | 0 / 0 / 2.47 ms |
| answer-20k · token | 0 / 0 / 1.37 ms | 0 / 0 / 1.48 ms | 0 / 0 / 1.79 ms | 0 / 0 / 9.91 ms |
| answer-20k · frame | 0 / 0 / 1.73 ms | 0 / 0 / 2.00 ms | 0 / 0 / 2.65 ms | 0 / 0 / 7.90 ms |
| answer-20k · line | 0 / 0 / 2.25 ms | 0 / 0 / 2.34 ms | 0 / 0 / 2.35 ms | 0 / 0 / 7.61 ms |
| forms-20k · frame | 0 / 0 / 3.17 ms | 0 / 0 / 3.59 ms | 0 / 0 / 2.95 ms | 0 / 0 / 9.49 ms |
| math-20k · frame | 0 / 0 / 2.31 ms | 0 / 0 / 1.93 ms | 0 / 0 / 2.02 ms | 0 / 0 / 8.98 ms |
| code-50k · token | 0 / 0 / 4.57 ms | 1 / 0 / 24.0 ms | 0 / 0 / 11.1 ms | 0 / 0 / 4.72 ms |
| code-50k · frame | 0 / 0 / 4.52 ms | 1 / 0 / 23.1 ms | 0 / 0 / 8.62 ms | 1 / 0 / 24.1 ms |
| table-20k · frame | 0 / 0 / 10.2 ms | 0 / 0 / 11.2 ms | 1 / 0 / 17.1 ms | 0 / 0 / 10.2 ms |
| long-100k · frame | 0 / 0 / 1.67 ms | 0 / 0 / 2.13 ms | 0 / 0 / 13.5 ms | 372 / 0 / 27.7 ms |
| crlf-20k · frame | 0 / 0 / 1.63 ms | 0 / 0 / 1.82 ms | 0 / 0 / 1.83 ms | 0 / 0 / 6.93 ms |
| footnotes-20k · frame | 0 / 0 / 10.5 ms | 0 / 0 / 10.3 ms | 0 / 0 / 14.7 ms | 0 / 0 / 9.48 ms |
| thread-30 · frame | 0 / 0 / 1.56 ms | 0 / 0 / 1.73 ms | 0 / 0 / 1.81 ms | 515 / 0 / 41.0 ms |

## Memory

Heap held while the streamed page is mounted / kept after it is unmounted (caches the reply
warmed, which are bounded) / grown by streaming the same reply again (a leak), in MB.

| | `llx` | `llx+highlight` | `streamdown` | `react-markdown` |
| --- | ---: | ---: | ---: | ---: |
| chat-5k · token | 0.9 / 1.2 / 0.5 | 0.9 / 1.2 / 0.5 | 1.1 / 1.4 / -0.4 | 0.7 / 1.0 / 0.5 |
| chat-5k · frame | 0.8 / 0.4 / 0.2 | 0.8 / 0.4 / 0.2 | 1.0 / 0.9 / 0.2 | 0.7 / 0.4 / 0.1 |
| answer-20k · token | 3.7 / 3.1 / 0.3 | 4.5 / 4.4 / 0.3 | 5.8 / 5.1 / 0.4 | 1.8 / 2.4 / -1.0 |
| answer-20k · frame | 3.7 / 1.6 / 0.2 | 4.6 / 2.7 / 0.2 | 5.7 / 2.6 / 0.4 | 1.7 / 0.8 / 0.2 |
| answer-20k · line | 3.5 / 1.0 / 0.3 | 4.3 / 1.3 / 0.3 | 5.9 / 0.9 / 0.2 | 1.9 / 0.4 / -1.0 |
| forms-20k · frame | 8.5 / 1.7 / 0.2 | 10.1 / 1.7 / 0.3 | 9.9 / 1.7 / 0.2 | 2.3 / 0.9 / -1.5 |
| math-20k · frame | 3.8 / 1.8 / 0.2 | 4.9 / 2.1 / 0.2 | 7.1 / 2.8 / 0.3 | 2.4 / 1.8 / -1.5 |
| code-50k · token | 0.8 / 1.2 / 0.5 | 15.6 / 1.3 / -0.8 | 10.3 / 0.2 / 0.1 | 0.5 / 0.9 / -1.0 |
| code-50k · frame | 1.0 / 0.9 / 0.1 | 15.4 / 0.9 / 0.2 | 10.4 / 0.3 / -1.2 | 0.3 / 0.7 / 0.2 |
| table-20k · frame | 4.4 / 0.9 / 0.1 | 4.4 / 0.9 / 0.1 | 7.0 / 1.2 / -1.2 | 3.4 / 0.8 / 0.1 |
| long-100k · frame | 23.5 / 2.3 / 0.3 | 27.8 / 2.0 / 0.3 | 26.9 / 3.4 / -0.9 | 5.2 / 0.4 / -0.3 |
| crlf-20k · frame | 3.1 / 1.1 / -1.4 | 3.5 / 1.3 / 0.2 | 5.8 / 1.8 / 0.2 | 1.5 / 0.7 / 0.2 |
| footnotes-20k · frame | 3.2 / 1.3 / 0.2 | 4.3 / 2.5 / 0.2 | 6.1 / 2.4 / 0.3 | 2.2 / 1.5 / -1.3 |
| thread-30 · frame | 14.9 / 0.8 / 0.2 | 18.1 / 0.8 / 0.2 | 29.2 / 1.1 / 0.3 | 9.0 / -1.0 / -0.1 |

## Scaling

The same kind of reply at 10 KB and 40 KB, frame pattern. Linear work is 4× (n^1.00); reparsing
the whole reply on every update is about 16× (n^2.00).

| | 10 KB | 40 KB | Growth |
| --- | ---: | ---: | ---: |
| `llx` | 57.5 ms | 235 ms | 4.1× (n^1.02) |
| `llx+highlight` | 59.1 ms | 343 ms | 5.8× (n^1.27) |
| `streamdown` | 136 ms | 775 ms | 5.7× (n^1.26) |
| `react-markdown` | 875 ms | 11017 ms | 12.6× (n^1.83) |
