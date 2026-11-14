//! What a model is told so that it writes the forms read here. A model writes the forms it was
//! told of and no others. The text is the npm package's, written here by its `bun run prompt`
//! (the package's tests fail when this copy differs): one text teaches the dialect, whichever
//! parser reads the reply. Every marker it names is one `forms.rs` reads, and each example in it
//! is read by the tests into the form it shows.

/// The section that teaches a model the forms of a reply, for a system prompt or a context: a
/// heading, then a rule a line, an example under those a model cannot guess.
#[must_use]
pub fn prompt() -> &'static str {
    include_str!("prompt.md").trim_end()
}

#[cfg(test)]
#[path = "prompt_tests.rs"]
mod tests;
