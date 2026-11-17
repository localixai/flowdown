# AGENTS.md

Instructions for AI coding agents working on this repository.

`@localix-ai/flowdown` is streaming Markdown for React and terminals: its own parser, no
dependencies. The Rust crate `flowdown` reads the same dialect into a tree, for programs in Rust.
[CONTRIBUTING.md](CONTRIBUTING.md) is what a change has to keep, and it binds an agent as it binds
a person: read it before a change to either. This file says where things are and how to work here.

## Layout

- `packages/flowdown`: the library, the one npm package. In `src/`, `engine`, `core`,
  `document` and `render` know no framework and no page; `static`, `dom`, `element`, `react` and
  `tui` are the targets, and each names only what is under it. `layers.test.ts` holds the table.
- `crates/flowdown`: the Rust crate, a parser into a tree with no dependency, in the Cargo
  workspace at the root (`Cargo.toml`, `rust-toolchain.toml`, `clippy.toml`). Its own README says
  what it reads and how fast; `bench/` there is a crate of its own against `pulldown-cmark` and
  `comrak`. Came from Localix CLI's `packages/markdown` on 2026-11-14, with its history.
- `spec/`: what both parsers are held to, one copy read by both test suites: CommonMark's and
  GitHub's specifications, and `forms/spec.txt`, the dialect's forms with the cases both must
  read alike ([spec/README.md](spec/README.md)).
- `bench/`: the benchmarks, their budgets (`budgets.json`), and the scripts every published figure
  comes from.
- `docs/`: the documentation, each file a page of the site.
- `site/`: flowdown.localix.ai, with its own guide ([site/AGENTS.md](site/AGENTS.md)) and its own
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

The Rust crate, from the root:

```sh
crates/flowdown/scripts/check   # fmt, clippy, tests, docs, the wasm build, the package's files
cargo test --locked             # the tests; one: cargo test --locked <name>
sh crates/flowdown/bench/run.sh # every benchmark, into crates/flowdown/bench/results/
bun run --cwd packages/flowdown prompt         # the crate's prompt.md, from the package's prompt
bun run --cwd packages/flowdown crate-tables   # the crate's data/, from the package's tables
```

CI runs the check and the tests on the crate's `rust-version` (`.github/workflows/rust.yml`).

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
- **One dialect, two parsers.** A change to what the dialect is starts in `spec/forms/spec.txt`
  and reaches both parsers in the same commit; both suites run its cases and check their list of
  markers against its table. The crate's prompt and tables are written from the package's
  (`prompt`, `crate-tables`), never edited by hand: the package's tests fail when they differ.
- **One README.** The package's README on npm is the repository's, its links made absolute and
  its Development section left out: change `README.md` at the root, then `bun run --cwd
  packages/flowdown readme`. `src/readme.test.ts` fails when the copy differs.
- TypeScript is formatted by Oxfmt and linted by Oxlint: two spaces, 100 columns, single quotes, no
  semicolons, trailing commas. English only. Comments say why.

### The Rust crate

Each rule has an id; cite it in a commit or a review that touches it. _Checked_ means a check
fails when it is broken.

- **R1** _checked_: no panic in working code: no `unwrap`, `expect`, `panic!`, `unreachable!`, no
  string sliced inside a character, no number cut by `as`. Whatever a model wrote, reading it
  never crashes the program that draws it; any text is a document.
- **R2**: no dependency at all. A change that needs one is redesigned.
- **R3** _checked_ (`tests/repo.rs`): at most 300 lines of working code a file and 100 a
  function, 5,000 in all. A change that does not fit removes code first.
- **R4** _checked_: the lints in the root `Cargo.toml` are denied and never turned off there; an
  exception is an `expect` with its `reason`, on the smallest item. No `unsafe`, every public
  item documented.
- **R5** _checked_: every file opens with a `//!` that says what it is; `x.rs` sits beside its
  directory `x/`, never `x/mod.rs`; unit tests live in `x_tests.rs`, wired by
  `#[cfg(test)] #[path = "x_tests.rs"] mod tests;`; English only (another script in a test is an
  escape, `\u{43f}`).
- **R6** _checked_: the library does no I/O and keeps no state between calls: a `Document` is
  `Send + Sync`.
- **R7**: time and memory grow with the text, whatever it is. A construct that could be read again
  has a bound, and `bench/` measures texts built to be slow (`worst`).

## Releases

- A change to the package carries a changeset (`bunx changeset`). `demo` and the examples take none.
- A tag `v<version>` publishes to npm and makes the GitHub release from the changelog, and a push
  to `main` that changes `site/`, `docs/` or the library publishes the site. Never tag, publish or
  push unasked.
- The crate has versions of its own: a change to it is written under "Unreleased" in
  `crates/flowdown/CHANGELOG.md`, and a tag `rust-v<version>` (the version in its `Cargo.toml`)
  releases it on GitHub (`rust-release.yml`). Programs take it by that tag:
  `flowdown = { git = "https://github.com/localixai/flowdown", tag = "rust-v0.1.0" }`. Not on
  crates.io yet. Localix CLI takes it so, and keeps no copy of its own.
- Localix Studio and Localix Cloud pin the published package: a change here reaches them only
  after a release and a version bump there.

## Before you say it is done

`bun run check`, and `bun run size` when code that ships changed; `crates/flowdown/scripts/check`
when the crate, `spec/`, `docs/rust.md` (its examples are the crate's doctests) or the Cargo files
changed. A failure names the file and the rule: fix what
it names, never the check.
