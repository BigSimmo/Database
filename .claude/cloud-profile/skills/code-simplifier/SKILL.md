---
name: code-simplifier
description: Clean up the changed code for reuse, simplification, efficiency, and altitude, then apply the fixes. Quality only — it does not hunt for correctness bugs (use code-review for that). Use when the user wants to simplify, tidy, refactor, de-duplicate, or clean up their recent changes or working diff.
---

# Code Simplifier

Thin wrapper over Claude Code's built-in `simplify` skill.

When invoked:

1. Run the built-in **`simplify`** skill via the Skill tool, forwarding any arguments the user passed. It reviews the changed code (the working diff) for reuse, simplification, efficiency, and altitude improvements, then applies the fixes to the working tree.
2. If the built-in `simplify` skill is unavailable, perform the cleanup directly on the current diff:
   - Determine the diff (`git diff`, `git diff --staged`, or the branch diff vs the merge-base with the default branch).
   - Look for: duplicated logic that could reuse an existing helper, over-complex constructs that could be simplified, needless inefficiency, and code pitched at the wrong altitude.
   - Apply the smallest safe edits that preserve behavior. Match the surrounding code's style and idioms.

This is a **quality pass only** — do not report or fix correctness bugs here; route those to `code-review`.
