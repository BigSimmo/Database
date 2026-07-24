# Codex Review Protocol

Use this protocol for every Codex review, audit, bug hunt, PR review, release-readiness check, and branch-cleanup review in this repository.

## Trigger and Scope

- Do not start a review opportunistically.
- Review only when the user request, `AGENTS.md` routing rules, or an explicit handoff/release workflow calls for it.
- Review the current diff, named PR, named branch, or explicitly requested area.
- Do not expand into stale branches or unrelated modules unless a confirmed defect crosses that boundary.
- Before branch or PR review, check `docs/branch-review-ledger.md`: resolve the target with `git rev-parse`, compare the HEAD and scope, and skip unchanged completed reviews unless the user asks for a fresh pass.
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
- After fixing or fully dispositioning a thread, start the reply with `<!-- codex-thread-disposition:resolved -->`; the workflow will close that exact thread. Do not use the marker when human input or new authorization is required, and leave that blocked thread open with a concise reason.
- Ask before any OpenAI, Supabase, GitHub/GitLab, hosted CI, or provider-backed workflow.
- After any completed branch/PR review, append to `docs/branch-review-ledger.md` with date, branch/ref, HEAD, scope, outcome, and checks. The ledger is append-only: never edit or delete an existing record; append a correction or superseding record instead. This ledger append is allowed even during a pure review.

## Severity Guide

- P0: Data loss, security breach, production outage, or clinical safety issue likely to harm users immediately.
- P1: Broken core workflow, unsafe automation, privacy/auth failure, or repeatable defect that blocks merge/handoff.
- P2: Real defect, missing guardrail, fragile process, or test gap that should be fixed before relying on the work.
- P3: Low-risk cleanup, clarity, documentation, or future-proofing issue.
