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
  [bench/budgets.json](bench/budgets.json), and `bun run bench` followed by
  `bun run --cwd bench bench:check` holds a run to them.
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
- **One dialect, two parsers.** The npm package and the Rust crate read the same forms:
  [spec/forms/spec.txt](spec/forms/spec.txt) says what they are, and both suites run its cases. A
  change to the dialect changes that file first and both parsers with it.

## The Rust crate

```sh
crates/flowdown/scripts/check    # what CI runs: fmt, clippy, the tests, the docs, the wasm build
sh crates/flowdown/bench/run.sh  # the benchmarks, into crates/flowdown/bench/results/
```

What a change to the crate keeps is in [AGENTS.md](AGENTS.md), "The Rust crate" (rules R1 to R7):
no panic, no dependency, small files, the lints denied, no I/O, time that grows with the text. Its
prompt and its tables are written from the npm package's (`bun run prompt`, `bun run
crate-tables` in `packages/flowdown`), never by hand. A figure in its README comes from
`bench/results/`, as the package's do from `bench/`.

## Figures in the documentation

No number in the README or in [docs/comparison.md](docs/comparison.md) is typed by hand: each comes
from a script in [bench](bench). Change the script or rerun it, then copy the figure.

## Releases

Add a changeset (`bunx changeset`) to a pull request that changes the package. A tag `v<version>`
publishes that version and makes its GitHub release
([release workflow](.github/workflows/release.yml)).

The highlighter's, the math's and the diagrams' versions are their own too: write a change under
the version in its `packages/<name>/CHANGELOG.md` and run the
[Package release workflow](.github/workflows/package-release.yml) from main, with the package.

The crate's versions are its own: write a change to it under "Unreleased" in
[crates/flowdown/CHANGELOG.md](crates/flowdown/CHANGELOG.md). A tag `rust-v<version>` releases
that version on GitHub ([Rust release workflow](.github/workflows/rust-release.yml)).
