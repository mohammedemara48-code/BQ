#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
parts_dir="$ROOT/scripts/lockfile-parts"
out="$ROOT/package-lock.json"
cat "$parts_dir"/part-* | tr -d '\n' | base64 -d | python3 -c 'import sys,zlib; sys.stdout.buffer.write(zlib.decompress(sys.stdin.buffer.read()))' > "$out"
echo "assembled $(wc -c < "$out") bytes -> package-lock.json"
