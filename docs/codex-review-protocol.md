# Codex Review Protocol

Use this protocol for every Codex review, audit, bug hunt, PR review, release-readiness check, and branch-cleanup review in this repository.
`AGENTS.md` owns authority and routes review intent here; this document owns the
detailed review procedure. It does not grant GitHub or provider mutations by itself.

## Trigger and Scope

- Do not start a review opportunistically.
- Review only when the user request, `AGENTS.md` routing rules, or an explicit handoff/release workflow calls for it.
- Review the current diff, named PR, named branch, or explicitly requested area.
- Do not expand into stale branches or unrelated modules unless a confirmed defect crosses that boundary.
- Before branch or PR review, check `docs/branch-review-ledger.md` with `npm run ledger:lookup -- <branch-or-ref> --scope "<scope>"`. It resolves the HEAD, matches abbreviated SHAs, and prints an explicit verdict. Skip unchanged completed reviews unless the user asks for a fresh pass. Do not scan the table by eye.
- Treat GitHub automatic review as one pass per pull request. A repair commit or later head does not authorize another automatic pass; require an explicit human request before re-reviewing.
- Repair invocation must be authored by a human. The repository workflow never posts repair commands or routes repair by labels, paths, churn, or complexity; it only resolves an existing thread after a trusted Codex disposition reply passes the exact marker, identity, relationship, and head checks below.
- Ready PRs must pass the trusted `PR policy` metadata check. It reads only the base-branch policy implementation, never executes PR code, and requires concrete verification plus risk/rollback evidence for high-risk changes.

## Review Bot Quota Conservation (Inbox `9864a5d7`)

PR churn and unthrottled reviews quickly exhaust review-bot spending caps and rate limits (e.g., CodeRabbit and Codex connector allowances; see Inbox `9864a5d7`). When quotas are exhausted, PRs land with zero automated review, increasing defect risk during churn spikes. To protect review-bot budget:

