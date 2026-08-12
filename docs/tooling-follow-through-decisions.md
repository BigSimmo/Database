# Tooling follow-through decisions (#150 and #151)

**Status:** accepted 2026-08-12

**Scope:** documentation only; no provider, billing, credential, or repository-setting changes were made.

## #150 — CodeRabbit billing and review policy

**Decision:** CodeRabbit is treated as unavailable, not as a required or completed reviewer, while its organization usage spending cap prevents reviews. This PR does not raise the cap, change billing, or add label-based review automation. Funding or re-enabling CodeRabbit remains an explicit operator decision outside this repository.

Practical effect:

- A CodeRabbit usage-limit or spending-cap comment is evidence that no CodeRabbit review occurred; it must not be counted as reviewer coverage.
- PR readiness rests on the repository's applicable local/CI gates and substantive review evidence actually present. It must not assume CodeRabbit fallback coverage.
- A future operator may fund or reconfigure CodeRabbit, but the policy changes only after a PR demonstrates a substantive review rather than a cap notice.

This accepts the cost of no CodeRabbit coverage instead of leaving an apparently enabled reviewer as an implicit safety claim.

## #151 — Observing GitHub Actions CI

**Decision:** `gh pr checks` is convenient only when the credential can read Checks. A failure from that command does not establish that CI is absent or unverifiable. With an Actions-read credential that lacks Checks-read permission, observe the workflow runs for the PR head SHA through the Actions API.

Reproducible read-only procedure (when provider access is separately authorized):

1. Resolve the PR head SHA from trusted PR metadata.
2. Query `GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}` (for example, `gh api "repos/BigSimmo/Database/actions/runs?head_sha=$sha"`).
3. Inspect each returned workflow run's `name`, `status`, `conclusion`, `head_sha`, and URL; require `head_sha` to equal the PR head before attributing the result.
4. Report missing required workflows or non-success conclusions explicitly. Do not translate an empty legacy commit-status response into “no CI.”

Interpretation rules:

- `gh pr checks` or the check-runs endpoint returning `Resource not accessible by personal access token` means the credential cannot read Checks.
- `GET /commits/{sha}/status` returning zero legacy statuses does not prove that Actions workflows did not run.
- The Actions API is the supported fallback for observation only; it does not authorize reruns, cancellations, approvals, merges, or other writes.
- If neither Checks nor Actions can be read, report CI as unobserved because of credential capability—never as passing, absent, or failed.
