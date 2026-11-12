## Move the API to Bun

> [!WARNING]
> Back up `package-lock.json` first.

> [!STEPS]
1. **Install**
   Run `bun install`.
2. **Swap the scripts**
   Replace `node` with `bun` in `package.json`.

```ts title="src/server.ts"
import { serve } from 'bun'

serve({ port: 3000, fetch: () => new Response('ok') })
```

```diff
- "start": "node dist/server.js"
+ "start": "bun src/server.ts"
```

| Check      | Before | After |
| :--------- | -----: | ----: |
| Cold start | 410 ms | 95 ms |
| p95        |  38 ms | 21 ms |

- [x] lockfile backed up
- [ ] deploy to staging

Throughput is $r = n / t$, and over $k$ samples

$$ \bar{r} = \frac{1}{k} \sum_{i=1}^{k} r_i $$

> [!SOURCES] Further reading
- [Bun runtime](https://bun.sh/docs/runtime) — what differs from Node
