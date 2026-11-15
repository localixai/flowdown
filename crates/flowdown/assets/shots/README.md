# The README's pictures of a terminal

`steps`, `tabs`, `report` and `files` in `../` are these texts as Localix CLI's renderer draws
what this crate read, 64 columns wide, as SVG for a light page and a dark one. The renderer is
Localix CLI's, not this crate's: how a tree is drawn is the program's. To draw them again, in a checkout of
[localix-cli](https://github.com/localixai/localix-cli) beside this repository:

```sh
cargo run --release --manifest-path scripts/shots/Cargo.toml -- \
  ../flowdown/crates/flowdown/assets/shots ../flowdown/crates/flowdown/assets
```

It writes `{files,report,steps,tabs}-{light,dark}.svg` into this folder's parent.

A figure in `report.md` is one of `../../bench/results/`; change it when they change.
