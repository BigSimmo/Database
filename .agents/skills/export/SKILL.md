---
name: export
description: Create a review-safe Database codebase archive with a manifest while excluding secrets, dependencies, build output, caches, logs, and machine-local state. Use when the user asks to package or export the repository for review.
---

# Export

1. Inspect tracked, untracked, ignored, sensitive, generated, and oversized paths without printing secrets.
2. Stage the archive outside the repository and include `EXPORT_MANIFEST.md`.
3. Include only review-relevant source, configuration, tests, and documentation.
4. Exclude `.env*`, credentials, dependencies, builds, caches, logs, browser artifacts, and local state.
5. Verify the archive opens, inspect its file list, and confirm its size before handoff.
6. Do not alter the worktree, commit, push, upload, or send the archive without explicit authorization.
