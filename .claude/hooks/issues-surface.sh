#!/usr/bin/env bash
# SessionStart hook — surface the outstanding-work memory into context.
#
# Reads docs/outstanding-issues.md (the universal /issues ledger) and prints the
# ordered recommended tasks plus open-item counts so every session starts with
# the same repository-wide priorities. When the trigger is a context reset
# (compact / resume / clear) it also emits a reminder to run `/issues capture`.
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

# --- parse the ordered recommended execution queue --------------------------
# Emit "ORDER<TAB>ID<TAB>ACUITY<TAB>WHEN<TAB>ESTIMATE" per recommended row.
recommended="$(awk '
  /^## Recommended execution queue/ { inrecommended=1; next }
  /^## /                             { if (inrecommended) inrecommended=0 }
  inrecommended && /^\|[[:space:]]*[0-9]+[[:space:]]*\|/ {
    n=split($0, c, "|")
    order=c[2]; id=c[3]; acuity=c[5]; timing=c[6]; estimate=c[7]
    gsub(/^[ \t]+|[ \t]+$/, "", order)
    gsub(/^[ \t]+|[ \t]+$/, "", id)
    gsub(/^[ \t]+|[ \t]+$/, "", acuity)
    gsub(/^[ \t]+|[ \t]+$/, "", timing)
    gsub(/^[ \t]+|[ \t]+$/, "", estimate)
    printf "%s\t%s\t%s\t%s\t%s\n", order, id, acuity, timing, estimate
  }
' "$ledger" 2>/dev/null || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
recommended_total="$(printf '%s' "$recommended" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ] && [ "${recommended_total:-0}" -eq 0 ]; then
  echo "[issues] Universal task ledger (docs/outstanding-issues.md): no recommended or open items. Record one with /issues add …"
  exit 0
fi

group() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$1==p'; }
count() { printf '%s' "$1" | grep -c . || true; }
p1="$(group P1)"; p2="$(group P2)"; p3="$(group P3)"
c1="$(count "$p1")"; c2="$(count "$p2")"; c3="$(count "$p3")"

echo "[issues] Universal task ledger — ${recommended_total} recommended · ${total} open (${c1}×P1, ${c2}×P2, ${c3}×P3). Source of truth: docs/outstanding-issues.md · read the full ledger with /issues."

print_recommended() { # $1=max-to-list
  local limit="$1" shown=0 more=0 order id acuity timing estimate
  [ -z "$recommended" ] && return 0
  while IFS=$'\t' read -r order id acuity timing estimate; do
    [ -z "$order" ] && continue
    if [ "$shown" -lt "$limit" ]; then
      echo "  ${order} ${id} ${acuity} — ${timing} · ${estimate}"
      shown=$((shown + 1))
    else
      more=$((more + 1))
    fi
  done <<EOF
$recommended
EOF
  [ "$more" -gt 0 ] && echo "  … +${more} more recommended tasks in ledger order (see /issues)"
  return 0
}

queue_total="$(printf '%s' "$queue_rows" | grep -c . || true)"
if [ "${queue_total:-0}" -gt 0 ]; then
  echo "[issues] Recommended execution queue — ${queue_total} retained tasks (first 8):"
  printf '%s\n' "$queue_rows" | head -n 8 | while IFS=$'\t' read -r ord ids acuity capability timing; do
    echo "  ${ord}. ${ids} · ${acuity} · ${timing} · ${capability}"
  done
fi

# Keep the priority summary complementary to the queue instead of repeating
# the same recommended IDs in both sections.
queued_ids=" $(printf '%s\n' "$queue_rows" | grep -oE '#[0-9]+' | tr '\n' ' ' || true)"
unqueued_rows="$(printf '%s\n' "$rows" | awk -F'\t' -v queued="$queued_ids" '
  index(queued, " " $2 " ") == 0
' || true)"
ungroup() { printf '%s\n' "$unqueued_rows" | awk -F'\t' -v p="$1" '$1==p'; }
u1="$(ungroup P1)"; u2="$(ungroup P2)"; u3="$(ungroup P3)"
uc1="$(count "$u1")"; uc2="$(count "$u2")"; uc3="$(count "$u3")"

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

# Prefer the universal recommended order. Fall back to priority groups for an
# older ledger that does not yet have the recommended execution section.
if [ "${recommended_total:-0}" -gt 0 ]; then
  print_recommended 10
else
  [ "$c1" -gt 0 ] && print_group "$p1" 999
  [ "$c2" -gt 0 ] && print_group "$p2" 8
  [ "$c3" -gt 0 ] && echo "  ${c3} × P3 (nice-to-have / revisit-when) — see /issues"
fi

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
