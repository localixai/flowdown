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

asciinema rec --headless --window-size 100x30 --quiet --overwrite \
  --command "sh $work/session.sh" "$work/tui.cast"
agg --quiet --theme dracula --fps-cap 20 --last-frame-duration 4 "$work/tui.cast" "$work/tui.gif"
# A terminal has few colours: 32 hold every one of them, and the file is under half its size.
gifsicle -O3 --colors 32 "$work/tui.gif" -o "$out"
ls -l "$out" | awk '{ printf "%s  %.2f MB\n", $NF, $5 / 1048576 }'
