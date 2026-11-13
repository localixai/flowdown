#!/bin/sh
# The text the benchmarks read that is not ours to keep in the repository: pulldown-cmark's own
# benchmark document, from its sources at the release measured, into bench/data/, which git
# ignores. The CommonMark specification is the repository's own copy (spec/commonmark).
set -eu
cd "$(dirname "$0")"
mkdir -p data
if [ ! -d data/pulldown-cmark/.git ]; then
    git clone --quiet --depth 1 --branch v0.13.0 \
        https://github.com/pulldown-cmark/pulldown-cmark data/pulldown-cmark
fi
ls -l data/pulldown-cmark/pulldown-cmark/third_party/xi-editor/crdt.md
