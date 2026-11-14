//! Test-only: the examples of the specifications in the repository's `spec/`, the same files the
//! npm package's tests read: CommonMark's, GitHub's for its extensions, and the dialect's forms,
//! printed as that file prints them.

use std::fmt::Write as _;

use crate::{Document, Kind, Node};

/// CommonMark 0.31.2, its 652 examples.
pub(crate) const COMMONMARK: &str = include_str!("../../../../spec/commonmark/spec.txt");

/// GitHub Flavored Markdown's specification: CommonMark as it stood, and its extensions.
pub(crate) const GITHUB: &str = include_str!("../../../../spec/github/gfm-spec.txt");

/// An example: its number in its file, its section, the Markdown and the HTML it reads as.
pub(crate) struct Example {
    pub(crate) number: usize,
    pub(crate) section: String,
    pub(crate) markdown: String,
    pub(crate) html: String,
}

impl Example {
    /// How a failure names it: `# 608 Autolinks`.
    pub(crate) fn name(&self) -> String {
        format!("# {} {}", self.number, self.section)
    }
}

/// The fence an example sits in: 32 backticks, then `example` and the extension it is about.
const FENCE: &str = "````````````````````````````````";

/// The examples of a specification, numbered as the specification numbers them: all of them, or
/// only those about an extension. GitHub's filter of raw HTML (`tagfilter`) is its renderer's,
/// not a way of reading Markdown, and is left out.
pub(crate) fn examples(spec: &str, extensions: bool) -> Vec<Example> {
    let mut found = Vec::new();
    let (mut section, mut number) = (String::new(), 0);
    let mut lines = spec.split_inclusive('\n');
    while let Some(line) = lines.next() {
        if let Some(tag) = line.trim_end().strip_prefix(FENCE) {
            let Some(tag) = tag.strip_prefix(" example") else {
                continue;
            };
            let (mut markdown, mut html) = (String::new(), String::new());
            for line in lines.by_ref().take_while(|line| line.trim_end() != ".") {
                markdown.push_str(&line.replace('\u{2192}', "\t"));
            }
            for line in lines.by_ref().take_while(|line| line.trim_end() != FENCE) {
                html.push_str(&line.replace('\u{2192}', "\t"));
            }
            number += 1;
            let tag = tag.trim();
            if tag.is_empty() != extensions && tag != "tagfilter" {
                let section = section.clone();
                found.push(Example {
                    number,
                    section,
                    markdown,
                    html,
                });
            }
        } else if line.starts_with('#') && line.trim_start_matches('#').starts_with(' ') {
            section = line.trim_start_matches('#').trim().to_owned();
        }
    }
    found
}

/// flowdown's own cases of GitHub's bare links, as cmark-gfm ends them.
pub(crate) const BARE_LINKS: &str = include_str!("../../../../spec/github/bare-links.txt");

/// The dialect's forms: their markers and the cases both parsers must read alike.
pub(crate) const FORMS: &str = include_str!("../../../../spec/forms/spec.txt");

/// The markers of `spec/forms/spec.txt`'s table, by name, each with the form it makes.
pub(crate) fn markers() -> Vec<(String, String)> {
    FORMS
        .lines()
        .filter_map(|line| line.strip_prefix("| `[!"))
        .filter_map(|rest| {
            let (name, rest) = rest.split_once("]` | ")?;
            let form = rest.split(" |").next()?;
            Some((name.to_owned(), form.to_owned()))
        })
        .collect()
}

/// The forms `doc` holds, one a line, as `spec/forms/spec.txt` prints them.
pub(crate) fn forms(doc: &Document<'_>) -> String {
    let mut out = String::new();
    forms_in(doc.root(), 0, &mut out);
    if out.is_empty() {
        out.push_str("(none)\n");
    }
    out
}

/// How many items the list a form took holds.
fn items(node: Node<'_>) -> usize {
    node.children()
        .find(|child| matches!(child.kind(), Kind::List { .. }))
        .map_or(0, |list| list.children().count())
}

#[expect(
    clippy::wildcard_enum_match_arm,
    reason = "a form other than a callout is printed by its kind's name, as the file writes it"
)]
fn forms_in(node: Node<'_>, depth: usize, out: &mut String) {
    for child in node.children() {
        let kind = child.kind();
        if !kind.is_form() {
            forms_in(child, depth, out);
            continue;
        }
        let name = match kind {
            Kind::Callout(callout) => format!("callout {}", format!("{callout:?}").to_lowercase()),
            other => format!("{other:?}").to_lowercase(),
        };
        write!(out, "{:width$}{name}", "", width = depth * 2).unwrap();
        if !child.title().is_empty() {
            write!(out, " \"{}\"", child.title()).unwrap();
        }
        if matches!(
            kind,
            Kind::Steps | Kind::Stats | Kind::Pros | Kind::Cons | Kind::Sources
        ) {
            write!(out, " {}", items(child)).unwrap();
        }
        out.push('\n');
        forms_in(child, depth + 1, out);
    }
}
