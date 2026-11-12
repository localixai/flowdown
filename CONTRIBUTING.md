# Contributing

```sh
bun install
bun run test         # the library's tests
bun run typecheck && bun run lint && bun run format:check
bun run build && bun run check && bun run size
```

## What a change has to keep

- **One parse, block by block.** A document drawn as its top-level blocks is exactly what one parse
  of the whole draws, at every prefix of a stream. `blocks.test.tsx`, `stream-split.test.ts` and
  `blocks-fuzz.test.tsx` hold this; `FUZZ=60000 bun test blocks-fuzz` is the long sweep.
- **Linear streaming.** An update costs the end of the reply, not the reply. The budgets are in
  [bench/budgets.json](bench/budgets.json), and `bun run bench` followed by `bun run bench:check`
  holds a run to them.
- **Layers.** `engine`, `core`, `document` and `render` know no framework and no page; `static`,
  `dom`, `element`, `react` and `tui` are targets that name only what is under them.
  `layers.test.ts` holds the table of what each folder may import.
- **What is drawn.** `golden.test.tsx` holds a digest of what the seeded corpus draws on every
  target. A change meant to alter output updates it with `GOLDEN_UPDATE=1 bun test src/golden`, and
  the pull request says what moved; a refactor leaves it as it is. The targets are also held to
  each other: `static.test.tsx` and `dom.test.ts` compare them with React's HTML.
- **Size.** `bun run size` fails when an entry's own code or the page's download passes its budget.
  Raise a budget only with the reason in the pull request.
- **The dialect reads as plain Markdown.** A form a model writes must degrade to something sensible
  on GitHub or in any other renderer: a quote, a list, headings.

## Figures in the documentation

No number in the README or in [docs/comparison.md](docs/comparison.md) is typed by hand: each comes
from a script in [bench](bench). Change the script or rerun it, then copy the figure.

## Releases

Add a changeset (`bunx changeset`) to a pull request that changes the package. A tag `v<version>`
publishes that version ([release workflow](.github/workflows/release.yml)).
