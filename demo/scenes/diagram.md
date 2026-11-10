How does a streamed reply reach the page?
---
```mermaid
flowchart LR
  Model -- tokens --> Split[Split into blocks]
  Split -- the last block --> Heal[Close what is open]
  Heal --> Render[Render it]
  Split -- the rest, kept --> Page[Page]
  Render --> Page
```

Only the last block is parsed again, so an update costs the same at any length: with $n$ blocks and
$k$ new characters, the work is

$$
O(k) \quad \text{instead of} \quad O\Big(\sum_{i=1}^{n} |b_i|\Big)
$$
