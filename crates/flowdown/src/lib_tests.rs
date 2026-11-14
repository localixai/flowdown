//! The examples of the CommonMark specification, and of GitHub's extensions to it: each read and
//! printed as HTML is what the specification gives.

use crate::testing::html;
use crate::testing::spec::{BARE_LINKS, COMMONMARK, Example, GITHUB, examples};
use crate::{Dialect, parse_as};

/// The examples that read otherwise than expected, each with what it gave.
fn failures(examples: &[Example], dialect: Dialect) -> Vec<String> {
    let mut failed = Vec::new();
    for example in examples {
        let (markdown, expected) = (&example.markdown, &example.html);
        let got = html(&parse_as(markdown, dialect));
        if got != *expected {
            failed.push(format!(
                "{}\n  markdown {markdown:?}\n  expected {expected:?}\n  got      {got:?}",
                example.name()
            ));
        }
    }
    failed
}

#[test]
fn every_example_of_commonmark_reads_as_the_specification_says() {
    let examples = examples(COMMONMARK, false);
    assert_eq!(examples.len(), 652);
    let failed = failures(&examples, Dialect::CommonMark);
    assert!(
        failed.is_empty(),
        "{} failed:\n{}",
        failed.len(),
        failed.join("\n")
    );
}

#[test]
fn commonmark_reads_the_same_with_githubs_extensions_on() {
    // But where an extension is what the example is about: a bare address, a tilde.
    let failed = failures(&examples(COMMONMARK, false), Dialect::Github);
    let known = ["# 608 Autolinks", "# 611 Autolinks"];
    let other: Vec<_> = failed
        .iter()
        .filter(|failure| !known.iter().any(|known| failure.starts_with(known)))
        .collect();
    assert!(other.is_empty(), "{} failed:\n{other:#?}", other.len());
}

#[test]
fn every_example_of_githubs_extensions_reads_as_github_says() {
    let examples = examples(GITHUB, true);
    assert_eq!(examples.len(), 23);
    let failed = failures(&examples, Dialect::Github);
    // A bare e-mail address is left as text: nothing an agent's reader does with one.
    let known = ["# 629 ", "# 630 ", "# 631 "];
    let other: Vec<_> = failed
        .iter()
        .filter(|failure| !known.iter().any(|known| failure.starts_with(known)))
        .collect();
    assert_eq!(failed.len() - other.len(), known.len(), "{failed:#?}");
    assert!(other.is_empty(), "{} failed:\n{other:#?}", other.len());
}

#[test]
fn a_text_cut_before_its_last_line_ending_reads_the_same() {
    // What a reply is while it still arrives: its last line has no ending yet.
    let mut differ = Vec::new();
    for example in examples(COMMONMARK, false) {
        let Some(cut) = example.markdown.strip_suffix('\n') else {
            continue;
        };
        // A line of blanks alone is not the same text without its ending.
        if cut.ends_with([' ', '\t', '\n']) {
            continue;
        }
        let (whole, cut) = (
            parse_as(&example.markdown, Dialect::Github),
            parse_as(cut, Dialect::Github),
        );
        if html(&whole) != html(&cut) {
            differ.push(example.name());
        }
    }
    assert!(differ.is_empty(), "{differ:#?}");
}

#[test]
fn a_last_line_with_no_ending_stays_a_cut_of_the_source() {
    for text in ["one\ntwo", "<div>\none\ntwo", "- one\n  two"] {
        let doc = parse_as(text, Dialect::Github);
        let mut node = doc.blocks().next().unwrap();
        while let Some(inner) = node.first() {
            node = inner;
        }
        let (source, read) = (text.as_bytes().as_ptr_range(), node.text().as_ptr());
        assert!(source.contains(&read), "{text:?}: {:?}", node.text());
    }
}

#[test]
fn a_bare_address_lets_go_of_what_trails_it_as_cmark_gfm_does() {
    let examples = examples(BARE_LINKS, true);
    assert!(examples.len() >= 6, "found only {}", examples.len());
    let failed = failures(&examples, Dialect::Github);
    assert!(
        failed.is_empty(),
        "{} failed:\n{}",
        failed.len(),
        failed.join("\n")
    );
}
