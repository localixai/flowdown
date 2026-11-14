//! The results `run.sh` writes, read back: a row of JSON a line, each a text, a parser and what
//! was measured. The chart (`charts`) and the budgets (`check`) read them the same way.

/// The value of `"key": ` in one row of a result's JSON.
pub fn field<'a>(row: &'a str, key: &str) -> &'a str {
    let from = row.find(&format!("\"{key}\": ")).expect("the key") + key.len() + 4;
    let rest = &row[from..];
    let rest = rest.strip_prefix('"').map_or_else(
        || &rest[..rest.find([',', '}']).unwrap_or(rest.len())],
        |text| &text[..text.find('"').expect("a closing quote")],
    );
    rest.trim()
}

/// The rows of `json`, each a text measured.
pub fn rows(json: &str) -> impl Iterator<Item = &str> {
    json.lines().filter(|row| row.contains("\"text\""))
}

/// The texts of `json`, in the order measured, each once.
pub fn texts(json: &str) -> Vec<&str> {
    let mut texts: Vec<&str> = vec![];
    for text in rows(json).map(|row| field(row, "text")) {
        if !texts.contains(&text) {
            texts.push(text);
        }
    }
    texts
}

/// A number of the row of `json` for `text` and `parser`.
pub fn figure(json: &str, text: &str, parser: &str, key: &str) -> f64 {
    let row = rows(json)
        .find(|row| field(row, "text") == text && field(row, "parser") == parser)
        .unwrap_or_else(|| panic!("no row for {text} and {parser}"));
    field(row, key).parse().expect("a number")
}
