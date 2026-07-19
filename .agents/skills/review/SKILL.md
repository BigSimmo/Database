---
name: review
description: Review the current Database diff, branch, or explicitly approved PR target for high-confidence correctness, security, privacy, clinical, and reliability defects. Use for code review, diff review, or readiness feedback.
---

# Review

1. Read `docs/codex-review-protocol.md` and `docs/branch-review-ledger.md` when present.
2. Resolve the target SHA/HEAD; skip merged, unchanged, or already-reviewed scopes.
3. Inspect changed behavior and realistic failure paths; prioritize reproducible P0-P2 findings.
4. Cite exact files and lines, trigger, impact, and the smallest proof or fix.
5. Do not run, modify, test, or otherwise interact with OpenAI, Supabase, GitHub/GitLab, hosted CI, production-like services, or provider-backed workflows without explicit user confirmation.
6. Record the completed local review in `docs/branch-review-ledger.md` whenever the ledger exists.
