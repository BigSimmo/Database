# Start or recreate a Ward Flow chat

Ward Flow uses three fixed roles with a hard maximum of three persistent chats:

- `lead` — primary builder and sole integration authority;
- `builder` — one bounded task on an isolated branch;
- `verifier` — product-read-only verification of a frozen commit.

During the current recovery mode only `lead` and `verifier` are active. The mechanical source is
[control/roles.json](./control/roles.json), current activation is
[control/system-state.json](./control/system-state.json), and the full operating/reset contract is
[control/README.md](./control/README.md).

## Create the prompt

From the isolated Ward Flow worktree, run:

```powershell
node scripts/ward-flow/chat-control.mjs validate
node scripts/ward-flow/chat-control.mjs status
node scripts/ward-flow/chat-control.mjs recreate --role lead --session-id ward-lead-<date>-<letter> --owned-paths <comma-separated-exact-task-paths>
```

For the independent verifier, use an isolated checkout whose `HEAD` is the frozen commit, replace
`lead` with `verifier`, and add `--target-sha <full-commit-sha>`. A request for `builder` fails while
recovery mode is active; do not bypass that refusal. Copy the complete `recreate` output into the
fresh local chat.

Use a new stable session ID for a replacement chat. Reusing a role while its prior lease is active is
refused. The generated prompt includes:

- the fixed role and prohibitions;
- current control mode and integration branch;
- current checkout branch, HEAD and dirty/clean state;
- the single active lease identity and monotonic role generation;
- the newest committed and certified content-addressed handover for that role;
- one concrete next action.

If no committed and certified handover exists, the prompt says so and permits bootstrap only. It
does not infer lost context. A committed but uncertified handover is a refusal, not bootstrap.

## Before clearing or deleting an existing chat

Tell it: `Prepare this Ward <role> chat for reset.`

It must capture its unique operational content, finish or durably disposition work, create and
commit a handover. For Builder or Verifier, Ward Lead then publishes the exact record bytes onto the
integration branch with `publish-handover` and commits only that path. From the integration branch,
run:

```powershell
node scripts/ward-flow/chat-control.mjs certify-reset --handover docs/ward-flow/control/handovers/<hash>.handover.json
```

The first run creates a reset certificate and prints `NOT SAFE TO RESET`. Review and commit that
certificate, then run the same command again. Do not delete the chat until the second run prints
`SAFE TO RESET` and archives the old role lease. The tool never automatically commits, merges,
pushes or contacts a provider.

## Recovery evidence

Ward Lead additionally reads:

- [README.md](./README.md) — measured legacy-source and branch recovery state;
- [live-state.json](./live-state.json) — machine-readable snapshot;
- `node scripts/ward-flow/check-live-state.mjs` — report-only drift checker.

Old transcripts and named worktrees are evidence, not active role instructions.
