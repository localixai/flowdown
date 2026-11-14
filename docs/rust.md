---
title: The Rust crate
description:
  The same dialect read into a tree by a Rust crate with no dependency — how to take it, what the
  tree holds, the prompt it teaches, and how it is held to the npm package.
---

# The Rust crate

flowdown is also a Rust crate: a parser that reads what a model writes into a tree, for a terminal,
a server or an agent written in Rust. It reads the same Markdown and the same forms as the npm
package, passes the same cases and teaches a model with the same prompt. It has no dependency at
all and does no I/O; how it is drawn is the program's.

## Taking it

The crate is taken from this repository by its tag; it is not on crates.io yet.

```toml
[dependencies]
flowdown = { git = "https://github.com/localixai/flowdown", tag = "rust-v0.1.0" }
```

It builds on Rust 1.89 and later, and for `wasm32-unknown-unknown`. Its versions are its own,
apart from the npm package's: [its changelog](https://github.com/localixai/flowdown/blob/main/crates/flowdown/CHANGELOG.md)
says what each holds.

## Reading a reply

```rust
use flowdown::{Callout, Kind, parse};

let doc = parse("> [!WARNING] Downtime\n> The table is locked.\n");
let callout = doc.blocks().next().unwrap();
assert_eq!(callout.kind(), Kind::Callout(Callout::Warning));
assert_eq!(callout.title(), "Downtime");
```

- `parse(text)` reads a reply: GitHub's Markdown, the forms and formulas. `parse_as(text,
  dialect)` takes `Dialect::CommonMark`, `Dialect::Github` or `Dialect::Reply`.
- Any text is a document: nothing fails, and a reply cut mid-stream reads as far as it goes. A
  program that draws a reply as it arrives reads the whole text again on every piece; the crate is
  built for that.
- A `Node` is a place in the tree, `Copy`: its `kind()`, its `text()`, `info()`, `dest()`,
  `title()` (a form's title and a tab's label too), `start()` and `aligns()`, then its
  `children()`.
- `Kind` is matched exhaustively: a renderer that forgets a node does not compile.

## The forms

The forms are in the tree as what they are: `Kind::Callout`, `Steps`, `Tabs` (its children are
`Kind::Tab`, each with its label), `Stats`, `Pros`, `Cons`, `Details` and `Sources`, each holding
what it took. The markers, what each takes and when a quote stays a quote are those of
[the syntax](syntax.md); `spec/forms/spec.txt` in the repository holds the cases both parsers
read alike.

## The prompt

`flowdown::prompt()` is the section that teaches a model the forms, for a system prompt: the same
text as `answerFormatPrompt({ math: true })` of [the prompt entry](prompting.md), written into the
crate from it. The crate's tests read every example in it into the form it shows.

## One dialect, two parsers

The npm package and the crate are two parsers, in two languages, of one dialect. They are held to
the same files, in the repository's `spec/`:

- CommonMark's 652 examples and GitHub's extensions, run by both test suites.
- `spec/forms/spec.txt`: the forms, the table of their markers, and cases whose expected result is
  the forms a text holds. Each suite prints its own tree that way and checks its list of markers
  against the table.
- The crate's prompt, its named references and its Unicode punctuation are written from the
  package's, and the package's tests fail when they differ.

## Speed

The crate is measured against `pulldown-cmark` and `comrak`, the Rust parsers a program would
otherwise take, on replies of 1 KB to 512 KB, pulldown-cmark's own benchmark text and the
CommonMark specification:

| Parser | Gives | Throughput | Allocations |
| --- | --- | ---: | ---: |
| `flowdown` | a tree | 427 MB/s | 89 |
| `pulldown-cmark` | events | 356 MB/s | 262 |
| `comrak` | a tree | 89 MB/s | 217,548 |

A 128 KB reply read again from its start as each of its 4,098 pieces arrives takes 485 ms in all,
against 729 ms and 3.09 s. Every figure, how it is taken and where the lead is small are in
[the crate's README](https://github.com/localixai/flowdown/tree/main/crates/flowdown#measured),
from `crates/flowdown/bench/results/`.
