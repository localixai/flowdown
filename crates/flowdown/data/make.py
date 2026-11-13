#!/usr/bin/env python3
r"""Writes the two tables the parser reads, from their sources.

    data/make.py <pulldown-cmark clone>

entities.txt: every HTML5 character reference that ends with `;`, a line each, sorted by name
(bytewise): the name, then the code points it stands for, in hex. Read from pulldown-cmark's
table, itself made from https://html.spec.whatwg.org/entities.json.

punct.bin: the code points past ASCII that CommonMark calls punctuation (Unicode's general
categories P and S), as ranges: first and last, three bytes each, big-endian, sorted. From this
Python's `unicodedata`, whose Unicode version the script prints.

The specifications' examples the tests read are not made here: they are the repository's
`spec/`, the files the npm package's tests read too.
"""
import re
import sys
import unicodedata
from pathlib import Path

here = Path(__file__).parent
if len(sys.argv) != 2 or not (Path(sys.argv[1]) / "pulldown-cmark/src/entities.rs").is_file():
    sys.exit("usage: data/make.py <pulldown-cmark clone>")

source = (Path(sys.argv[1]) / "pulldown-cmark/src/entities.rs").read_text()
entities = []
for name, value in re.findall(r'\(b"(\w+)", "((?:\\u\{[0-9A-Fa-f]+\})+)"\)', source):
    points = re.findall(r"\\u\{([0-9A-Fa-f]+)\}", value)
    entities.append((name.encode(), " ".join(f"{int(point, 16):X}" for point in points)))
entities.sort()
(here / "entities.txt").write_text(
    "".join(f"{name.decode()} {points}\n" for name, points in entities)
)

ranges = []
start = None
for point in range(0x80, 0x110000):
    inside = unicodedata.category(chr(point))[0] in "PS"
    if inside and start is None:
        start = point
    if not inside and start is not None:
        ranges.append((start, point - 1))
        start = None
(here / "punct.bin").write_bytes(
    b"".join(first.to_bytes(3, "big") + last.to_bytes(3, "big") for first, last in ranges)
)

print(f"{len(entities)} entities, {len(ranges)} ranges of punctuation, "
      f"Unicode {unicodedata.unidata_version}")
