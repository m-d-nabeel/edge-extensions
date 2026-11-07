#!/usr/bin/env bash
# Builds store-ready zips in dist/: manifest.json at the zip root, runtime files only.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
pack() { # <folder> <zip-name>
  local dir=$1 name=$2
  local ver; ver=$(python3 -c "import json;print(json.load(open('$dir/manifest.json'))['version'])")
  local out="dist/$name-$ver.zip"
  rm -f "$out"
  # Exclude browser caches written by "Load unpacked", OS junk and dev files.
  (cd "$dir" && zip -qr -X "../$out" . \
      -x 'Cached Theme.pak' -x '*.DS_Store' -x '*/.*' -x '.*' -x '*.md' -x '*.map')
  echo "$out  ($(du -h "$out" | cut -f1))"
  unzip -Z1 "$out" | sed 's/^/    /'
}
pack tab-cycle    tab-cycle-mru
pack amoled-theme amoled-pure-black-theme-totality
