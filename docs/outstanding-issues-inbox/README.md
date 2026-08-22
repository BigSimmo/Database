# Outstanding-issues inbox

Feature branches never edit `../outstanding-issues.md` directly. Use `npm run issues:add`, `npm run issues:update`, `npm run issues:queue`, or `npm run issues:done`; each writes one validated JSON request in this directory, so concurrent PRs add different files and merge cleanly.

When multiple landed requests mutate the same canonical issue, keep the intended request and add an immutable cancellation request for each rejected mutation:

```sh
node scripts/ledger-inbox.mjs cancel <request-uuid> --reason "<why this mutation must not apply>"
```

The cancellation request must land before reconciliation. It preserves both records for audit, prevents the cancelled mutation from changing the canonical ledger, and lets reconciliation process the remaining batch deterministically.

After the relevant PRs have landed, fetch `origin/main`, start a dedicated ledger-reconciliation branch from that exact base, run `npm run issues:reconcile -- --dry-run`, then run `npm run issues:reconcile`. The reconciler refuses a stale base or dirty canonical file and holds a repository-wide cross-worktree lock. It allocates numeric IDs, updates the canonical Markdown ledger, and moves processed requests and cancellations to `applied/` as an audit trail. `check:ledger-write-discipline` verifies that exact transaction in CI and pre-push.
