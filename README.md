# llx-markdown

Markdown for AI replies and documentation in React: GitHub Markdown plus steps, tabs, stats, pros
and cons, callouts, file trees, diagrams and math, rendered while it streams.

The package and how to install and use it: [packages/llx-markdown](packages/llx-markdown/README.md).

## Repository

| Path                    | What it holds                                        |
| ----------------------- | ---------------------------------------------------- |
| `packages/llx-markdown` | the library                                          |
| `docs/`                 | the documentation, as Markdown; `nav.json` orders it |
| `bench/`                | rendering benchmarks against other renderers         |

```sh
bun install
bun run test        # the library's tests; CI skips the heavy sweeps (LLX_SKIP_HEAVY=1)
bun run check       # build output: exports, types, entry isolation
bun run bench       # the benchmarks
```

## Releases

CI checks every push to `main` and every pull request. A tag `v<version>`, the version in
`packages/llx-markdown/package.json`, publishes that version to GitHub Packages as
`@rsaryev/llx-markdown` ([release workflow](.github/workflows/release.yml)).
