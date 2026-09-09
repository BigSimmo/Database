#!/usr/bin/env bash
# Runs the ward suite, globbed FROM DISK, retrying while the machine-wide lock refuses.
cd "D:/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231" || exit 9
OUT="$1"
FILES=$(ls tests/ward-*.test.ts tests/ward-*.test.tsx 2>/dev/null)
COUNT=$(printf '%s\n' "$FILES" | grep -c .)
echo "GLOBBED_FROM_DISK_FILE_COUNT=$COUNT" | tee "$OUT"
if [ "$COUNT" -lt 70 ]; then echo "REFUSING: glob returned $COUNT files" | tee -a "$OUT"; exit 8; fi
for attempt in $(seq 1 40); do
  echo "--- attempt $attempt at $(date -Is) ---" >> "$OUT"
  GATE_RECEIPTS=refresh node scripts/run-vitest.mjs run $FILES >> "$OUT" 2>&1
  code=$?
  if grep -qiE "capacity is full|heavy run admission|busy|another run holds" "$OUT" && [ "$code" -ne 0 ] && ! grep -qE "^ *Test Files" "$OUT"; then
    echo "--- refused (exit $code), sleeping ---" >> "$OUT"
    sleep 30
    continue
  fi
  echo "EXIT_CODE=$code" >> "$OUT"
  exit $code
done
echo "NEVER_RAN" >> "$OUT"
exit 7
