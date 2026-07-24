#!/usr/bin/env bash
# SessionStart hook — surface the outstanding-work memory into context.
#
# Reads docs/outstanding-issues.md (the /issues ledger) and prints a compact,
# glanceable summary of the RECOMMENDED EXECUTION QUEUE so every session starts
# aware of the ordered work still worth doing. When the trigger is a context reset
# (compact / resume / clear), it also emits a reminder to run `/issues capture` — that is the moment
# a session's in-flight follow-ups are most likely to be lost.
#
# Contract: READ-ONLY. Never writes, never commits, never fails a session — it
# always exits 0, and every step is guarded so a parse error just yields less
# output. SessionStart hook stdout is injected into the model's context.
set -uo pipefail

# --- locate the repo + ledger -------------------------------------------------
root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$root" ] && root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || true)"
ledger="$root/docs/outstanding-issues.md"
[ -f "$ledger" ] || exit 0

# --- read the hook payload (stdin JSON) to learn the trigger source -----------
payload="$(cat 2>/dev/null || true)"
source_val="$(printf '%s' "$payload" \
  | grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')"

# --- parse the "Recommended execution queue" table only ---------------------
# Emit "ORDER<TAB>ACUITY<TAB>SOURCE<TAB>OUTCOME<TAB>CLASSIFICATION" per row.
rows="$(awk '
  /^## Recommended execution queue/ { inqueue=1; next }
  /^## /                            { if (inqueue) inqueue=0 }
  inqueue && /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
    n=split($0, c, "|")
    ord=c[2]; src=c[3]; out=c[4]; acu=c[5]; cls=c[6]
    gsub(/^[ \t]+|[ \t]+$/, "", ord)
    gsub(/^[ \t]+|[ \t]+$/, "", src)
    gsub(/^[ \t]+|[ \t]+$/, "", out)
    gsub(/^[ \t]+|[ \t]+$/, "", acu)
    gsub(/^[ \t]+|[ \t]+$/, "", cls)
    printf "%s\t%s\t%s\t%s\t%s\n", ord, acu, src, out, cls
  }
' "$ledger" 2>/dev/null || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ]; then
  echo "[issues] Universal task ledger (docs/outstanding-issues.md): no recommended work."
  exit 0
fi

group() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$2==p'; }
count() { printf '%s' "$1" | grep -c . || true; }
p1="$(group P1)"; p2="$(group P2)"; p3="$(group P3)"
c1="$(count "$p1")"; c2="$(count "$p2")"; c3="$(count "$p3")"

echo "[issues] Universal task ledger — ${total} recommended (${c1}×P1, ${c2}×P2, ${c3}×P3). Source of truth: docs/outstanding-issues.md · read the full queue with /issues."

print_group() { # $1=rows  $2=max-to-list
  local data="$1" limit="$2" shown=0 more=0 ord acu src out cls
  [ -z "$data" ] && return 0
  while IFS=$'\t' read -r ord acu src out cls; do
    [ -z "$ord" ] && continue
    if [ "$shown" -lt "$limit" ]; then
      echo "  ${ord}. ${acu} ${src} — ${out} (${cls})"
      shown=$((shown + 1))
    else
      more=$((more + 1))
    fi
  done <<EOF
$data
EOF
  [ "$more" -gt 0 ] && echo "  … +${more} more at this priority (see /issues)"
  return 0
}

# Preserve queue order inside each acuity. P1 is listed in full, P2 up to 8, P3 as a count.
[ "$c1" -gt 0 ] && print_group "$p1" 999
[ "$c2" -gt 0 ] && print_group "$p2" 8
[ "$c3" -gt 0 ] && echo "  ${c3} × P3 (nice-to-have / revisit-when) — see /issues"

# --- capture reminder ---------------------------------------------------------
case "$source_val" in
  compact | resume | clear)
    echo "[issues] Context was just reset (${source_val}). Before this session wraps up, run /issues capture to record any new follow-ups, deferrals, or risks that surfaced so they aren't lost from memory."
    ;;
  *)
    echo "[issues] When the work in this session wraps up, offer to run /issues capture for any new follow-ups before the context is lost."
    ;;
esac
exit 0
