#!/bin/sh
# Records this example into docs/assets/readme/tui.gif, the terminal demo in the README:
#
#     bun run record
#
# Needs asciinema 3, agg and gifsicle (`brew install asciinema agg gifsicle`).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
out="$here/../../docs/assets/readme/tui.gif"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

bun run --cwd "$here/../../packages/llx-markdown" build > /dev/null

# The prompt and the typing are staged; what follows them is the example's own run.
cat > "$work/session.sh" <<SESSION
cd "$here"
prompt() { printf '\033[90m~/llx-markdown/examples/tui\033[39m \$ '; }
prompt
sleep 0.9
for c in b u n ' ' s t r e a m . t s; do printf '%s' "\$c"; sleep 0.055; done
sleep 0.45
printf '\r\n'
bun stream.ts
prompt
sleep 0.4
SESSION

# Black, with the sixteen colours of a dark terminal: background, foreground, then 0 to 15.
theme=000000,e6e6e6,2b2b2b,ff6b6b,7ee787,e3b341,6cb6ff,d2a8ff,56d4dd,d1d7e0,7d8590,ff938a,a5f3b0,f4d06f,96d0ff,e2c5ff,a5f3fc,ffffff

asciinema rec --headless --window-size 90x26 --quiet --overwrite \
  --command "sh $work/session.sh" "$work/tui.cast"
# The README shows it 760 pixels wide: a font of 28 makes it twice that, sharp on a dense screen.
agg --quiet --theme "$theme" --font-size 28 --fps-cap 20 --last-frame-duration 4 \
  "$work/tui.cast" "$work/tui.gif"
# A terminal has few colours: 48 keep the edges of the letters smooth at about half the size.
gifsicle -O3 --colors 48 "$work/tui.gif" -o "$out"
ls -l "$out" | awk '{ printf "%s  %.2f MB\n", $NF, $5 / 1048576 }'
