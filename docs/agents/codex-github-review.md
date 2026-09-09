# Codex GitHub Review Behavior & Auto-Fixer

<!-- BEGIN:codex-github-review -->

## Codex GitHub review behavior

These instructions apply to Codex GitHub pull request reviews and Codex tasks started from PR comments.

- Keep automatic reviews focused and cost-conscious.
- Prioritize high-confidence findings that affect correctness, security, privacy, data loss, auth/permissions, migrations, API contracts, production reliability, clinical behavior, source governance, or user-facing behavior.
- Do not comment on formatting, naming, style, minor cleanup, or speculative refactors unless they create a real bug or maintainability risk.
- Prefer fewer, stronger findings over exhaustive low-value review comments.
- An automatic review may emit at most three inline findings total. Use inline comments only for P0/P1 issues; put non-blocking P2 context in one summary and omit P3 feedback.
- A finding must cite concrete changed code and explain the failure mode.
- Do not suggest broad rewrites during review. Recommend the smallest change that resolves the issue.
- Do not propose or start fixes unless explicitly asked with an `@codex fix...` or `@codex resolve...` comment, or when the repository's Codex auto-resolve workflow posts that command.
- Treat automatic review as single-pass per pull request. Do not re-review a later head, repeat a prior finding, or create another review during an auto-resolve task unless a human explicitly requests a fresh review.

### Severity calibration

- P0: active security exposure, data loss/corruption already possible, severe production outage risk, credential leakage, or a critical issue that must be fixed immediately.
- P1: security vulnerability, auth bypass, data exposure/loss, destructive migration risk, production-breaking regression, public API contract break, severe clinical/user-facing bug, or missing validation with realistic exploit/failure impact.
- P2: important correctness bug, missing behavior test for meaningful changed behavior, edge case likely to affect users, reliability issue, unsafe assumption, or maintainability issue that will likely cause defects.
- P3: style, naming, formatting, small cleanup, speculative improvements, or optional refactors. Avoid raising these in automatic reviews unless explicitly requested.

For GitHub automatic reviews, focus mainly on P1-level findings. If a P2 issue is important enough to block the PR, explain why it should be treated as P1.

### PR risk detection

When reviewing, identify whether the PR touches any high-risk area:

- authentication or authorization
- user data, privacy, or private document access
- database schema, migrations, RLS, SECURITY DEFINER functions, or Supabase privileges
- clinical answer generation, source governance, retrieval/ranking, ingestion, or document access
- payment, billing, subscriptions, or quotas
- public API contracts
- production configuration or deployment behavior
- background jobs, scheduled tasks, workers, or queue processing
- file upload/download or generated document access
- AI/API provider calls, paid external services, or credential-dependent workflows

If a high-risk area is touched, review more carefully for regressions, missing tests, rollback/safety notes, and conservative failure behavior.

### Cost and usage control

Avoid broad repeated review passes. Do not request exhaustive review behavior unless the PR touches security, auth, data loss, migrations, billing, production reliability, clinical output, source governance, or private document access. Prefer targeted validation and targeted review comments. A new commit from the automatic repair task is not permission for another automatic review.

### Fix behavior

When explicitly asked to fix or resolve review findings:

- Always fix P0 and P1 findings using the best minimal fix.
- For P2 and lower-severity findings, decide whether the issue is worth fixing automatically.
- Fix a P2 or lower finding only when the fix is clear, scoped, low-risk, and testable.
- Do not automatically fix a P2 or lower finding when it requires broad refactoring, product judgment, dependency changes, credentials, paid/external APIs, large design decisions, or risky behavior changes.
- If a P2 or lower finding is not worth fixing automatically, comment with the reason and the recommended human decision, then resolve the review conversation when supported.
- Preserve unrelated work and avoid opportunistic refactors.
- Do not add dependencies unless the issue cannot reasonably be fixed without one.
- Do not change secrets, credentials, environment configuration, billing settings, deployment settings, or external service setup unless explicitly requested.
- Do not use external APIs, paid services, credentials, secrets, live Supabase projects, or OpenAI provider calls unless explicitly authorized.
- If a finding is ambiguous, unsafe to fix automatically, or requires a large rewrite, stop and explain the decision instead of guessing.
- Add or update the smallest relevant test when the issue affects behavior.
- Run the narrowest relevant validation for the touched surface before broader suites.
- Summarize fixed issues, changed files, validation run, and any remaining human decisions.

