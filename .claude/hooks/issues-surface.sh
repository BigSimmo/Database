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
# Emit "ORDER<TAB>PRI<TAB>ID<TAB>TYPE<TAB>SUMMARY" per open row. Scoped between the
# "## Open items" heading and the next "## " heading so the Resolved/archive
# table (different columns) is never counted.
rows="$(awk '
  /^## Open items/       { inopen=1; next }
  /^## /                 { if (inopen) inopen=0 }
  inopen && /^\|[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*#[0-9]/  {
    n=split($0, c, "|")
    ord=c[2]; id=c[3]; priacuity=c[4]; typ=c[5]; sum=c[6]
    split(priacuity, p, " "); pri=p[1]
    gsub(/^[ \t]+|[ \t]+$/, "", ord)
    gsub(/^[ \t]+|[ \t]+$/, "", id)
    gsub(/^[ \t]+|[ \t]+$/, "", pri)
    gsub(/^[ \t]+|[ \t]+$/, "", typ)
    gsub(/^[ \t]+|[ \t]+$/, "", sum)
    printf "%s\t%s\t%s\t%s\t%s\n", ord, pri, id, typ, sum
  }
' "$ledger" 2>/dev/null || true)"

total="$(printf '%s' "$rows" | grep -c . || true)"
if [ "${total:-0}" -eq 0 ]; then
  echo "[issues] Universal task ledger (docs/outstanding-issues.md): no open items. Record one with /issues add …"
  exit 0
fi

count_priority() { printf '%s\n' "$rows" | awk -F'\t' -v p="$1" '$2==p { n++ } END { print n+0 }'; }
c1="$(count_priority P1)"; c2="$(count_priority P2)"; c3="$(count_priority P3)"

echo "[issues] Universal task ledger — ${total} open (${c1}×P1, ${c2}×P2, ${c3}×P3). Source of truth: docs/outstanding-issues.md · read the full ordered list with /issues."

# Preserve the ledger's dependency-aware order. Acuity totals above are metadata only.
printf '%s\n' "$rows" | awk -F'\t' '
  NF && NR <= 10 { printf "  %s. %s %s %s — %s\n", $1, $2, $3, $4, $5 }
  END { if (NR > 10) printf "  … +%d more in ledger order (see /issues)\n", NR - 10 }
'

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
