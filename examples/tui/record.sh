#!/bin/sh
# Records the terminal demos of the README into docs/assets/readme:
#
#     bun run record          both
#     bun run record pair     one of them: tui or pair
#
#   tui.gif            this example as it runs: every form of the dialect
#   pair-terminal.gif  the same run in a narrow window, the terminal half of the README's first picture
#
# That picture, pair.gif, is a page streaming the same reply with pair-terminal.gif beside it: after
# recording `pair`, run `bun run shots pair` in demo to capture the page to this recording's size,
# length and pace and join the two.
#
# Needs asciinema 3, agg and gifsicle (`brew install asciinema agg gifsicle`).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
assets="$here/../../docs/assets/readme"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
wanted=${1:-all}

bun run --cwd "$here/../../packages/flowdown" build > /dev/null

# Black, with the sixteen colours of a dark terminal: background, foreground, then 0 to 15.
theme=000000,e6e6e6,2b2b2b,ff6b6b,7ee787,e3b341,6cb6ff,d2a8ff,56d4dd,d1d7e0,7d8590,ff938a,a5f3b0,f4d06f,96d0ff,e2c5ff,a5f3fc,ffffff

# record <name> <columns>x<rows> <seconds the last frame is held>: runs $work/<name>.sh in a
# terminal of that size. A font of 28 draws a column 17 pixels wide, twice the size the README
# shows it at, sharp on a dense screen. A terminal has few colours: 48 keep the edges of the
# letters smooth at about half the size.
record() {
  asciinema rec --headless --window-size "$2" --quiet --overwrite \
    --command "sh $work/$1.sh" "$work/$1.cast"
  agg --quiet --theme "$theme" --font-size 28 --fps-cap 20 --last-frame-duration "$3" \
    "$work/$1.cast" "$work/$1.gif"
  gifsicle -O3 --colors 48 "$work/$1.gif" -o "$assets/$1.gif"
  ls -l "$assets/$1.gif" | awk '{ printf "%s  %.2f MB\n", $NF, $5 / 1048576 }'
}

if [ "$wanted" = all ] || [ "$wanted" = tui ]; then
  # The prompt and the typing are staged; what follows them is the example's own run.
  cat > "$work/tui.sh" <<SESSION
cd "$here"
prompt() { printf '\033[90m~/flowdown/examples/tui\033[39m \$ '; }
prompt
sleep 0.9
for c in b u n ' ' s t r e a m . t s; do printf '%s' "\$c"; sleep 0.055; done
sleep 0.45
printf '\r\n'
bun stream.ts
prompt
sleep 0.4
SESSION
  record tui 90x26 4
fi

if [ "$wanted" = all ] || [ "$wanted" = pair ]; then
  # The same run with nothing staged, in a window half as wide: fifty columns are the 440 pixels
  # the page beside it is drawn in. When it ends the cursor comes back; the held frame has none.
  cat > "$work/pair-terminal.sh" <<SESSION
cd "$here"
bun stream.ts
printf '\033[?25l'
sleep 0.1
SESSION
  record pair-terminal 50x28 3
fi
