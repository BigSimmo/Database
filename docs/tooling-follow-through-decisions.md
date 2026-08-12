# Tooling follow-through decisions (#150 and #151)

**Status:** accepted 2026-08-12

**Scope:** documentation only; no provider, billing, credential, or repository-setting changes were made.

## #150 — Reviewer-bot billing and review policy

**Decision:** Any automated reviewer bot (CodeRabbit, Codex, or equivalent) is treated as unavailable, not as a required or completed reviewer, when its usage or spending cap prevents a review. This PR does not raise caps, change billing, or add label-based review automation. Funding or re-enabling any reviewer bot remains an explicit operator decision outside this repository.

Practical effect:

- A CodeRabbit usage-limit, spending-cap comment, or Codex quota/limit notice is evidence that no substantive review occurred from that bot; it must not be counted as reviewer coverage.
- PR readiness rests on the repository's applicable local/CI gates and substantive review evidence actually present. It must not assume fallback coverage from any capped reviewer.
- A future operator may fund or reconfigure a reviewer bot, but the policy changes only after a PR demonstrates a substantive review rather than a cap or limit notice.

This rule is bot-agnostic: it applies equally to CodeRabbit spending-cap comments and Codex quota-limit notices.

This accepts the cost of no CodeRabbit coverage instead of leaving an apparently enabled reviewer as an implicit safety claim.

## #151 — Observing GitHub Actions CI

**Decision:** `gh pr checks` is convenient only when the credential can read Checks. A failure from that command does not establish that CI is absent or unverifiable. With an Actions-read credential that lacks Checks-read permission, observe the workflow runs for the PR head SHA through the Actions API.

Reproducible read-only procedure (when provider access is separately authorized):

1. Resolve the PR head SHA from trusted PR metadata.
2. Query `GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}` (for example, `gh api "repos/BigSimmo/Database/actions/runs?head_sha=$sha"`).
3. Inspect each returned workflow run's `name`, `status`, `conclusion`, `head_sha`, and URL; require `head_sha` to equal the PR head before attributing the result.
4. For any run whose `name` is `ci` (the repository's required CI workflow), also query its jobs: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`. Locate the job whose `name` is `PR required` and verify its `conclusion` is `success`. The `PR required` job is the repository's single required aggregate gate (`.github/workflows/ci.yml`); a workflow run that completed without that job succeeding does not prove that required CI passed.
5. Report missing required workflows, a missing `PR required` job, or any non-success conclusions explicitly. Do not translate an empty legacy commit-status response into "no CI."

Interpretation rules:

- `gh pr checks` or the check-runs endpoint returning `Resource not accessible by personal access token` means the credential cannot read Checks.
- `GET /commits/{sha}/status` returning zero legacy statuses does not prove that Actions workflows did not run.
- The Actions API is the supported fallback for observation only; it does not authorize reruns, cancellations, approvals, merges, or other writes.
- If neither Checks nor Actions can be read, report CI as unobserved because of credential capability—never as passing, absent, or failed.
