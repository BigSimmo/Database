#!/usr/bin/env bash
# SessionStart hook — surface the universal task ledger into context.
#
# Reads docs/outstanding-issues.md and prints a compact summary of the active Prioritised queue.
# On compact/resume/clear it also reminds the agent to capture new follow-ups.
#
# Contract: READ-ONLY. Never writes, never commits, never fails a session.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$root" ] && root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || true)"
ledger="$root/docs/outstanding-issues.md"
[ -f "$ledger" ] || exit 0

payload="$(cat 2>/dev/null || true)"
source_val="$(printf '%s' "$payload" \
  | grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')"

# Emit ACUITY<TAB>ORDER<TAB>SOURCE<TAB>OUTCOME for active rows only.
rows="$(awk '
  /^## Prioritised queue/ { inqueue=1; next }
  /^## /                  { if (inqueue) inqueue=0 }
  inqueue && /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
    n=split($0, c, "|")
    ord=c[2]; src=c[3]; outcome=c[4]; acuity=c[5]
    gsub(/^[ \t]+|[ \t]+$/, "", ord)
    gsub(/^[ \t]+|[ \t]+$/, "", src)
    gsub(/^[ \t]+|[ \t]+$/, "", outcome)
    gsub(/^[ \t]+|[ \t]+$/, "", acuity)
    printf "%s\t%s\t%s\t%s\n", acuity, ord, src, outcome
  }
' "$ledger" 2>/dev/null || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ]; then
  echo "[issues] Universal task ledger (docs/outstanding-issues.md): no active recommended work. Record one with /issues add …"
  exit 0
fi

group() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$1==p'; }
count() { printf '%s' "$1" | grep -c . || true; }
a1="$(group A1)"; a2="$(group A2)"; a3="$(group A3)"; optional="$(group Optional)"
c1="$(count "$a1")"; c2="$(count "$a2")"; c3="$(count "$a3")"; co="$(count "$optional")"

echo "[issues] Universal task ledger — ${total} active (${c1}×A1, ${c2}×A2, ${c3}×A3, ${co} optional). Source of truth: docs/outstanding-issues.md · read the full queue with /issues."

print_group() {
  local data="$1" limit="$2" shown=0 more=0 acuity ord src outcome
  [ -z "$data" ] && return 0
  while IFS=$'\t' read -r acuity ord src outcome; do
    [ -z "$acuity" ] && continue
    if [ "$shown" -lt "$limit" ]; then
      echo "  ${ord}. ${acuity} ${src} — ${outcome}"
      shown=$((shown + 1))
    else
      more=$((more + 1))
    fi
  done <<EOF
$data
EOF
  [ "$more" -gt 0 ] && echo "  … +${more} more at this acuity (see /issues)"
  return 0
}

[ "$c1" -gt 0 ] && print_group "$a1" 999
[ "$c2" -gt 0 ] && print_group "$a2" 8
[ "$c3" -gt 0 ] && echo "  ${c3} × A3 (planned/triggered) — see /issues"
[ "$co" -gt 0 ] && echo "  ${co} × Optional — see /issues"

case "$source_val" in
  compact | resume | clear)
    echo "[issues] Context was just reset (${source_val}). Before this session wraps up, run /issues capture so new follow-ups are not lost."
    ;;
  *)
    echo "[issues] When this session wraps up, offer /issues capture for any new follow-ups."
    ;;
esac
exit 0
