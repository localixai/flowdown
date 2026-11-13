# AGENTS.md

Instructions for AI coding agents working on this repository.

`@localix-ai/flowdown` is streaming Markdown for React and terminals: its own parser, no
dependencies. [CONTRIBUTING.md](CONTRIBUTING.md) is what a change has to keep, and it binds an agent
as it binds a person: read it before a change to the library. This file says where things are and
how to work here.

## Layout

- `packages/flowdown`: the library, the one published package. In `src/`, `engine`, `core`,
  `document` and `render` know no framework and no page; `static`, `dom`, `element`, `react` and
  `tui` are the targets, and each names only what is under it. `layers.test.ts` holds the table.
- `bench/`: the benchmarks, their budgets (`budgets.json`), and the scripts every published figure
  comes from.
- `docs/`: the documentation, each file a page of the site.
- `site/`: flowdown.dev, with its own guide ([site/AGENTS.md](site/AGENTS.md)) and its own
  toolchain (npm). Read that guide before a change there.
- `demo/`: the pages the screenshots are taken from (`bun run shots`). `examples/tui`: a reply
  streamed into a terminal.

## Commands

Run them at the root; the scripts forward to the package.

```sh
bun install
bun run test                    # the library's tests; one file: bun test <name> in packages/flowdown
bun run typecheck && bun run lint && bun run format:check
bun run build && bun run check  # check is the library's full gate
bun run size                    # each entry's own code and the page's download, against budgets
bun run bench && bun run --cwd bench bench:check   # a run held to bench/budgets.json
```

CI runs all of these but the bench.

## Rules

- **One parse, block by block.** Every prefix of a stream draws what one parse of the whole draws.
  A change that breaks `blocks.test.tsx`, `stream-split.test.ts` or `blocks-fuzz.test.tsx` is wrong,
  not the test.
- **A refactor leaves the golden digest alone.** Only a change meant to alter output updates it
  (`GOLDEN_UPDATE=1 bun test src/golden`), and then says what moved.
- **Budgets hold.** Raise a size or a bench budget only with the reason stated; never to get a
  change through.
- **No figure is typed by hand.** A number in the README or `docs/comparison.md` comes from a script
  in `bench/`: change the script or rerun it, then copy the figure.
- **No dependency.** The package has none at run time; a change that needs one is redesigned.
- **What a model's text can do to the page is this package's business**
  ([docs/security.md](docs/security.md)): a change to links, HTML or what a target writes keeps
  those guards, with a test.
- TypeScript is formatted by Oxfmt and linted by Oxlint: two spaces, 100 columns, single quotes, no
  semicolons, trailing commas. English only. Comments say why.

## Releases

- A change to the package carries a changeset (`bunx changeset`). `demo` and the examples take none.
- A tag `v<version>` publishes to npm, and a push to `main` that changes `site/`, `docs/` or the
  library publishes the site. Never tag, publish or push unasked.
- Localix Studio and Localix Cloud pin the published package: a change here reaches them only
  after a release and a version bump there.

## Before you say it is done

`bun run check`, and `bun run size` when code that ships changed. A failure names the file and the
rule: fix what it names, never the check.