### Review comment lifecycle

- Treat closing review conversations as part of the task when asked to fix or resolve comments.
- After fixing a P0 or P1 finding, reply with the fix summary and resolve the review conversation when supported by GitHub permissions/tooling.
- After fixing an approved P2 or lower finding, reply with the fix summary and resolve the review conversation when supported.
- After deciding not to fix a P2 or lower finding, reply with the reason, note whether it is deferred or not actionable, and resolve the review conversation when supported.
- For every fixed or fully dispositioned thread, start the thread reply with `<!-- codex-thread-disposition:resolved -->`. On the next line, use `<!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->` for a code fix or `<!-- codex-thread-result:no-change -->` for a no-code disposition. The workflow closes the thread only when exactly one result is declared and a reported fixed commit is the pull request head.
- Do not use the marker when human input or new authorization is required; explain the blocker and leave that thread open.
- Do not leave a review conversation open after it has been fixed or fully dispositioned. If direct resolution is unavailable, the marker reply is the required fallback and the workflow performs the closure.

### Automatic resolve trigger

Automatic Codex review is review-only by default. This repository includes `.github/workflows/codex-autofix-review-comments.yml`, which requests the resolve task automatically after Codex submits a completed PR review that raised findings and the pull request passes the repository's risk/complexity router.

- The auto-resolve request must fire only from a Codex-authored `pull_request_review` **submitted** event on an open pull request — never from the first inline comment mid-review. This guarantees the request is posted only after a code review completes; without a review there are no findings and the request is pointless.
- The request job must skip reviews with no actionable findings: skip `approved`/`dismissed` reviews, and skip when the submitted review carries zero inline comments.
- Route automatic repair only when at least one changed path is high-risk, when the pull request changes at least 10 non-test source files or 300 non-test source lines, or when the `codex-review` label explicitly opts in. Treat `skip-codex-review` as an unconditional opt-out that wins if both labels are present.
- **Clinical-decision surfaces are never routed to automatic repair**, whatever the finding's severity and whatever the routing rule above would otherwise say. The held paths are `data/**` (except `data/outstanding-issues-snapshot.json`), `src/data/**`, `src/lib/mha-act-sections.ts`, `src/lib/form-catalog.ts`, `src/lib/form-ranker.ts`, `src/components/forms/**`, `src/lib/rag/**`, and the named ranking/answer surfaces `clinical-search`, `retrieval-selection`, `released-search-order`, `ranking-config`, `answer-ranking`, `answer-verification`. The hold is evaluated before routing and has **no override**: the `codex-review` opt-in label does not release it, and a diff that also touches tests or generated files is still held. Codex still reviews these pull requests and its findings still post as inline comments — only the unattended write is withheld, so a human decides.

  Why this exists: a review finding can be sound as a code observation and wrong as an action. On PR #2314 a P1 finding contradicted the owner's explicit decision to display drafted Mental Health Act summaries behind an awaiting-review label; the automatic pass applied it, inverting the render gate and collapsing the Act-sections card from 54 forms to 1, and additionally hardcoding every summary as reviewed. The rationale for the owner's decision was written down in `docs/wiring-conventions.md` and nothing consulted it. "Always fix P0 and P1 findings" therefore stops at these paths: on a clinical surface a bot's severity label is not authority to overwrite a human decision. Enforced by `scripts/check-codex-autofix-workflow.mjs` and `tests/codex-autofix-workflow.test.ts`; do not weaken either to let a specific pull request through.

