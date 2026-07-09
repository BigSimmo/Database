# Codex Review Protocol

Use this protocol for every Codex review, audit, bug hunt, PR review, release-readiness check, and branch-cleanup review in this repository.

## Trigger and Scope

- Do not start a review opportunistically.
- Review only when the user request, `AGENTS.md` routing rules, or an explicit handoff/release workflow calls for it.
- Review the current diff, named PR, named branch, or explicitly requested area.
- Do not expand into stale branches or unrelated modules unless a confirmed defect crosses that boundary.
- Before branch or PR review, check `docs/branch-review-ledger.md` when the review path is local or branch-cleanup scoped: resolve the target with `git rev-parse`, compare the HEAD and scope, and skip unchanged completed reviews unless the user asks for a fresh pass.
- GitHub-hosted Codex PR reviews and auto-resolve dedupe use PR labels and marker comments from `.github/workflows/codex-autofix-review-comments.yml`; ledger updates there are optional when a safe local commit is possible.

## GitHub auto-resolve and manual re-trigger

- `.github/workflows/codex-autofix-review-comments.yml` posts one auto-resolve request per pull request **head SHA** after Codex leaves actionable review comments, inline review comments, or top-level PR comments with findings.
- A new commit on the PR branch changes the head SHA, so a later Codex review can auto-trigger resolve again for that new SHA.
- To force another resolve pass on the **current** head SHA, post the Primary PR command from `AGENTS.md` on the PR:

  `@codex resolve all review comments using AGENTS.md § Codex GitHub review behavior (Primary PR command).`

- Manual re-trigger is useful after a partial auto-resolve pass, when the workflow dedupe label/marker is already present, or when you want another fix pass without waiting for a new Codex review.

## Review Output

- Lead with findings, ordered by severity: P0, P1, P2, then P3.
- Each finding must include file/line evidence, trigger or failure path, expected behavior, actual risk, and the smallest proof or check that would catch it.
- If no high-confidence issue is found, say so clearly and name the highest residual risk area.
- Include checks run, checks not run, and whether any check was skipped because it could touch an API/provider.
- Keep summaries secondary to findings.

## Mutation Rules

- For a pure review request, do not edit files, stage, commit, push, post PR comments, rerun hosted CI, or call provider-backed services.
  - Exception: append the completed review record to `docs/branch-review-ledger.md` so throttling state persists.
- If the user clearly asks to fix confirmed findings, make the smallest safe change and verify with local, static, or mocked checks first.
- Ask before any OpenAI, Supabase, GitHub/GitLab, hosted CI, or provider-backed workflow.
- After any completed local or branch-cleanup review, update `docs/branch-review-ledger.md` with date, branch/ref, HEAD, scope, outcome, and checks. This ledger append is allowed even during a pure review when the ledger is in scope for that path.

## Severity Guide

- P0: Data loss, security breach, production outage, or clinical safety issue likely to harm users immediately.
- P1: Broken core workflow, unsafe automation, privacy/auth failure, or repeatable defect that blocks merge/handoff.
- P2: Real defect, missing guardrail, fragile process, or test gap that should be fixed before relying on the work.
- P3: Low-risk cleanup, clarity, documentation, or future-proofing issue.
