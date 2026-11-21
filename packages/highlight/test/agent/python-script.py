#!/usr/bin/env python3
"""Summarize a CSV of orders by customer and month."""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class Summary:
    customer: str
    totals: dict[str, float] = field(default_factory=dict)

    @property
    def grand_total(self) -> float:
        return sum(self.totals.values())


def read_orders(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def summarize(rows: list[dict[str, str]]) -> dict[str, Summary]:
    summaries: dict[str, Summary] = defaultdict(lambda: Summary(customer=""))
    for row in rows:
        month = datetime.fromisoformat(row["date"]).strftime("%Y-%m")
        summary = summaries[row["customer"]]
        summary.customer = row["customer"]
        summary.totals[month] = summary.totals.get(month, 0.0) + float(row["amount"])
    return dict(summaries)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="orders file")
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args(argv)

    if not args.csv.exists():
        print(f"error: {args.csv} not found", file=sys.stderr)
        return 1

    summaries = summarize(read_orders(args.csv))
    ranked = sorted(summaries.values(), key=lambda s: s.grand_total, reverse=True)
    for index, summary in enumerate(ranked[: args.top], start=1):
        print(f"{index:>3}. {summary.customer:<20} {summary.grand_total:>10.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