- High-risk paths include migrations/RLS, application API routes, auth/permissions/privacy/security, clinical/RAG/retrieval/search/source/document behavior, provider or production configuration, dependencies, and CI/release workflows. Do not route docs-only, test-only, generated-only, or small low-risk UI/copy changes unless explicitly opted in.
- Read changed-file metadata through the GitHub API only; never check out or execute pull-request code in the routing job. Record the selected route in a hidden `codex-autoresolve-route` marker for auditability.
- Match the trusted Codex connector bot by exact login and bot type; do not use substring login checks.
- Keep per-pull-request concurrency on the authorized job, not the whole workflow, so unrelated events cannot displace a pending Codex request.
- Pin the supported Node 24-based `actions/github-script` release to its reviewed immutable commit SHA.
- Post the `@codex` resolve request with a real (non-bot) user identity — a fine-grained PAT held in the `CODEX_TRIGGER_TOKEN` secret. The Codex connector ignores commands authored by `github-actions[bot]`, so a bot-authored request is silently dropped. The token needs `pull-requests: write` (issue-comment) access and no more.
- The workflow must treat unmarked review-thread replies as inert. A trusted Codex reply beginning with `<!-- codex-thread-disposition:resolved -->` may only resolve the exact containing thread, and a non-reply Codex review comment must never be turned into a new repair request.
- The workflow must ask Codex to resolve only existing actionable Codex review findings for the triggering pull request and current head using these repository instructions; the resolve task must not perform a new review or create new findings. It must name the exact repository and PR head branch, require fixes to be published there through the authenticated GitHub connector, forbid detached `work` branches and stacked pull requests, and treat a local-only commit as a visible failure.
- The workflow may request one automatic repair pass per pull request lifetime. Later heads require an explicit human request.
- Only trust a pull-request deduplication marker when it was posted by the trigger-token account (the same identity that posts the request), resolved at runtime rather than hard-coded.
- Permission failures while reading or creating pull-request comments must fail the workflow visibly, not return a successful soft-skip.
- Grant `pull-requests: write` only to the narrow marker-driven thread-resolution job; the request job runs with read-only repository contents and relies on the trigger token's own scope, and neither job approves reviews or alters code.
- The workflow must not run Codex directly with API credentials.
- P0 and P1 findings should always be fixed.
- P2 and lower findings should be fixed only when clear, scoped, low-risk, and testable; otherwise explain the decision and resolve or mark ready for human resolution.

### Primary PR command

`@codex resolve actionable Codex review findings for this pull request and current head using the repository instructions. This is the pull request's single automatic repair pass: do not perform a fresh review, create new standalone findings, or request another review. Work only the existing unresolved Codex threads on the current head. The workflow will provide the only allowed repository, pull-request head branch, and starting commit. Publish every approved fix to that exact head branch through the authenticated GitHub connector; never use a detached or synthetic work branch and never create a stacked pull request. Verify the pull-request head contains the pushed commit before reporting success. Always fix P0 and P1 findings. For P2 and lower findings, fix only clear, scoped, low-risk issues; otherwise disposition them with a concise reason. For a fixed thread, reply with <!-- codex-thread-disposition:resolved --> followed by <!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->. For a no-code disposition, use <!-- codex-thread-disposition:resolved --> followed by <!-- codex-thread-result:no-change -->. A local-only commit is not a fix. If publication or verification fails, use neither result marker, do not claim success, and leave the thread open with the blocker. Finish only after every actionable thread is fixed or dispositioned and closed, or explicitly left open for a human decision. Do not update the branch from main, address unrelated reviews, broaden scope, or create more than one scoped fix commit. Do not use external APIs, paid services, credentials, dependency changes, or broad refactors unless explicitly authorized. Add targeted tests where behavior changes and run the narrowest relevant validation.`

<!-- END:codex-github-review -->
