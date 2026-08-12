#!/usr/bin/env bash
# Keep CommandCenter-main/supabase/functions in sync with the canonical
# /supabase/functions tree. Agents historically edited one copy and deployed
# the other — that is the #1 reason "merged" sports/RSS fixes never showed up.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/supabase/functions"
DST="$ROOT/CommandCenter-main/supabase/functions"

if [[ ! -d "$SRC" ]]; then
  echo "missing $SRC" >&2
  exit 1
fi

mkdir -p "$DST"
# Copy each function directory from canonical → mirror.
for dir in "$SRC"/*; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  rm -rf "$DST/$name"
  mkdir -p "$DST/$name"
  cp -a "$dir"/. "$DST/$name"/
done

echo "Synced edge functions → CommandCenter-main/supabase/functions"
if diff -rq "$SRC" "$DST"; then
  echo "OK: copies match"
else
  echo "WARNING: copies still differ" >&2
  exit 1
fi
