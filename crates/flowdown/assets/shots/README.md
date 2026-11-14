# The README's pictures of a terminal

`steps`, `tabs`, `report` and `files` in `../` are these texts as Localix CLI's renderer draws
what this crate read, 64 columns wide, as SVG for a light page and a dark one. The renderer is
Localix CLI's, not this crate's: how a tree is drawn is the program's. To draw them again, copy
these texts into a checkout of [localix-cli](https://github.com/localixai/localix-cli) at
`packages/markdown/bench/shots/`, run `cargo run --release --bin shots` in that `bench/`, and copy
`../assets/{files,report,steps,tabs}-{light,dark}.svg` from there into this folder's parent.

A figure in `report.md` is one of `../../bench/results/`; change it when they change.
