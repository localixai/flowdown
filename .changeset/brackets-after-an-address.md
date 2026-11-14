---
'@localix-ai/flowdown': patch
---

A long run of `)` after a bare address no longer stalls the page. Each `)` let go of the address
counted all of its brackets again, so 160 KB of them took six seconds to read; they are now counted
once, and an address with no `)` at its end is not counted at all. The case is in `limits.test.ts`,
and the bare links' ends are held to cmark-gfm's in `spec/github/bare-links.txt`, which the Rust
crate reads too.
