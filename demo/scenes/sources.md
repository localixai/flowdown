Why did CI get slower last week?
---
The bundler started type-checking on every build. Check types in their own job and the build is back under a minute.

```diff title="build.config.ts"
 export default defineConfig({
   entry: 'src/index.ts',
-  typecheck: true,
+  typecheck: false,
 })
```

> [!DETAILS] Timings from the last ten runs
> | Step      | Before | After |
> | --------- | -----: | ----: |
> | Install   |   18 s |  18 s |
> | Typecheck |      — |  41 s |
> | Build     |  212 s |  47 s |

> [!SOURCES]
- [Bundler options](https://bun.sh/docs/bundler) — `typecheck` runs the compiler inside the build
- [Project references](https://www.typescriptlang.org/docs/handbook/project-references.html) — incremental checks in a job of their own
