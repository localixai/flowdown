# One block that grows

flowdown 0.6.2, Apple M5, darwin, bun 1.4.4, 2026-11-15. From
[`src/growth.ts`](../src/growth.ts): each shape streamed at two sizes four times apart, 20
characters an update; the exponent is 1 when an update costs the end of the block, 2 when it
reads the whole block again.

| Shape | Target | Characters | Whole stream | Exponent |
| --- | --- | ---: | ---: | ---: |
| code | tui | 11503 → 46603 | 14.6 → 210.6 ms | 1.92 |
| code | tui + highlight | 11503 → 46603 | 163.1 → 1200.6 ms | 1.44 |
| code | dom | 11503 → 46603 | 3.9 → 27.9 ms | 1.42 |
| code | dom + highlight | 11503 → 46603 | 736.2 → 9654.7 ms | 1.86 |
| table | tui | 4235 → 16912 | 9.3 → 100.6 ms | 1.71 |
| table | dom | 4235 → 16912 | 3.9 → 44 ms | 1.75 |
| list | tui | 5629 → 22689 | 52.2 → 726.3 ms | 1.9 |
| list | dom | 5629 → 22689 | 19.6 → 218.8 ms | 1.74 |
| quote | tui | 3311 → 13271 | 14.6 → 188.8 ms | 1.84 |
| quote | dom | 3311 → 13271 | 4.3 → 48.5 ms | 1.74 |
| paragraph | tui | 4739 → 18959 | 21.6 → 338.5 ms | 1.98 |
| paragraph | dom | 4739 → 18959 | 3.7 → 45.9 ms | 1.81 |