- **Skip repeat passes on unchanged SHAs**: Never re-review a commit, branch, or PR head whose HEAD SHA and scope have already been reviewed. Automated routines, babysit sweeps, and CI jobs must check prior review records and skip repeat reviews when the tree has not changed.
- **Resolve SHAs via `npm run ledger:lookup`**: Always verify review state using `npm run ledger:lookup -- <branch-or-ref> --scope "<scope>"`. It resolves the full 40-character commit SHA, matches against live rows, archives (`docs/archive/branch-review-ledger-*.md`), and immutable records (`docs/branch-review-records/*.record.md`), and prints an explicit `ALREADY REVIEWED` or `NOT REVIEWED at this HEAD` verdict. Never scan or eyeball ledger tables manually.
- **Enforce a single review pass per PR head (#328)**: Automated review is strictly limited to one pass per PR HEAD. Intermediate repair commits, formatting adjustments, or routine base syncs do not authorize automatic re-reviews without explicit human approval. Prevent review row thrashing or rows outliving completion (#328) by immediately appending an immutable record with `npm run ledger:append` upon completing a review.

## Review Output

- Lead with findings, ordered by severity: P0, P1, P2, then P3.
- For automatic PR reviews, emit no more than three inline findings and reserve them for P0/P1 defects. Consolidate non-blocking P2 context into one summary and omit P3 feedback.
- Each finding must include file/line evidence, trigger or failure path, expected behavior, actual risk, and the smallest proof or check that would catch it.
- If no high-confidence issue is found, say so clearly and name the highest residual risk area.
- Include checks run, checks not run, and whether any check was skipped because it could touch an API/provider.
- Keep summaries secondary to findings.

## GitHub access routing

For a review or audit naming a GitHub/remote target, the necessary low-cost read-only metadata is
authorized by that task; use the GitHub connector or native Cloud controls first. Hosted writes,
sensitive or production/customer data, and paid calls remain separately gated.
Their permissions are independent of `gh` in the agent shell. Run
`npm run check:github-shell-access:live` (which passes `--allow-provider` and does not pass
`--self-test`) only before an intentional GitHub CLI fallback.
`ALLOW_GITHUB_SHELL_ACCESS=true` or `--allow-provider` on a direct
`node scripts/check-github-shell-access.mjs` invocation (without `--self-test`) authorize the
same live path. The plain `npm run check:github-shell-access` entry is always offline
`--self-test`; ambient opt-in cannot convert it into provider traffic.
`GH_AUTH_MISSING` means shell authentication is absent, not that the hosted connector is
disconnected. Never add a PAT to an ordinary Cloud task.

If an explicitly authorized Cloud Run PR task lacks direct publication, review-thread, or Actions
tools, `BigSimmo` may send the default-branch-owned `codex-run-pr-operator` `repository_dispatch`
event for the target same-repository feature PR. Its `client_payload` requires the PR number, the
authorizing Codex task URL, and the exact typed confirmation documented in `docs/codex-cloud.md`;
comments and every other event cannot authorize it. Its Codex
repair job has no GitHub write credential; later clean jobs verify the exact head and operator
identity before an ordinary push, bounded reply/resolution, or one genuine failed-job rerun. Do not
use this trigger on protected heads, fork PRs, or as a substitute for PR merge/close authority.

## Mutation Rules

- For a pure review request, do not edit files, stage, commit, push, post PR comments, rerun hosted CI, or make paid/sensitive provider calls. Necessary low-cost metadata reads for a named remote target remain allowed.
  - Exception: create the completed immutable review record with `npm run ledger:append` so throttling state persists.
- If the user clearly asks to fix confirmed findings, make the smallest safe change and verify with local, static, or mocked checks first.
- During a human-authorized repair task, work only the requested existing unresolved Codex threads. Do not start a new review, add standalone findings, or request another review.
- After fixing or fully dispositioning a thread, start the reply with `<!-- codex-thread-disposition:resolved -->`, then declare exactly one result: `<!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->` for a published fix or `<!-- codex-thread-result:no-change -->` for a no-code disposition. The workflow closes a fixed thread only when the reported commit is the pull-request head. A local-only commit is not a fix; when publication, verification, human input, or new authorization blocks completion, use no result marker and leave the thread open with a concise reason.
- A named remote review may use the low-cost read-only metadata needed to inspect that target.
  Hosted comments, reruns, thread resolution, pushes, paid/provider calls, production/customer
  data, and every other mutation require the explicit authority defined in `AGENTS.md` or `$run-pr`.
- The disposition bridge serializes by PR plus parent-thread/comment identity so distinct threads cannot evict one another. It rechecks live PR state/head before and after resolution and compensates by unresolving the thread with a visible failure if either changes.
- After any completed branch/PR review, create an immutable record with `npm run ledger:append -- --ref <x> --head <full-sha> --scope <s> --outcome <o> --checks <c>`. Record the full 40-character SHA; `see PR head` and abbreviations make the record unmatchable and cause the review to run again. The historical table is frozen for normal PRs: never edit or delete an existing record; append a correction or superseding record (`--supersede`) instead. This record creation is allowed even during a pure review. Do not hand-write a record — hand-written rows are what produced the mojibake, wrong-width, and duplicate records the 2026-07-28 hygiene pass had to repair. Do not push a tip whose sole delta is a babysit record.

## Ledger Rotation

The historical table is frozen now that new records are immutable files, so ordinary quarterly rotation is retired. Lookup, sweep, and integrity checks read the live table, archives, and immutable records. Do not hand-move rows or delete unique review content; any exceptional historical repair needs a dedicated, explicitly reviewed migration because write-discipline checks reject row changes.

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

The output records the local base/head and expected merge-tree. For an audit naming a PR/repository, the necessary low-cost GitHub checks, labels, review threads, and fresh refs are authorized metadata reads. Add `--providers --pr <number> --repo BigSimmo/Database` and set `ALLOW_PROVIDER_READS=true`; that flag is a fail-closed tool acknowledgement, not extra authority. The audit requires the repository's `pr-required` aggregate to be present and successful. A named post-merge health target may be read with `--post-merge --expected-tree <pre-merge-tree> --health-url <production-origin>/api/health`; sensitive data, paid calls, and every mutation remain separately gated. The script never merges, pushes, reruns CI, resolves threads, or deploys.

## CI observation fallback (when Checks-read is unavailable)

If `gh pr checks` or the check-runs endpoint returns `Resource not accessible by personal access token`, the credential cannot read Checks. For a named remote review/audit target, use the Actions API as the authorized low-cost read-only fallback:

1. Resolve the PR head SHA from trusted PR metadata.
2. Query `GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}` and require `head_sha` to match the PR head before attributing any result.
3. Require a matching Actions workflow run named "CI" for the trusted PR head SHA; if none exists, report CI as unobserved rather than passing, absent, or failed.
4. For the "CI" workflow run, query its jobs (`GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`) and require the `PR required` job. Explicitly report whether that job is missing or has a non-success conclusion. That job is this repository's single required aggregate gate; a run that completed without it does not prove required CI passed.
5. If neither Checks nor Actions can be read, report CI as unobserved due to credential capability — never as passing, absent, or failed.
6. An empty `GET /commits/{sha}/status` response does not prove that Actions workflows did not run.
