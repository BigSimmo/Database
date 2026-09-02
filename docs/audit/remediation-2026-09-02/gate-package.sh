#!/usr/bin/env bash
# Orchestrator gate for one remediation package: format+commit, merge-tree check, diff-integrity,
# then the package's verify:pr-local plan (heavy or light as the classifier decides).
# Usage: gate-package.sh <pkg>   (logs to SP/remediation/logs/<pkg>-gate.log)
set -uo pipefail
PKG="$1"
SP=/tmp/claude-0/-home-user-Database/f185f405-83e6-51c4-90c5-be0b0f107617/scratchpad
WT=/home/user/wt/$PKG
LOG=$SP/remediation/logs/$PKG-gate.log
mkdir -p "$SP/remediation/logs"
cd "$WT" || { echo "no worktree $WT"; exit 2; }
{
  echo "== gate $PKG at $(date -u +%FT%TZ) head=$(git rev-parse --short HEAD)"
  echo "-- porcelain:"; git status --porcelain
  if [ -n "$(git status --porcelain)" ]; then echo "DIRTY TREE — aborting"; exit 3; fi
  echo "-- commits:"; git log --oneline origin/main..HEAD
  echo "-- format"
  npm run format >/dev/null 2>&1 || true
  if [ -n "$(git status --porcelain)" ]; then
    git add -A && git -c core.hooksPath=.githooks commit -q -m "style: prettier formatting for the ${PKG} remediation package

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FSPY4VSqg7WVukCvmHQP9t" && echo "format commit added"
  else echo "already formatted"; fi
  echo "-- merge-tree vs origin/main"
  git fetch -q origin main
  if git merge-tree --write-tree origin/main HEAD >/dev/null 2>&1; then echo "merge-tree clean"; else echo "MERGE CONFLICT with origin/main"; fi
  echo "-- diff-integrity"; npm run check:diff-integrity 2>&1 | tail -2
  echo "-- verify:pr-local plan"; npm run verify:pr-local -- --dry-run 2>&1 | sed -n '/PR-local verification plan/,$p'
  echo "-- verify:pr-local run"
  VITEST_MAX_WORKERS=2 npm run verify:pr-local > "$LOG.full" 2>&1; RC=$?
  grep -n "Test Files\|^ *Tests \|^> npm run\|FAIL\|Error\|error TS\|✗\|✖" "$LOG.full" | grep -v "stderr |" | tail -60
  sed -n "/PR-local verification summary/,\$p" "$LOG.full"
  echo "EXIT=$RC"
} > "$LOG" 2>&1
grep -n "DIRTY\|MERGE CONFLICT\|merge-tree clean\|Test Files\|^ *Tests \|^- completed\|^- failed\|^- not reached\|EXIT=" "$LOG" | tail -12
