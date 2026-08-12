---
name: handover
description: Prepare a concise evidence-backed Database handover without automatically committing, pushing, opening a PR, or calling providers. Use when work is ready for another person, task, review, or explicit upload workflow.
---

# Handover

1. Inspect branch, upstream, worktrees, status, relevant diffs, and recent commits.
2. Run `npm run workflow:lifecycle -- --phase handoff --write-evidence` and use its verification routing.
3. Run one smallest proportionate offline gate; prefer `npm run verify:pr-local` for non-trivial ready work and do not stack broad gates without a distinct failure class.
4. Separate intended changes from unrelated dirty work and list generated artifacts.
5. Summarize files, checks, failures, skipped gates, risks, the decisive proof line (not exit 0 alone), and the exact next action.
6. Do not commit, push, open a PR, merge, or call providers unless explicitly requested and authorized.
