---
name: release-readiness-review
description: Reviews build validation, linting/type-checking, target database checks, clinical governance preflight approvals, and environment variables. Use before staging or production releases.
---

# Release Readiness Review Skill

Use this skill when preparing a branch for merging, pull request submission, or production deployment.

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Review Checklist

### 1. Build & Automation Checks

- **Static Analysis:** Confirm `npm run lint` and `npm run typecheck` run clean.
- **Verification Gates:** Ensure the appropriate verification scripts run successfully (`npm run verify:cheap` at minimum; `npm run verify:release` for full handoffs).
- **Target database checks:** Run `npm run check:supabase-project` to confirm env targets match `Clinical KB Database` ref `sjrfecxgysukkwxsowpy`.

### 2. Clinical Governance Compliance

- **Preflight Verification:** Complete all checklist items in `.github/pull_request_template.md`.
- **Secret Scan:** Confirm no private configuration files (`.env.local`), local debug logs, or keys are present in the git stage.
- **Production Readiness Check:** Run `npm run check:production-readiness` for privacy, ingestion, or clinical behavior changes.
