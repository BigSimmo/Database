### Motivation

- Consolidate and file dated point-in-time reviews into the audit/archive areas so `docs/README.md` conventions are honoured and loose top-level dated docs do not mislead source/reference consumers.
- Make ledger outcomes and process lessons durable and verifiable (archive rows instead of deleting history) so agents and humans can rely on content+verification rather than fragile row ids or titles.
- Prevent repeated proposals of already-landed work by updating the `#101` retrieval-parallelisation row to reflect shipped hydration parallelisation and keep only true canary-gated candidates.
- Preserve append-only ledger invariants by adding a superseding branch-review entry for the PR-J clinical-governance review so the ledger records what was actually merged without editing prior rows.

### Description

- Moved several dated docs into their canonical locations under `docs/audit/` or `docs/archive/` and updated inbound references to those paths (notably the capacity/scale and tenancy audit docs).
- Added durable guidance to `AGENTS.md` requiring the Actions-run fallback when `gh pr checks` lacks Checks permission and clarifying that outstanding-issue IDs are display locators only and completion must be proven by distinctive content + verification on the exact ref.
- Updated the universal ledger with guarded writer scripts: archived rows `#142`, `#154`, `#156`, `#186`, `#187`, and `#232` in `docs/outstanding-issues.md` through the repository `issues` writer, and updated `#101` to list only remaining canary-gated candidates after PR #1474.
- Appended a superseding, non-destructive branch-review record for PR-J (final head `590eb6cfb229c5ae0f7a5025352fa871d8321521`) into `docs/branch-review-ledger.md` using the ledger tool rather than editing the existing row, and updated script references/docs to point at the moved audit/archive files where appropriate.

### Testing

- Ran formatting and verification commands and observed green results: `npm run format` (Prettier write), `npm run check:outstanding-issues`, and `npm run check:branch-review-ledger` all passed.
- Ran docs and inventory checks: `npm run docs:check-links` and `npm run docs:check-inventory` passed and `npm run docs:check-index` confirmed documented mappings; `npm run design-system:adoption:update` also ran successfully to refresh adoption manifests.
- Ran gateway/verifier scripts and repository checks: `npm run check:migration-role` passed and `git diff --check` / `git diff --cached --check` reported no whitespace or merge-marker problems; no unrelated file churn was introduced and the working tree was left consistent with the scoped edits.

------
[Codex Task](https://chatgpt.com/codex/cloud/tasks/task_e_6a7c06b0f8608322bccdef26197fb9d8)

## Clinical Governance Preflight

<!-- GOVERNANCE_PREFLIGHT -->

_Note: The only `supabase/` change is `20260724120000_table_facts_plpgsql_execute.sql`, a performance-only migration adding `force_custom_plan` to avoid generic cached plans — no result-set, RLS, schema, or clinical-logic changes._

RAG impact: no retrieval behaviour change — this PR is ledger/docs hygiene and a performance-only SQL plan hint only.
