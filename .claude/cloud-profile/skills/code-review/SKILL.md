---
name: code-review
description: Review the current working diff for correctness bugs plus reuse, simplification, and efficiency cleanups. Use when the user asks to review their changes, review the diff, or sanity-check code before committing or pushing. Supports effort levels (low/medium/high/max) and optional --comment (post inline PR comments) or --fix (apply findings to the working tree).
---

# Code Review (working diff)

Thin wrapper over Claude Code's built-in diff review.

When invoked:

1. **Delegate to the built-in review.** If a built-in `code-review` command/skill is available and resolves to something *other than this file*, invoke it and forward every argument the user gave — effort level (`low`/`medium`/`high`/`max`), `--comment`, `--fix`, or `ultra`. The built-in owns the real behavior, including `ultra`'s multi-agent cloud review, which cannot be reproduced here.

2. **Recursion guard.** If invoking `code-review` would resolve back to *this* skill (name collision), do **not** call it again — perform the review inline instead:
   - Determine the diff: `git diff` (unstaged), `git diff --staged` (staged), or the branch diff vs the merge-base with the default branch (`git diff main...HEAD`). Prefer the branch diff when reviewing a feature branch.
   - Read each changed file for surrounding context, not just the hunk.
   - Report findings ranked most-severe first: correctness bugs first, then reuse / simplification / efficiency cleanups. For each finding give `file:line`, a one-sentence defect statement, and a concrete failure scenario (inputs/state → wrong result).
   - Scale breadth to the requested effort: `low`/`medium` = a few high-confidence findings; `high`/`max` = broader coverage that may include less certain findings.
   - With `--fix`, apply the accepted findings to the working tree. With `--comment`, post them as inline PR comments via `gh`.

Never invent findings — if the diff is clean, say so plainly.

> Note: `ultra` (multi-agent cloud review) is only available through the built-in command and is user-triggered/billed. This wrapper cannot launch it; hand off to the real `/code-review ultra` instead.
