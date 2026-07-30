# Codex Review Protocol

Use this protocol for every Codex review, audit, bug hunt, PR review, release-readiness check, and branch-cleanup review in this repository.

## Trigger and Scope

- Do not start a review opportunistically.
- Review only when the user request, `AGENTS.md` routing rules, or an explicit handoff/release workflow calls for it.
- Review the current diff, named PR, named branch, or explicitly requested area.
- Do not expand into stale branches or unrelated modules unless a confirmed defect crosses that boundary.
- Before branch or PR review, check `docs/branch-review-ledger.md` with `npm run ledger:lookup -- <branch-or-ref> --scope "<scope>"`. It resolves the HEAD, matches abbreviated SHAs, and prints an explicit verdict. Skip unchanged completed reviews unless the user asks for a fresh pass. Do not scan the table by eye.
- Treat GitHub automatic review as one pass per pull request. A repair commit or later head does not authorize another automatic pass; require an explicit human request before re-reviewing.
- Route automatic repair only for high-risk paths, at least 10 changed non-test source files, at least 300 changed non-test source lines, or an explicit `codex-review` label. `skip-codex-review` always opts out, including when both labels are present. Small low-risk, docs-only, test-only, and generated-only changes should not receive the automatic repair request.
- Ready PRs must pass the trusted `PR policy` metadata check. It reads only the base-branch policy implementation, never executes PR code, and requires concrete verification plus risk/rollback evidence for high-risk changes.

## Review Output

- Lead with findings, ordered by severity: P0, P1, P2, then P3.
- For automatic PR reviews, emit no more than three inline findings and reserve them for P0/P1 defects. Consolidate non-blocking P2 context into one summary and omit P3 feedback.
- Each finding must include file/line evidence, trigger or failure path, expected behavior, actual risk, and the smallest proof or check that would catch it.
- If no high-confidence issue is found, say so clearly and name the highest residual risk area.
- Include checks run, checks not run, and whether any check was skipped because it could touch an API/provider.
- Keep summaries secondary to findings.

## Mutation Rules

- For a pure review request, do not edit files, stage, commit, push, post PR comments, rerun hosted CI, or call provider-backed services.
  - Exception: append the completed review record to `docs/branch-review-ledger.md` so throttling state persists.
- If the user clearly asks to fix confirmed findings, make the smallest safe change and verify with local, static, or mocked checks first.
- During an automatic resolve task, work only existing unresolved Codex threads. Do not start a new review, add standalone findings, or request another review.
- After fixing or fully dispositioning a thread, start the reply with `<!-- codex-thread-disposition:resolved -->`, then declare exactly one result: `<!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->` for a published fix or `<!-- codex-thread-result:no-change -->` for a no-code disposition. The workflow closes a fixed thread only when the reported commit is the pull-request head. A local-only commit is not a fix; when publication, verification, human input, or new authorization blocks completion, use no result marker and leave the thread open with a concise reason.
- Ask before any OpenAI, Supabase, GitHub/GitLab, hosted CI, or provider-backed workflow.
- After any completed branch/PR review, append to `docs/branch-review-ledger.md` with `npm run ledger:append -- --ref <x> --head <full-sha> --scope <s> --outcome <o> --checks <c>`. Record the full 40-character SHA; `see PR head` and abbreviations make the record unmatchable and cause the review to run again. The ledger is append-only: never edit or delete an existing record; append a correction or superseding record (`--supersede`) instead. This ledger append is allowed even during a pure review. Do not hand-write the markdown row — hand-written rows are what produced the mojibake, wrong-width, and duplicate records the 2026-07-28 hygiene pass had to repair. Do not push a tip whose sole delta is a babysit ledger append; after merging `origin/main` into a branch that touched the ledger, run `npm run ledger:dedupe` when exact twins appear.

## Ledger Rotation

At the start of each UTC calendar quarter, or earlier when the live table becomes unwieldy, run `npm run ledger:rotate -- --dry-run`. If the preview contains only the intended completed records, run `npm run ledger:rotate` and commit the live ledger and generated archive together. Lookup, sweep, and integrity checks read both locations. Never hand-move rows or delete unique review content; stop if the dry-run shows unexpected mass movement or an archive-path collision.

## Severity Guide

- P0: Data loss, security breach, production outage, or clinical safety issue likely to harm users immediately.
- P1: Broken core workflow, unsafe automation, privacy/auth failure, or repeatable defect that blocks merge/handoff.
- P2: Real defect, missing guardrail, fragile process, or test gap that should be fixed before relying on the work.
- P3: Low-risk cleanup, clarity, documentation, or future-proofing issue.

## Final merge audit

Before a protected-main merge, run the local audit from a clean PR checkout and pin the reviewed head:

```powershell
npm run audit:final-merge -- --dry-run --base-ref origin/main --head-ref HEAD --expected-head <head-sha>
```

The output records the local base/head and expected merge-tree. GitHub checks, labels, review threads, fresh remote refs, and deployment health are provider reads and require explicit authorization. Once authorized, add `--providers --pr <number> --repo BigSimmo/Database` and set `ALLOW_PROVIDER_READS=true`; the audit fails closed unless the repository's `pr-required` aggregate is present and settled successfully. After the squash merge, rerun with `--post-merge --expected-tree <pre-merge-tree> --health-url <production-origin>/api/health`; the audit compares the remote main tree and requires an HTTP success with JSON `status: "ok"`. The script is read-only: it never merges, pushes, reruns CI, resolves threads, or deploys.
