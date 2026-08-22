# Local operational package — start here

This is the new-session Windows/local handover for L00–L10 after accepted Cloud P00–P17 work. It is not an alternative implementation launcher.

## L00 start contract

1. Run the root repository task-start preflight once for this new local task.
2. Fetch `origin/main` and the exact remote Cloud programme branch named by the handover. Verify the remote tip and the commit that atomically introduced accepted `PROGRAMME.json`.
3. Create a brand-new isolated local operations branch/worktree from that programme metadata commit. Do not use, mutate, rebase, merge or cherry-pick the registered `codex/rag-local-build-20260822` worktree.
4. Run setup, runtime, installed-lock parity, package parity, tracked programme-receipt validation and `--before-local L00` as specified by `connected-execution.md`.
5. Bind the exact Cloud tip, package hash and programme receipt commit/hash. Compare current `origin/main` and the quarantined local WIP. Classify overlap; never absorb it silently.
6. Select Sol/high for L00 in the local session control and prove the controller/reviewer route from authoritative metadata.
7. Produce and independently review the L00 receipt. No hosted or provider action occurs.

## Later local phases

Start each L01–L10 phase in a fresh local session from the exact accepted predecessor receipt commit. Select effort before launch:

- high: L01 and L06;
- xhigh: L02–L05 and L07–L10.

Read `programme-manifest.json`, `execution-order.md`, `approval-matrix.md`, `connected-execution.md`, the connected receipt schema/template, both specifications and the P17-produced operational runbooks. Load and hash the phase skills. Dispatch a fresh reviewer distinct from the controller and prove both routes.

The local launch prompt does not itself authorize hosted reads/writes, source browsing, provider calls, migrations, deployment, reindex, activation, rollback or cleanup. Before each action, obtain and record the exact target-specific approval required by the matrix. Stop if approval is missing, expired or mismatched.

Accept one local phase receipt, push only when separately authorized, then stop. L10 may resume after retention/observation; do not run a permanent watcher. L10 atomically creates `OPERATIONAL.json` only after an empty residual set and fresh full operational review.

Accepted `PROGRAMME.json` and P00–P17 receipts remain immutable throughout local execution.
