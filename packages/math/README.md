# @localix-ai/math

TeX formulas for pages and terminals as agents write them: MathML a browser lays out itself, with its own small math font, and the same formula on rows of a terminal. Any prefix of a stream draws; no dependencies.

```sh
npm install @localix-ai/math
```

No dependencies. Part of [flowdown](https://github.com/localixai/flowdown).

## Development

```sh
bun test            # the tests, in a random order
bun run typecheck
bun run size        # each entry against budgets.json
bun run bench       # speed against budgets.json
```
