# Favourites and repository reconciliation — implementation plan

> **Execution:** use subagent-driven development. Preserve all ambiguous work; do not force-remove a worktree or delete a remote branch.

**Goal:** Complete stable-reference favourites and leave the branch/worktree fleet safer without sacrificing recoverable work.

**Spec:** [`../specs/2026-08-23-clinical-operations-programme-design.md`](../specs/2026-08-23-clinical-operations-programme-design.md)

## Task 1: Favourite data contract

**Files:** migration, `supabase/schema.sql`, `database.types.ts`, favourites API/provider, tests.

- [ ] Add owner-scoped controlled sets and item ordering metadata.
- [ ] Keep membership keys limited to canonical service/form/differential/therapy references in this release.
- [ ] Validate versioned GET/PUT/POST/PATCH/DELETE payloads with strict schemas and bounded values.
- [ ] Preserve optimistic mutation ordering, rollback, auth expiry, account export, and account deletion.
- [ ] Do not apply the migration to hosted Supabase.

## Task 2: Complete production favourites controls

**Files:** `favourites-command-library-page.tsx`, supporting hooks/components, focused DOM tests.

- [ ] Wire remove to the account provider and close/update selection only after the mutation settles.
- [ ] Add controlled set creation, moving, and ordering UI with honest failure/retry states.
- [ ] Keep local pinned/last-opened presentation distinct from cross-device persisted membership unless the migration explicitly owns it.
- [ ] Do not enable save controls on generated answers, ad-hoc searches, quotes, or patient-bearing content.
- [ ] Run focused API/provider and DOM tests; use `npm run ensure` only if browser QA is necessary after focused proof.

## Task 3: Fail-closed reconciliation evidence

**Files:** dated reconciliation report only unless a candidate passes every gate.

- [ ] Freeze a current base and record fleet activity before cleanup.
- [ ] Run strict preflight/list-only discovery and verify process, PR, ledger, Git-operation, dirty-state, ancestry, patch-unique, and archive evidence per candidate.
- [ ] Retain every Codex session worktree, detached checkout, dirty checkout, ahead branch, interrupted WIP, and missing-upstream branch without content proof.
- [ ] Remove only an exact registered clean worktree that passes all gates; never use force or recursively delete an outer task directory.
- [ ] Record candidates, blockers, retained work, and whether anything was removed. Local branch deletion is separate; remote deletion is out of scope.
