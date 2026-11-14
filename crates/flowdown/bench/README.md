# The benchmarks

A crate of its own, outside the workspace: `pulldown-cmark`, `comrak` and `resvg` never reach a
build of flowdown.

```sh
sh run.sh        # everything, into results/ and ../assets/
cargo run --release --bin check              # the results held to budgets.json
cargo run --release --bin parse -- --quick   # one of them, five rounds
```

| Binary | What it measures |
| --- | --- |
| `parse` | each text read whole, once: the median time, and what one read asks of the allocator |
| `constructs` | one construct repeated to 64 KB: nanoseconds a byte |
| `stream` | a reply read again from its start as each piece of it arrives |
| `worst` | texts built to be slow, at one size and at four times it |
| `check` | the committed `results/` held to [`budgets.json`](budgets.json): the README's claims, checked on the numbers they were copied from; CI runs it |
| `charts` | `../assets/compare-*.svg` and, drawn from it by `resvg` at twice the size, `compare-*.png`: the README's chart, from `results/parse.json`, `results/stream.json` and `results/crates.txt` (the crates each parser brings, counted by `run.sh`) |

The texts are generated from fixed seeds (`src/corpus.rs`), read from the repository
(`spec/commonmark/spec.txt`) or fetched at a pinned release (`fetch.sh`: pulldown-cmark's own
benchmark document), so every run reads the same bytes and the allocation counts never change. Each
parser is asked for the same thing (`src/parsers.rs`): the whole text read with GitHub's tables,
strikethrough, task lists and alerts on. `pulldown-cmark` gives events and builds no tree, so it is
measured twice: its events dropped, and kept in a `Vec`, the nearest it has to a tree one can walk
twice. Ours is measured built, and built then walked with every node's text read.

Every parser is built for speed (`opt-level = 3`, fat LTO), as flowdown's workspace builds it;
`parse` is run again with all of them built for size (`opt-level = "z"`), as a program that ships
small binaries builds them.
Record results on an idle machine.
