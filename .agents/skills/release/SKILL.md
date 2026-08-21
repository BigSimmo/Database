---
name: release
description: Assemble Database release-readiness evidence, risk-scoped local checks, governance proof, rollback notes, and approval-gated final verification. Use for release, merge readiness, production handoff, or go-live confidence.
---

# Release

Do not use this skill merely because the user asks to open or publish a PR. An explicit bare PR publication request follows the `AGENTS.md` bare-publication route: publish without local readiness work and leave CI unobserved unless the user asks otherwise.

1. Inspect intended diff, branch state, review ledger, release notes, migrations, configuration, and rollback.
2. Run the flight plan and complete the smallest focused checks before `npm run verify:pr-local`.
3. Include UI, clinical, RAG, migration, privacy, or deployment proof only when selected by risk.
4. Verify required governance and handoff documentation is complete.
5. Do not run `verify:release`, hosted CI, GitHub, Supabase, OpenAI, or deployment commands without approval.
6. Return a ready/not-ready decision with passed, failed, skipped, and gated checks.
