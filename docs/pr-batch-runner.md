# Sequential PR batch runner

The **PR batch runner** prepares and merges a fixed snapshot of pull requests one
at a time. It ships disabled. Installing these workflows does not authorize a
batch, spend repair tokens, modify repository settings, or merge a PR.

## Chat shortcut

After activation and the single-PR pilot, say **`Clear PRs`** in a Database task.
The agent starts a fixed snapshot of eligible open PRs, continues an existing
running batch, or resumes a paused batch once its blocker is resolved. The phrase
authorizes the batch's repairs, protected merges, and resulting Railway
deployments without another launch confirmation. Defaults remain three repair
sessions per PR and thirty per batch. Full dispatch and authorization procedure:
[`Clear PRs shortcut`](agents/pull-request-workflow.md#clear-prs-shortcut).

The shortcut is available to agents that read this repository's `AGENTS.md`.
Installing it locally does not publish or activate the GitHub runner.

## Activation

After separately authorizing activation, verify the repository's current rules,
the intended human `GH_TOKEN` identity (`BigSimmo`), and `OPENAI_API_KEY` availability.
The human token needs the existing operator permissions plus repository variable
reads, Actions dispatch/rerun, and Git data writes for the state branch. Never put
credentials in dispatch inputs or the state branch.

Required protection includes `Gitleaks`, `PR policy`, `PR required`, PR reviews,
resolved conversations, and current-base validation (strict checks or native
merge queue). The runner refuses unreadable or insufficient protection. It uses
the existing merge method: merge commits when enabled, otherwise squash. It does
not create a merge queue, change rules, approve reviews, or bypass protection.

1. From Actions, launch **PR batch runner** on `main` with `operation: dry-run`.
   This reads GitHub metadata and reports eligible/excluded candidates. It does
   not create the state branch, start Codex, update branches, or arm a merge.
2. Set repository variable `PR_BATCH_ENABLED` to the literal `true` only after
   approval. The absence of this variable is the default disabled state.
3. Start one low-risk docs PR using `operation: start`, `pr_numbers: <number>`,
   and a genuine desktop `codex://threads/<UUID>` or supported cloud Codex task
   URL in `authorization`. The URL is an audit reference, not authentication.
4. Enter the exact confirmation:

   `Authorize this batch: repairs, GitHub writes, protected merges and Railway deployments`

5. Verify the actual merge and audit state before starting a larger batch.

Launching the batch explicitly authorizes feature-branch commits and updates,
review replies/resolution, bounded failed-job reruns, Codex API repairs, protected
merges, and the resulting Railway app/worker production deployments. Supabase
migrations remain excluded. Ordinary `Run PR` keeps its maintenance-only scope.

## Controls and defaults

| Input             | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `operation`       | `dry-run`, `start`, `resume`, `pause`, or `status`                                       |
| `pr_numbers`      | Optional comma-separated PRs; empty captures currently open main-target PRs, at most 200 |
| `authorization`   | Desktop task reference or cloud task URL, recorded at launch                             |
| `confirmation`    | Exact authorization phrase, required for start and resume                                |
| `per_pr_limit`    | Three model repair sessions by default; accepted range 1–6                               |
| `batch_limit`     | Thirty model repair sessions by default; accepted range 1–100                            |
| `canary_evidence` | Optional existing canary run pairs, described below                                      |

Order is oldest first, with explicit `Depends-on: #123` lines taking precedence
inside the snapshot. Cycles are excluded. Dependencies outside the snapshot
remain blockers; a later batch may include them. New PRs are never absorbed.

Only BigSimmo may start, resume, or pause. Status is read-only. Pause is checked
before mutations and does not revoke an already-issued merge request. The report
identifies an armed active PR. Stop that merge through an explicit manual action
if necessary; this runner never disables or silently rearms auto-merge.

An unarmed PR with no actionable progress for two hours is parked. A batch pauses
after 24 hours until explicitly resumed. Attempts are not reset on resume or the
single conditional retry pass. A repeated failure fingerprint with no progress
stops early. Limits count model sessions, not a guaranteed dollar amount; failed
publication/mutation jobs may be recovered once without rerunning the model.

## Processing and evidence

The controller checks live head/base, eligibility, reviews, and checks. It proves
reported conflicts with `git merge-tree`. A sync-only PR needs no Codex session.
When repair is necessary, the worker combines the base merge and fixes into one
publication, runs the smallest relevant checks plus formatting, and returns a
sealed result. Git metadata and GitHub write credentials remain outside Codex's
repair authority. Ambiguous/protected conflicts are left for a person.

Required checks and already-started non-provider advisory lanes settle before
merge handoff. New review activity invalidates thread-resolution evidence. The
publisher rechecks ownership, eligibility, head and base; the merger additionally
rechecks all readiness evidence. Missing checks/approvals never count as green.

The existing auto-fix bridge yields for reserved PRs. Manual PR operator runs use
the same reservation state. External head changes pause for revalidation rather
than overwriting another task's work. Already-armed/enqueued PRs block launch,
including PRs outside the requested subset.

RAG protected candidates require existing verified before/after canary evidence;
the runner does not infer no behavior change from a PR body's assertion. Optional
`canary_evidence` is JSON keyed by PR number:

```json
{ "123": { "head": "<exact PR SHA>", "base": "<exact main SHA>", "baseline_run": 100, "post_run": 101 } }
```

Both runs must be successful scheduled/manual `eval-canary.yml` executions at
the claimed SHAs, use the trusted workflow, and retain their `eval-canary-output`
artifact. Golden quality results must have document/content recall 1.0 and no
per-case reciprocal-rank regression. Artifacts are read only; no evaluation is
launched. A changed head/base invalidates the pair. Any repair to a RAG candidate
requires refreshed evidence and is conservatively refused by the publisher.

The runner also excludes drafts, forks, opt-outs, protected branches, migrations,
controller/workflow changes, authorization/security policy and deployment/provider
configuration. Clinical governance preflight must already be satisfied; an agent
cannot manufacture the missing approval.

## Recovery and reporting

State lives on `codex/pr-batch-state`, an orphan JSON-only branch, separate from
application code and deployment triggers. Its manifest is immutable. Each
transition creates a state commit and a new event JSON record; updates are
fast-forward against the observed parent. Do not edit, force-push, merge, or delete
this branch as part of normal queue operation.

GitHub completion events drive short reconciliations. A secret-free review signal
workflow relays completed review activity to the trusted controller. A 15-minute
schedule recovers missed wakes. Neither mechanism invokes Codex during waiting.
The schedule runs no controller job when disabled. GitHub Actions execution time
still has its normal cost.

Each external operation is journaled before execution. Replies carry unique
operation markers; resolution checks the reply is still the last thread activity.
Failed-job reruns are bound to a recorded run attempt. A lost response is reconciled
before any retry. Ambiguous ownership, authentication failure, policy changes, or
an unobserved merge request pause the batch rather than guessing.

Use `status` for the current report and `resume` after resolving the stated blocker.
If installed controller policy changed, an explicit confirmed resume records its
new digest without rewriting the original manifest. Worker artifacts are retained
for seven days so a stale-base or publication failure remains reviewable.
Keep an armed PR in the active slot. Do not manually launch another repair session
for it while a recorded worker is queued or running.

Reports distinguish `all_merged`, `completed_with_unresolved`, and `paused`, and
include merge commits, parked/excluded reasons, and repair counts. Actual merge
inclusion in `main` is required before advancing. Post-merge CI failures observed
during the active batch pause further mutations; merged does not mean deployment
health was verified. This is a finite batch, not ongoing production monitoring.
