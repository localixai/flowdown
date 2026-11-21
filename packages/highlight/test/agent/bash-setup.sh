#!/usr/bin/env bash
# Set up a development machine for the project.
set -euo pipefail

REPO_URL="https://github.com/example/app.git"
TARGET_DIR="${1:-$HOME/src/app}"
NODE_VERSION=20

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$*"
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing: $1" >&2
    exit 1
  fi
}

require git
require curl

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  log "Cloning into $TARGET_DIR"
  git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
else
  log "Updating $TARGET_DIR"
  git -C "$TARGET_DIR" pull --ff-only
fi

cd "$TARGET_DIR"

for file in .env.example config/*.sample; do
  [ -e "$file" ] || continue
  cp -n "$file" "${file%.example}"
done

cat > .nvmrc <<EOF
$NODE_VERSION
EOF

case "$(uname -s)" in
  Darwin) brew install jq ;;
  Linux) sudo apt-get install -y jq ;;
  *) echo "unsupported system" && exit 1 ;;
esac

npm ci --no-audit
npm run build -- --mode production
log "Done in $SECONDS seconds"
