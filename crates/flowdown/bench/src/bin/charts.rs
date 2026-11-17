//! The chart of the README, drawn from what `run.sh` just wrote (`results/parse.json`,
//! `results/stream.json`, `results/crates.txt`): each parser's time on a text and on a stream,
//! and what a project takes on with it. Panels three to a row, each with its own scale; dark, as
//! the lab shows every demo whatever the page's theme; an SVG and a PNG at twice the size, which
//! the README shows: an SVG's text is set in the reader's own fonts, a PNG's is the same everywhere.

use std::fmt::Write as _;
use std::fs;

use flowdown_bench::results::{field, figure};
use flowdown_bench::{count, shown, size};
use resvg::tiny_skia::{Pixmap, Transform};
use resvg::usvg::{Options, Tree};

struct Theme {
    name: &'static str,
    paper: &'static str,
    edge: &'static str,
    ink: &'static str,
    quiet: &'static str,
    ours: &'static str,
    theirs: &'static str,
}

/// The lab's neutral dark: greys with no blue cast.
const DARK: Theme = Theme {
    name: "dark",
    paper: "#0b0b0b",
    edge: "#2e2e2c",
    ink: "#f4f4f2",
    quiet: "#b0b0ad",
    ours: "#a594f9",
    theirs: "#3d3d3a",
};

/// The parsers drawn, as the results name them. `pulldown-cmark` with its events dropped: the
/// least it can be asked for.
const PARSERS: [&str; 3] = ["flowdown", "pulldown-cmark", "comrak"];

/// One panel: what was measured, and each parser's figure with how it reads.
struct Panel {
    title: &'static str,
    under: String,
    bars: Vec<(f64, String)>,
}

/// One section: its heading, what its figures are, its panels.
struct Section {
    title: &'static str,
    under: &'static str,
    panels: Vec<Panel>,
}

/// A panel of one figure of `json`'s rows for `text`, a bar a parser.
fn panel(
    json: &str,
    title: &'static str,
    text: &str,
    key: &str,
    under: &str,
    read: impl Fn(f64) -> String,
) -> Panel {
    let bars = PARSERS
        .iter()
        .map(|parser| figure(json, text, parser, key))
        .map(|value| (value, read(value)))
        .collect();
    let under = under
        .replace(
            "{size}",
            &size(figure(json, text, PARSERS[0], "bytes") as u64),
        )
        .replace(
            "{reads}",
            &json
                .lines()
                .find(|row| row.contains(text))
                .filter(|row| row.contains("\"reads\""))
                .map_or_else(String::new, |row| {
                    count(field(row, "reads").parse().expect("reads"))
                }),
        );
    Panel { title, under, bars }
}

fn sections() -> Vec<Section> {
    let read = |path: &str| fs::read_to_string(path).expect("run.sh writes the results first");
    let (parse, stream, crates) = (
        read("results/parse.json"),
        read("results/stream.json"),
        read("results/crates.txt"),
    );
    let brought = PARSERS
        .iter()
        .map(|parser| {
            let line = crates
                .lines()
                .find(|line| line.split(' ').next() == Some(parser))
                .expect("a parser's crates");
            let n: f64 = line
                .rsplit(' ')
                .next()
                .and_then(|n| n.parse().ok())
                .expect("a count");
            (n, format!("{n:.0}"))
        })
        .collect();
    vec![
        Section {
            title: "Reading speed",
            under: "the time to read one text whole, and one reply as it streams · shorter is better",
            panels: vec![
                panel(
                    &parse,
                    "Short answer",
                    "reply, 1 KB",
                    "ns",
                    "{size}, read once",
                    shown,
                ),
                panel(
                    &parse,
                    "Answer with forms",
                    "reply, 8 KB",
                    "ns",
                    "{size}, read once",
                    shown,
                ),
                panel(
                    &parse,
                    "Long report",
                    "reply, 64 KB",
                    "ns",
                    "{size}, read once",
                    shown,
                ),
                panel(
                    &parse,
                    "CommonMark specification",
                    "spec.txt",
                    "ns",
                    "{size}, read once",
                    shown,
                ),
                panel(
                    &stream,
                    "A reply as it streams",
                    "reply, 8 KB",
                    "ns",
                    "{size}, read again {reads} times",
                    shown,
                ),
                panel(
                    &stream,
                    "A long reply as it streams",
                    "reply, 128 KB",
                    "ns",
                    "{size}, read again {reads} times",
                    shown,
                ),
            ],
        },
        Section {
            title: "Weight",
            under: "what a project takes on · smaller is better",
            panels: vec![
                panel(
                    &parse,
                    "Allocations",
                    "reply, 64 KB",
                    "allocations",
                    "one read of the long report",
                    |n| count(n as u64),
                ),
                panel(
                    &parse,
                    "Memory asked for",
                    "reply, 64 KB",
                    "allocated",
                    "one read of the long report",
                    |n| size(n as u64),
                ),
                Panel {
                    title: "Crates it brings",
                    under: "into a build, itself among them".into(),
                    bars: brought,
                },
            ],
        },
    ]
}

