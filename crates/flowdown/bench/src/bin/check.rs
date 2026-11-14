//! The committed results held to `budgets.json`: what the README claims, checked on the numbers
//! it was copied from. Times are not taken here (a shared runner's say little); `run.sh` takes
//! them, and this reads what it wrote. Exits 1 and names each rule broken.
//!
//!     cargo run --release --bin check

use std::fs;
use std::process::ExitCode;

use flowdown_bench::results::{field, figure, rows, texts};

const OURS: &str = "flowdown";
const PULLDOWN: &str = "pulldown-cmark";
const COMRAK: &str = "comrak";

fn read(path: &str) -> String {
    let at = concat!(env!("CARGO_MANIFEST_DIR"), "/");
    fs::read_to_string(format!("{at}{path}")).unwrap_or_else(|err| panic!("{path}: {err}"))
}

/// A budget's number, by its rule's id and its key.
fn budget(budgets: &str, id: &str, key: &str) -> f64 {
    let row = budgets
        .lines()
        .find(|row| row.contains(&format!("\"id\": \"{id}\"")))
        .unwrap_or_else(|| panic!("no rule {id} in budgets.json"));
    field(row, key).parse().expect("a number")
}

/// Bytes a second over every text of `json`, for `parser`.
fn throughput(json: &str, parser: &str) -> f64 {
    let rows: Vec<&str> = rows(json)
        .filter(|row| field(row, "parser") == parser)
        .collect();
    let bytes: f64 = rows
        .iter()
        .map(|row| field(row, "bytes").parse::<f64>().expect("bytes"))
        .sum();
    let ns: f64 = rows
        .iter()
        .map(|row| field(row, "ns").parse::<f64>().expect("ns"))
        .sum();
    bytes / ns
}

/// How many times the cost grew at four times the size, for each text built to be slow.
fn growths(worst: &str) -> Vec<(String, f64)> {
    worst
        .lines()
        .filter(|line| {
            line.starts_with("| ") && !line.starts_with("| Text") && !line.starts_with("| ---")
        })
        .filter_map(|line| {
            let cells: Vec<&str> = line.split('|').map(str::trim).collect();
            let grows = cells.get(5)?.strip_suffix('x')?.parse().ok()?;
            Some(((*cells.get(1)?).to_owned(), grows))
        })
        .collect()
}

fn broken(budgets: &str) -> Vec<String> {
    let (parse, stream, worst) = (
        read("results/parse.json"),
        read("results/stream.json"),
        read("results/worst.md"),
    );
    let mut broken = vec![];
    let min = budget(budgets, "never-slower", "min");
    for text in texts(&parse) {
        let lead = figure(&parse, text, PULLDOWN, "ns") / figure(&parse, text, OURS, "ns");
        if lead < min {
            broken.push(format!(
                "never-slower: {text}, {lead:.2}x pulldown-cmark's speed"
            ));
        }
        let allocations = figure(&parse, text, OURS, "allocations");
        if allocations > budget(budgets, "few-allocations", "max") {
            broken.push(format!(
                "few-allocations: {text}, {allocations} allocations"
            ));
        }
    }
    let ours = throughput(&parse, OURS);
    for (parser, key) in [(PULLDOWN, "pulldown"), (COMRAK, "comrak")] {
        let lead = ours / throughput(&parse, parser);
        if lead < budget(budgets, "corpus-lead", key) {
            broken.push(format!(
                "corpus-lead: {lead:.2}x {parser}'s speed over the corpus"
            ));
        }
    }
    for text in texts(&stream) {
        let lead = figure(&stream, text, PULLDOWN, "ns") / figure(&stream, text, OURS, "ns");
        if lead < budget(budgets, "stream", "min") {
            broken.push(format!("stream: {text}, {lead:.2}x pulldown-cmark's speed"));
        }
        let slowest = figure(&stream, text, OURS, "slowest") / 1e6;
        if slowest > budget(budgets, "stream", "slowest_ms") {
            broken.push(format!("stream: {text}, a read of {slowest:.2} ms"));
        }
    }
    let grown = growths(&worst);
    assert!(
        grown.len() > 10,
        "found only {} texts in results/worst.md",
        grown.len()
    );
    for (text, grows) in grown {
        if grows > budget(budgets, "linear", "max") {
            broken.push(format!(
                "linear: {text} grows {grows}x at four times the size"
            ));
        }
    }
    broken
}

fn main() -> ExitCode {
    let broken = broken(&read("budgets.json"));
    if broken.is_empty() {
        println!("the results hold to budgets.json");
        return ExitCode::SUCCESS;
    }
    for rule in &broken {
        println!("broken: {rule}");
    }
    ExitCode::FAILURE
}
