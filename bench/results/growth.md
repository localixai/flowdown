# One block that grows

flowdown 0.6.2, Apple M5, darwin, bun 1.4.4, 2026-11-16. From
[`src/growth.ts`](../src/growth.ts): each shape streamed at two sizes four times apart, 20
characters an update; the exponent is 1 when an update costs the end of the block, 2 when it
reads the whole block again.

| Shape | Target | Characters | Whole stream | Exponent |
| --- | --- | ---: | ---: | ---: |
| code | tui | 11503 → 46603 | 4.1 → 29.9 ms | 1.43 |
| code | tui + highlight | 11503 → 46603 | 189.5 → 756.2 ms | 1 |
| code | dom | 11503 → 46603 | 3.4 → 20.6 ms | 1.29 |
| code | dom + highlight | 11503 → 46603 | 261.4 → 1111.6 ms | 1.04 |
| table | tui | 4235 → 16912 | 6.9 → 28.8 ms | 1.03 |
| table | dom | 4235 → 16912 | 3.4 → 18.4 ms | 1.22 |
| list | tui | 5629 → 22689 | 13.2 → 113.3 ms | 1.55 |
| list | dom | 5629 → 22689 | 9.4 → 73.7 ms | 1.49 |
| quote | tui | 3311 → 13271 | 5.9 → 50.2 ms | 1.54 |
| quote | dom | 3311 → 13271 | 3.8 → 33.5 ms | 1.57 |
| paragraph | tui | 4739 → 18959 | 15.2 → 193.3 ms | 1.83 |
| paragraph | dom | 4739 → 18959 | 3.6 → 43.9 ms | 1.81 |
