# Codex Review Throttling & Thread Resolution

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

Do not review branches opportunistically. Review the current changed diff, PR, or branch only when the user explicitly asks for review/audit/hunter/cleanup/upload work, when CI/check failures are the task, or when the current change touches high-risk areas that require a targeted review before handoff.

Use `docs/codex-review-protocol.md` as the shared review protocol for every repo-local review skill, branch/PR review, audit, bug hunt, release-readiness check, and PR/CI review.

Before reviewing a branch or PR:

- Run `npm run ledger:lookup -- <branch-or-ref> --scope "<scope>"`. It resolves the HEAD, matches the abbreviated SHAs older records used, and prints an explicit verdict. Do not read `docs/branch-review-ledger.md` by eye — live + archive rows are many, and eyeballing is how repeat reviews slipped through. `ledger:lookup` reads archives under `docs/archive/branch-review-ledger-*.md` too.
- On `ALREADY REVIEWED`, summarize the prior ledger outcome and skip the repeat review unless the user explicitly requests a fresh pass.
- On `NOT REVIEWED at this HEAD`, review only the changed scope and append a record after the review.

Before reviewing multiple branches:

- Build a short branch inventory first: branch, upstream, ahead/behind, last commit, and merged status.
- Skip branches already merged into `main`.
- Skip unchanged branches already recorded in `docs/branch-review-ledger.md`.
- Do not re-review every branch after ordinary coding tasks.
- If a repeated request targets unchanged reviewed branches, summarize the prior result and ask before doing another full pass.

Review routing:

- `diff-review`: Use for explicit review of the current diff, PR, or named branch. Findings first, ordered by severity, with file/line evidence.
- `bug-hunter`: Use only for the exact `bug-hunter` shortcut or an explicit defect-hunt request. Prioritize reproducible bugs and smallest proof.
- `repo-auditor`: Use for explicit repo-wide audit/refactor/dead-code/import/dependency-structure requests. Treat outputs as triage, not automatic delete lists.
- `release-readiness`: Use for explicit release, merge, PR readiness, or handoff confidence requests. Do not run provider-backed gates without confirmation.
- `branch-cleanup`: Use only when the prompt explicitly asks for branch cleanup/hygiene or branch deletion candidates. Apply `docs/branch-cleanup-guide.md` and the review ledger before inspecting branch diffs.
- `pr-ci-fix`: Confirmation-required for this repo. GitHub/GitLab API calls, PR comments, CI reruns, commits, and pushes require explicit user approval and must respect the upload/handoff rules. Exception: an explicit `Run PR` sweep carries this approval (see "## Run PR shortcut").

When a branch or PR review completes, record it with `npm run ledger:append -- --ref <x> --head <full-40-char-sha> --scope <s> --outcome <o> --checks <c>`. It creates one content-addressed immutable record file, so concurrent reviews never edit a shared Markdown hunk. Never hand-write a record: hand-written rows produced the mojibake, wrong-width, and duplicate records that the 2026-07-28 hygiene pass had to repair, and `see PR head` or abbreviated HEADs make the throttle unreliable. The legacy Markdown table is frozen for normal PRs; append a correction or superseding record (`--supersede`) instead. `npm run check:branch-review-ledger` validates all sources, while `check:ledger-write-discipline` rejects a legacy-table row change before it becomes a GitHub conflict.

Babysit / Run PR ledger policy: do not push a tip whose sole delta is a babysit review record (that marks every other open PR behind). One Run PR record per PR per sweep; on a later sweep of the same PR, pass `--supersede` rather than stacking another "main sync" record.

<!-- END:codex-review-throttling -->

<!-- BEGIN:resolve-review-threads-after-fixing -->

## Resolve review threads after fixing them

Pushing a fix is not the end of the task when that fix was made in response to a GitHub PR
review comment. Resolving the corresponding review thread is part of the same unit of work,
not a follow-up to remember later — an addressed comment left unresolved still blocks merge
and still reads to reviewers, merge-queue tooling, and `pr-policy.mjs`-style gates as
unaddressed.

- After pushing a fix for a review comment, reply on that thread with a short summary of what
  changed (naming the fixing commit where useful), then resolve the thread once the fix is
  pushed — reply first, resolve second, both before moving to the next item.
- Only resolve a thread you actually fixed or fully dispositioned. Never resolve a thread you
  did not act on, never resolve one to tidy away feedback you disagree with, and never resolve
  a thread on a PR you are only watching on someone else's behalf — leave those for the PR's
  owner or reviewer.
- If the comment needs more than a direct fix (a design decision, missing context, reviewer
  input), reply explaining why instead of resolving, and leave the thread open.
- This does not grant new GitHub write access or user authorisation for separate provider
  writes. Reply and resolve only when the user explicitly authorised those actions for that PR
  (for example, an explicit PR-fixing/babysitting sweep that names replies or thread resolution,
  or the `Run PR` shortcut where that authority is stated) and the available tooling permits
  them. If the user's ask was scoped to only committing and pushing the fix, stop there and tell
  them the reply/resolve step is still open rather than performing it unasked.
- This applies to every PR you push review-responsive fixes to in this repo, not only the
  automated Codex resolve workflow — see "Review comment lifecycle" in `docs/agents/codex-github-review.md` for that workflow's
  specific marker convention, and your runtime PR-babysitting instructions for the fuller
  human-reviewer posture this section summarizes.

<!-- END:resolve-review-threads-after-fixing -->
