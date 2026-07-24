#!/usr/bin/env bash
# SessionStart hook — surface the outstanding-work memory into context.
#
# Reads docs/outstanding-issues.md (the /issues ledger) and prints a compact,
# glanceable summary of the OPEN items so every session starts already aware of
# what is outstanding. When the trigger is a context reset (compact / resume /
# clear) it also emits a reminder to run `/issues capture` — that is the moment
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

# --- parse the "Open items" table only ---------------------------------------
# Emit "PRI<TAB>ID<TAB>TYPE<TAB>SUMMARY" per open row. Scoped between the
# "## Open items" heading and the next "## " heading so the Resolved/archive
# table (different columns) is never counted.
rows="$(awk '
  /^## Open items/       { inopen=1; next }
  /^## /                 { if (inopen) inopen=0 }
  inopen && /^\| #[0-9]/  {
    n=split($0, c, "|")
    id=c[2]; pri=c[3]; typ=c[4]; sum=c[5]
    gsub(/^[ \t]+|[ \t]+$/, "", id)
    gsub(/^[ \t]+|[ \t]+$/, "", pri)
    gsub(/^[ \t]+|[ \t]+$/, "", typ)
    gsub(/^[ \t]+|[ \t]+$/, "", sum)
    printf "%s\t%s\t%s\t%s\n", pri, id, typ, sum
  }
' "$ledger" 2>/dev/null || true)"

# --- parse the recommended execution queue ----------------------------------
queue_rows="$(awk '
  /^## Recommended execution queue/ { inqueue=1; next }
  /^## /                            { if (inqueue) inqueue=0 }
  inqueue && /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
    n=split($0, c, "|")
    ord=c[2]; ids=c[3]; acuity=c[4]; capability=c[5]; timing=c[6]
    gsub(/^[ \t]+|[ \t]+$/, "", ord)
    gsub(/^[ \t]+|[ \t]+$/, "", ids)
    gsub(/^[ \t]+|[ \t]+$/, "", acuity)
    gsub(/^[ \t]+|[ \t]+$/, "", capability)
    gsub(/^[ \t]+|[ \t]+$/, "", timing)
    printf "%s\t%s\t%s\t%s\t%s\n", ord, ids, acuity, capability, timing
  }
' "$ledger" 2>/dev/null || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ]; then
  echo "[issues] Outstanding-work memory (docs/outstanding-issues.md): no open items. Record one with /issues add …"
  exit 0
fi

group() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$1==p'; }
count() { printf '%s' "$1" | grep -c . || true; }
p1="$(group P1)"; p2="$(group P2)"; p3="$(group P3)"
c1="$(count "$p1")"; c2="$(count "$p2")"; c3="$(count "$p3")"

echo "[issues] Outstanding-work memory — ${total} open (${c1}×P1, ${c2}×P2, ${c3}×P3). Source of truth: docs/outstanding-issues.md · read the full list back with /issues."

queue_total="$(printf '%s' "$queue_rows" | grep -c . || true)"
if [ "${queue_total:-0}" -gt 0 ]; then
  echo "[issues] Recommended execution queue — ${queue_total} retained tasks (first 8):"
  printf '%s\n' "$queue_rows" | head -n 8 | while IFS=$'\t' read -r ord ids acuity capability timing; do
    echo "  ${ord}. ${ids} · ${acuity} · ${timing} · ${capability}"
  done
fi

print_group() { # $1=rows  $2=max-to-list
  local data="$1" limit="$2" shown=0 more=0 pri id typ sum
  [ -z "$data" ] && return 0
  while IFS=$'\t' read -r pri id typ sum; do
    [ -z "$pri" ] && continue
    if [ "$shown" -lt "$limit" ]; then
      echo "  ${pri} ${id} ${typ} — ${sum}"
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

# P1 = do-next, list all. P2 = should-do, list up to 8. P3 = collapse to a count.
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