const WIDE: f64 = 880.0;
const EDGE: f64 = 28.0;
const COLUMN: f64 = (WIDE - 2.0 * EDGE) / 3.0;
const LABELS: f64 = 102.0;
/// The longest bar: what a column leaves after the labels and the figure beside the bar.
const BAR: f64 = COLUMN - LABELS - 8.0 - 84.0;
const ROW: f64 = 22.0;
const PANEL: f64 = 46.0 + 3.0 * ROW + 26.0;

fn text(svg: &mut String, x: f64, y: f64, fill: &str, look: &str, words: &str) {
    let words = words.replace('&', "&amp;").replace('<', "&lt;");
    let _ = writeln!(
        svg,
        "<text x=\"{x:.1}\" y=\"{y:.1}\" fill=\"{fill}\" {look}>{words}</text>"
    );
}

fn draw(svg: &mut String, left: f64, top: f64, panel: &Panel, theme: &Theme) {
    text(
        svg,
        left,
        top + 14.0,
        theme.ink,
        "font-size=\"14\" font-weight=\"600\"",
        panel.title,
    );
    text(
        svg,
        left,
        top + 31.0,
        theme.quiet,
        "font-size=\"11.5\"",
        &panel.under,
    );
    let most = panel
        .bars
        .iter()
        .map(|(value, _)| *value)
        .fold(f64::MIN_POSITIVE, f64::max);
    for (index, (name, (value, shown))) in PARSERS.iter().zip(&panel.bars).enumerate() {
        let y = top + 46.0 + index as f64 * ROW;
        let ours = index == 0;
        let (fill, ink, weight) = match ours {
            true => (theme.ours, theme.ours, " font-weight=\"600\""),
            false => (theme.theirs, theme.ink, ""),
        };
        let wide = (value / most * BAR).max(3.0);
        text(
            svg,
            left + LABELS,
            y + 11.5,
            ink,
            &format!("font-size=\"12\" text-anchor=\"end\"{weight}"),
            name,
        );
        let _ = writeln!(
            svg,
            "<rect x=\"{:.1}\" y=\"{y:.1}\" width=\"{wide:.1}\" height=\"14\" rx=\"3\" fill=\"{fill}\"/>",
            left + LABELS + 8.0
        );
        text(
            svg,
            left + LABELS + 8.0 + wide + 7.0,
            y + 11.5,
            ink,
            &format!("font-size=\"12\"{weight}"),
            shown,
        );
    }
}

/// The fonts of an SVG a browser draws: the system's own, as the page around it is set.
const PAGE: &str = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
/// The fonts of the PNG, which `resvg` finds by their names: macOS's system font first (its
/// name there), so the PNG is the SVG as a Mac shows it, then fonts another system has.
const DRAWN: &str = "'System Font', 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

