---
name: upload
description: Safely publish Database work or babysit a PR.
---

# Upload and PR handoff

1. Inspect branch/HEAD/status/diff; isolate unsafe state.
2. Snapshot branch/HEAD, cached index, and intended porcelain; recheck before staging/commit. Abort on drift/unrelated staging. Stage named paths; never unstage user work.
3. Exact `upload` authorizes named staging, commit, and feature push—not merge, force, deletion, deploy, protected push, or unrequested PR creation.
4. For ordinary upload or handoff, run `npm run format`; commit, verify, and push with hooks. Bare publication is the exception.
5. Bare `open PR`, `create PR`, or `publish PR`: inspect branch/base/diff/metadata. Do not run format, tests, builds, readiness checks, or CI observation.
6. Bare commit-hook block: use `git commit --no-verify`. Readiness-only push-guard block: use only `SKIP_FORMAT_GUARD=1 git push`, `SKIP_DRIFT_GUARD=1 git push`, `SKIP_STATIC_GUARD=1 git push`, or `SKIP_LEDGER_WRITE_GUARD=1 git push`. Never attach these overrides to `git commit`. Never use `git push --no-verify` or skip the push hook wholesale. Do not bypass the in-flight CI guard or auto-merge ownership guard; the latter has no override.
7. Per-PR auto-merge state is user-owned; automation must not disable or re-enable it. Create the PR and report unrun checks. Do not babysit CI unless the user explicitly asks.
8. Babysit 30 minutes: rerun transients, sync once, fix owned failures; never persist monitoring, push ledger-only, merge, or alter auto-merge.
