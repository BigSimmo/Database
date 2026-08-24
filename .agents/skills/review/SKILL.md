---
name: review
description: Review the current Database diff, branch, or named PR target for high-confidence correctness, security, privacy, clinical, and reliability defects.
---

# Review

1. Read `docs/codex-review-protocol.md`, and check prior reviews with `npm run ledger:lookup -- <ref> --scope "<scope>"` rather than reading the ledger table directly.
2. Resolve the local target SHA and check whether the same scope was already reviewed.
3. Inspect changed behavior and realistic failure paths; prioritize reproducible P0-P2 findings.
4. Cite exact files and lines, trigger, impact, and the smallest proof or fix.
5. A named remote target authorizes its necessary low-cost read-only metadata. Hosted writes, reruns, sensitive data, and paid calls remain separately gated.
6. Record the completed local review in the ledger when repository instructions require it.
