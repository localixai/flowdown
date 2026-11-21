use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// What the command was asked to do.
#[derive(Debug, Clone, PartialEq)]
pub enum Command {
    Count { path: PathBuf, top: usize },
    Help,
}

#[derive(Debug)]
pub struct Error(String);

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "error: {}", self.0)
    }
}

pub fn parse(args: &[String]) -> Result<Command, Error> {
    match args {
        [_, path] => Ok(Command::Count { path: PathBuf::from(path), top: 10 }),
        [_, path, flag, n] if flag == "--top" => {
            let top = n.parse::<usize>().map_err(|e| Error(e.to_string()))?;
            Ok(Command::Count { path: path.into(), top })
        }
        _ => Ok(Command::Help),
    }
}

fn count_words<'a>(text: &'a str) -> HashMap<&'a str, u32> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace().filter(|w| w.len() > 2) {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match parse(&args) {
        Ok(Command::Count { path, top }) => {
            let text = fs::read_to_string(&path).expect("readable file");
            let mut counts: Vec<_> = count_words(&text).into_iter().collect();
            counts.sort_by(|a, b| b.1.cmp(&a.1));
            for (word, n) in counts.iter().take(top) {
                println!("{n:>6} {word}");
            }
        }
        Ok(Command::Help) => eprintln!("usage: words <file> [--top N]"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    }
}
