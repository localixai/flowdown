#!/bin/sh
# Every benchmark, its result written to results/: every parser built for speed (opt-level 3),
# as flowdown's workspace builds it, and the whole-text one again with all of them built for size
# (opt-level z). The texts are generated from fixed seeds, read from spec/ or fetched at a pinned
# release (fetch.sh), so the allocation counts are the same on every run; the times are the
# machine's.
set -eu
cd "$(dirname "$0")"
sh fetch.sh >/dev/null
mkdir -p results
cargo build --release --quiet --bins
target/release/parse --json=results/parse.json >results/parse.md
target/release/stream --json=results/stream.json >results/stream.md
for bench in constructs worst; do
    target/release/"$bench" >results/"$bench".md
done
cargo build --release --quiet --bin parse \
    --config 'profile.release.opt-level="z"' --target-dir target/size
target/size/release/parse >results/parse-size.md
# The crates each parser brings into a build, itself among them.
for parser in flowdown pulldown-cmark comrak; do
    echo "$parser $(cargo tree --edges normal --prefix none --package "$parser" | sort -u | wc -l | tr -d ' ')"
done >results/crates.txt
# The README's chart, from the numbers just written; then the numbers held to budgets.json.
target/release/charts
target/release/check
