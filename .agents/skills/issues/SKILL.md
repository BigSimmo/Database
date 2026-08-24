---
name: issues
description: Read or deliberately mutate the Database outstanding-issues register. Use for exact /issues commands and explicit issue queue operations.
---

# Issues

## Plain `/issues` (read-only)

For the exact trimmed `/issues` message, run only `npm run issues:report -- --json`. Repeat its cached-state warning, render the recommended queue and remaining open counts, and stop. Do not fetch, contact a provider, edit, stage, commit, reconcile, or invoke an issue mutation command.

## Explicit mutations

Only a user request naming `add`, `done`, `update`, `queue`, or `capture` authorizes that matching operation. Use the narrow `issues:add`, `issues:done`, `issues:update`, or `issues:queue` script to create an immutable UUID request under `docs/outstanding-issues-inbox/`; never hand-edit `docs/outstanding-issues.md`. Dedupe first and preserve unresolved user choices.

Run `npm run check:outstanding-issues` after a queued request when useful. Commit or push only when separately requested, staging only intended request paths. Run `npm run issues:reconcile` solely when the user explicitly names reconciliation and a serialized current-main worktree is proven safe.

`/ledger` is a separate session-extraction workflow owned by [the ledger skill](../ledger/SKILL.md); it is not an alias for `/issues`.
