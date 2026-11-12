# Moving the API to Bun

The service starts in **80 ms** instead of *1.4 s*, and the ~~webpack~~ build step is gone. The
entry is `src/main.ts`; the plan is in [the migration guide](https://bun.sh/guides) and the
tracker is https://example.com/issues/42. Ctrl + C stops the server.

## 1. What changes

- The runtime: Node 22 → Bun 1.4
  - `node_modules` stays where it is
  - the lockfile becomes `bun.lock`
- The test runner
  1. `jest` is removed
  2. `bun test` reads the same files

Before the switch:

- [x] back up the lockfile
- [x] run the suite on both runtimes
- [ ] switch the CI image

> Simplicity is prerequisite for reliability.
>
> — Edsger W. Dijkstra

> [!NOTE] Scope
> Only the API moves. The worker stays on Node until its native module has a Bun build.

> [!TIP]
> `bun --watch src/main.ts` restarts on every save.

> [!WARNING] Downtime
> The first deploy restarts every pod at once. Do it outside peak hours.

## 2. How to do it

> [!STEPS] Migration
1. **Install**
   One binary, no version manager.

   ```sh
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Swap the scripts**
   Replace `node` with `bun` in `package.json`.
3. **Run the suite**
   Every test must pass on both runtimes before the switch.

> [!TABS] Install
#### macOS
```sh
brew install oven-sh/bun/bun
```
#### Linux
```sh
curl -fsSL https://bun.sh/install | bash
```
#### Windows
Run `powershell -c "irm bun.sh/install.ps1 | iex"`.

---

The files that change:

```tree
api/
├── src/
│   ├── main.ts        # entry point
│   └── routes/
│       ├── index.ts   # the route table
│       └── users.ts
├── bun.lock
└── package.json
```

```ts title="src/routes/users.ts"
import { route } from './router'

export const users = route('/users/:id', async ({ params }) => {
	const user = await db.users.find(params.id)
	return user ? Response.json(user) : new Response('Not found', { status: 404 })
})
```

```diff title="package.json"
-  "start": "node dist/main.js",
+  "start": "bun src/main.ts",
```

## 3. What it costs

> [!STATS]
- **17×** faster start
- **−62%** memory
- **0** build steps

| Check           | Node 22 |   Bun 1.4 | Verdict              |
| :-------------- | ------: | --------: | :------------------- |
| Cold start      | 1,400 ms |     80 ms | **much faster**      |
| Requests / s    |  41,000 |    96,000 | faster               |
| Memory at rest  |  118 MB |     45 MB | lighter              |
| Native modules  |     all |      most | check `sharp` first  |

> [!PROS]
- one tool for running, testing and bundling
- TypeScript without a build

> [!CONS] Risks
- a native module without a Bun build
- a younger runtime in production

The request path stays the same:

```mermaid
flowchart LR
  Client --> Proxy --> API --> Postgres
```

Throughput follows $r = n / t$, and over a window of $k$ samples the mean is

$$
\mu = \frac{1}{k} \sum_{i=1}^{k} r_i
$$

![Latency before and after](https://example.com/latency.png 'Figure 1: p95 latency, before and after')

> [!DETAILS] How it was measured
> The median of nine runs on one machine, each after a warm-up of 1,000 requests.
>
> - `wrk -t4 -c64 -d30s`
> - the same Postgres, the same data

> [!SOURCES] Further reading
- [Bun runtime](https://bun.sh/docs/runtime) — what differs from Node
- [Node compatibility](https://bun.sh/docs/runtime/nodejs-apis)

To go back, revert the one commit.[^back]

[^back]: The lockfile backed up in the first step makes the revert exact.
