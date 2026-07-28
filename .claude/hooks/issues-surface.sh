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
# Emit ordered universal-ledger fields per active row. Scoped between the
# "## Open items" heading and the next "## " heading so the Resolved/archive
# and superseded historical tables are never counted.
rows="$(awk '
  /^## Open items/       { inopen=1; next }
  /^## /                 { if (inopen) inopen=0 }
  inopen && /^\| #[0-9]/  {
    n=split($0, c, "|")
    id=c[2]; pri=c[3]; typ=c[4]; sum=c[5]; order=c[9]; class=c[10]; when=c[12]; estimate=c[13]
    gsub(/^[ \t]+|[ \t]+$/, "", id)
    gsub(/^[ \t]+|[ \t]+$/, "", pri)
    gsub(/^[ \t]+|[ \t]+$/, "", typ)
    gsub(/^[ \t]+|[ \t]+$/, "", sum)
    gsub(/^[ \t]+|[ \t]+$/, "", order)
    gsub(/^[ \t]+|[ \t]+$/, "", class)
    gsub(/^[ \t]+|[ \t]+$/, "", when)
    gsub(/^[ \t]+|[ \t]+$/, "", estimate)
    printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", order, pri, id, typ, sum, class, when, estimate
  }
' "$ledger" 2>/dev/null | sort -n -k1,1 || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ]; then
  echo "[issues] Outstanding-work memory (docs/outstanding-issues.md): no open items. Record one with /issues add …"
  exit 0
fi

group() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$2==p'; }
count() { printf '%s' "$1" | grep -c . || true; }
p1="$(group P1)"; p2="$(group P2)"; p3="$(group P3)"
c1="$(count "$p1")"; c2="$(count "$p2")"; c3="$(count "$p3")"

echo "[issues] Universal task ledger — ${total} recommended open (${c1}×P1, ${c2}×P2, ${c3}×P3). Source of truth: docs/outstanding-issues.md · read the full ordered list with /issues."

print_ordered() { # $1=rows  $2=max-to-list
  local data="$1" limit="$2" shown=0 more=0 order pri id typ sum class when estimate
  [ -z "$data" ] && return 0
  while IFS=$'\t' read -r order pri id typ sum class when estimate; do
    [ -z "$order" ] && continue
    if [ "$shown" -lt "$limit" ]; then
      echo "  ${order}. ${pri} ${id} ${typ} [${class}] — ${sum}; when: ${when}; estimate: ${estimate}"
      shown=$((shown + 1))
    else
      more=$((more + 1))
    fi
  done <<EOF
$data
EOF
  [ "$more" -gt 0 ] && echo "  … +${more} more in recommended order (see /issues)"
  return 0
}

# Keep startup context compact while preserving the universal order across priorities/states.
print_ordered "$rows" 12

# --- capture reminder ---------------------------------------------------------
case "$source_val" in
  compact | resume | clear)
    echo "[issues] Context was just reset (${source_val}). Before this session wraps up, use /issues capture to reconcile only verified, recommended follow-ups into the universal ledger."
    ;;
  *)
    echo "[issues] When this work wraps up, offer /issues capture for verified recommended follow-ups; do not preserve stale or speculative work."
    ;;
esac
exit 0