fn chart(sections: &[Section], notes: &[String], theme: &Theme, fonts: &str) -> String {
    let rows = |section: &Section| section.panels.len().div_ceil(3) as f64;
    let high = EDGE
        + sections
            .iter()
            .map(|section| 62.0 + rows(section) * PANEL)
            .sum::<f64>()
        + 14.0
        + notes.len() as f64 * 17.0
        + 14.0;
    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {WIDE:.0} {high:.0}\" width=\"{WIDE:.0}\" height=\"{high:.0}\" \
         font-family=\"{fonts}\">\n\
         <rect x=\"0.5\" y=\"0.5\" width=\"{:.0}\" height=\"{:.0}\" rx=\"12\" fill=\"{}\" stroke=\"{}\"/>\n",
        WIDE - 1.0,
        high - 1.0,
        theme.paper,
        theme.edge
    );
    let rule = |svg: &mut String, y: f64| {
        let _ = writeln!(
            svg,
            "<rect x=\"{EDGE:.0}\" y=\"{y:.1}\" width=\"{:.0}\" height=\"1\" fill=\"{}\"/>",
            WIDE - 2.0 * EDGE,
            theme.edge
        );
    };
    let mut top = EDGE;
    for section in sections {
        text(
            &mut svg,
            EDGE,
            top + 16.0,
            theme.ink,
            "font-size=\"17\" font-weight=\"700\"",
            section.title,
        );
        text(
            &mut svg,
            EDGE,
            top + 34.0,
            theme.quiet,
            "font-size=\"12\"",
            section.under,
        );
        rule(&mut svg, top + 44.0);
        top += 62.0;
        for (index, panel) in section.panels.iter().enumerate() {
            let (column, row) = ((index % 3) as f64, (index / 3) as f64);
            draw(
                &mut svg,
                EDGE + column * COLUMN,
                top + row * PANEL,
                panel,
                theme,
            );
        }
        top += rows(section) * PANEL;
    }
    rule(&mut svg, top - 8.0);
    for (index, note) in notes.iter().enumerate() {
        text(
            &mut svg,
            EDGE,
            top + 12.0 + index as f64 * 17.0,
            theme.quiet,
            "font-size=\"11.5\"",
            note,
        );
    }
    svg.push_str("</svg>\n");
    svg
}

fn main() {
    let sections = sections();
    // The third line of the whole-text result: the machine it was taken on.
    let machine = fs::read_to_string("results/parse.md")
        .ok()
        .and_then(|text| text.lines().nth(2).map(str::to_owned));
    let notes = [
        "Each panel has its own scale; the number beside a bar is the measurement. Every figure comes from a binary in bench/.".to_owned(),
        "pulldown-cmark gives events and builds no tree: its events are dropped as they come, the least it can be asked for.".to_owned(),
        format!("Every parser built for speed (opt-level 3, fat LTO); the median of 51 rounds. {}.", machine.unwrap_or_default()),
    ];
    fs::create_dir_all("../assets").unwrap();
    let mut options = Options::default();
    options.fontdb_mut().load_system_fonts();
    let theme = &DARK;
    let drawn = png(&chart(&sections, &notes, theme, DRAWN), &options);
    fs::write(format!("../assets/compare-{}.png", theme.name), drawn).unwrap();
    fs::write(
        format!("../assets/compare-{}.svg", theme.name),
        chart(&sections, &notes, theme, PAGE),
    )
    .unwrap();
}

/// The chart as a PNG, two pixels to a unit, in the fonts of the machine that draws it.
fn png(svg: &str, options: &Options) -> Vec<u8> {
    const SCALE: f32 = 2.0;
    let tree = Tree::from_str(svg, options).expect("the chart is SVG");
    let size = tree.size();
    let (wide, high) = (
        (size.width() * SCALE).ceil() as u32,
        (size.height() * SCALE).ceil() as u32,
    );
    let mut pixels = Pixmap::new(wide, high).expect("a chart has a size");
    resvg::render(
        &tree,
        Transform::from_scale(SCALE, SCALE),
        &mut pixels.as_mut(),
    );
    pixels.encode_png().expect("pixels encode")
}
