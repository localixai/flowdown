//! Test-only: the examples of the specifications in the repository's `spec/`, the same files the
//! npm package's tests read: CommonMark's, and GitHub's for its extensions.

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
                found.push(Example { number, section, markdown, html });
            }
        } else if line.starts_with('#') && line.trim_start_matches('#').starts_with(' ') {
            section = line.trim_start_matches('#').trim().to_owned();
        }
    }
    found
}
