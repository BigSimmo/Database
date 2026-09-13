#!/usr/bin/env bash
set -uo pipefail
cd "D:/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231"
FILES=$(ls tests/ward-*.test.ts tests/ward-*.test.tsx 2>/dev/null)
COUNT=$(echo "$FILES" | grep -c . || true)
echo "discovered files: $COUNT"
if [ "$COUNT" -lt 50 ]; then echo "REFUSING: suspiciously few files"; exit 9; fi
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  echo "--- attempt $attempt $(date +%H:%M:%S)"
  OUT=$(GATE_RECEIPTS=refresh node scripts/run-vitest.mjs run $FILES 2>&1)
  CODE=$?
  echo "$OUT" | tail -30
  if echo "$OUT" | grep -qi "capacity is full\|BUSY\|admission"; then
    echo "BLOCKED by lock, retrying"; sleep 45; continue
  fi
  echo "EXIT=$CODE"; exit $CODE
done
echo "NEVER RAN"; exit 9
