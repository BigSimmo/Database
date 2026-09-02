# Ward Flow compact chat control

This is Ward Flow's active chat operating contract. It defines three fixed roles but activates only
`Ward Lead` and `Ward Verifier` during recovery. `Ward Builder` is activated after the recovery and
control-plane gates named in `system-state.json` are complete.

Chats are replaceable execution surfaces. They are not stores of project state. A message does not
transfer custody, an agent's claim is not evidence, and deleting a chat cannot be made safe after the
fact if unique content was never written down.

## Fixed roles

- **Ward Lead** is the primary builder and sole integration authority.
- **Ward Builder** holds one bounded task in an isolated worktree and cannot integrate it.
- **Ward Verifier** checks a frozen commit and cannot modify product code or fix its own findings.

The machine-readable contract is [roles.json](./roles.json). Current activation is in
[system-state.json](./system-state.json). Three persistent Ward chats is the hard maximum. Temporary
subagents may perform read-only extraction or review. Lead and Builder may also delegate a bounded
implementation child inside their current task, but only with exact non-overlapping paths; the parent
must inspect the resulting diff and remains accountable. A subagent never creates another persistent
role, integration authority or source of truth. Verifier subagents remain read-only.

## Claude model routing

Use Claude's `opus` and `sonnet` aliases so the policy follows the installed Claude generation rather
than pinning a version string. Ward Lead and Ward Verifier run on Opus. Ward Builder is selected per
assignment: use Opus whenever clinical, legal, privacy, patient-facing, test-strength or mutation,
specification,
planning, decision-record, unknown-debugging or final unchecked judgement is involved. Sonnet is for
mechanical work only when the brief names exact files, symbols, ordered steps and the decisive check,
a named gate or visible failure will catch a wrong result, and a parent or Opus reviewer will inspect
the result. The first task of a shape uses Opus; after two Sonnet review rejections, the third attempt
uses Opus. Every dispatch summary states the model tier and routing reason. Every Sonnet
implementation brief must say: **If you reach a decision this brief does not cover, stop and hand it
back.** Prefer
Sonnet for bounded extraction or a mechanical draft followed by Opus review; never use a Sonnet draft
as the final judgement-bearing verdict.

Builder assignments record the resolved tier, routing reason, structured catcher, task shape, the
Lead-declared prior Sonnet review count, veto results and exact implementation brief. `recreate`
prints the resolved tier; a replacement chat never has to infer it from prose. The validator can
enforce the recorded routing facts but cannot observe Claude's runtime model or infer unrecorded
review history. Every dispatch is therefore copied into the reset handover's validated
`content.subagentDispatches` array with its tier, reason, outcome, catcher and parent-review result;
that durable receipt is required before the chat may be certified safe to reset.

This rule is machine-pinned in `roles.json` and validated by `chat-control.mjs`. It specializes, but
does not replace, the user-level Claude development policy and the repository's named-agent model
frontmatter.

Repository policy remains single-sourced: root `CLAUDE.md` imports root `AGENTS.md` on its first
non-empty line, and the control validator refuses drift from that relationship. The Ward prompts read
both files for orientation, but never copy or weaken their rules.

Recovery-to-steady-state is also fail-closed. `system-state.json` must name one committed canonical
receipt for each of `recovery-bundle`, `current-truth` and `control-plane`, with matching SHA-256,
source commit, acceptance criterion, falsifier, `passed` outcome and decisive evidence. Use
[transition-receipt.example.json](./transition-receipt.example.json) as the schema. Merely changing
the mode or active-role array does not activate Builder. The validator applies an ID-specific gate:
the recovery receipt must hash committed bundle bytes, match a second byte-identical bundle copy
outside every repository checkout and the shared Git directory, pass `git bundle verify`, advertise the source SHA at a named full ref, and
clone successfully into a newly created empty repository with all required objects. The current-truth receipt must match a mechanically regenerated inventory of Ward
documents, recorded checkouts and durably exported chat logs, then classify every inventory ID
exactly once with zero unclassified sources. Dirty or untracked checkout state requires a committed
artifact manifest and a hashed copy of every item; metadata alone is refused. Canonical paths must
exist and match their content source, while supersession must terminate without cycles at a canonical
source. The control-plane receipt must also have a runner-produced local gate receipt for the exact
activation tree; its complete schema and content-addressed receipt key are recomputed, so typed or
partial `passed` data is insufficient. Every receipt source SHA must resolve and remain on the
integration branch, and all three receipts must use the same pre-receipt source SHA. This ensures
the self-contained recovery bundle contains the exact chat exports, dirty-artifact evidence and
current-truth inputs vouched for by the other two receipts.

Legacy chat logs are captured with `export-chat-log`. The command accepts only a session-named JSONL
below the local Claude log root, copies it to a session-named archive outside every checkout, and
writes only a canonical, content-addressed record manifest into Git. Validation requires a unique
UUID session ID, binds every record to it, requires the supported Claude event types plus user,
assistant, UUID and timestamp evidence, and checks the source and archive paths, full-file hash, byte
count and every record hash. A summary or one-line pseudo-log does not meet that event envelope.
These checks prove internal structure and byte identity; they do not prove which sidebar chat created
the file. Before capture, the owner must identify the session and create a canonical committed
[owner provenance decision](./owner-provenance-decision.example.json). The matching `live-state.json`
entry records `provenanceDecision: "owner-confirmed"`, `ownerDecisionId`, `ownerDecisionPath` and
`ownerDecisionSha256`. Validation binds all four fields to the committed decision's chat, session and
timestamp. The tool proves that binding and immutability; identifying the session remains an explicit
owner judgement, not a cryptographic or tool-derived fact.
Archive paths are resolved physically and hard links, symlinks, junctions back into the repository
and special filesystem entries are refused. Dirty and untracked checkout state is captured with
`capture-checkout-artifacts`; the same filesystem protections apply, each evidence path is globally
unique, and validation compares every committed copy byte-for-byte with its original regular file.

Deletion, rename and copy statuses are deliberately not flattened into byte-copy manifests because
that would lose their Git semantics. If one is present, capture stops and directs Ward Lead to create
a dedicated local preservation commit or a named self-contained bundle/ref in the source checkout,
then inventory that durable state. Never clean or discard the source to make capture pass.

Original legacy logs and dirty worktrees remain transition evidence and must not be changed or
deleted under this control system, including after steady-state validation. The current mechanism can
prove that committed copies and independent archives match those sources, but it cannot safely prove
that every source may be retired. Retirement would require a separately designed custody boundary
and an explicit owner-authorised migration. This retention rule applies to the six legacy sources;
new Ward Lead, Builder and Verifier chats use the certified handover-and-reset protocol below.

Current-truth validation reopens every recorded legacy checkout and compares its physical worktree
root, branch, HEAD and complete tracked status with `live-state.json`. It enumerates every untracked
file recursively and compares the exact path set with the committed artifact manifest, so adding,
removing or replacing a nested file invalidates the transition. Recovery bundle copies and raw-log
archives must be single-link regular files that physically resolve outside all repository worktrees
and the shared Git directory.

Steady-state records one immutable `activationSnapshot`. From each receipt's source SHA to that
snapshot, only additions in the control evidence subtree may occur. Any change to `live-state.json`
or another source path invalidates the transition window instead of replaying older “current truth.”

Each running role must hold one local atomic lease identified by a stable session ID and monotonic
role generation. Leases live under Git's common directory so every Ward Flow worktree sees the same
claim. One common acquisition lock makes the cross-role worktree and path-conflict checks atomic.
The tool never deletes an existing acquisition lock—not even one that appears stale—because a
read-then-delete recovery can erase a successor's live lock. A stale acquisition lock is a fail-closed
human recovery event. A second session cannot acquire the role until the first session has completed
the certified retirement protocol. Lease history is archived rather than deleted. Lease state
coordinates live work; committed assignments, handovers and reset certificates remain the durable
record.

## What "save and merge before reset" means

When the owner says to clear, delete, refresh, replace or restart a Ward chat, that chat must run the
retirement protocol before the owner is told it is safe:

1. Capture every unique decision, completed item, pending item, question, verification result, risk
   and next action in one handover draft.
2. Finish and commit coherent code. Unsafe, rejected or blocked work is not force-merged merely to
   empty a chat; it receives a durable parked disposition instead.
3. For `Ward Builder`, record whether the result was integrated or durably parked. A completed task
   cannot retire as merely parked.
4. Create a content-addressed handover record. The record includes the active lease identity,
   generation and immediate predecessor, so stale sessions cannot fork the role history.
5. Commit that handover without absorbing unrelated files. For Builder or Verifier, Ward Lead then
   runs `publish-handover` to copy the exact committed bytes onto the integration branch and commits
   only that record. Do not merge a role branch merely to move its handover.
6. From the integration branch, run `certify-reset`. Its first run writes a content-addressed reset
   certificate and says `NOT SAFE TO RESET`.
7. Review and commit only the certificate on the integration branch, then rerun `certify-reset`.
   The second run rechecks the source worktree, branch, clean status and exact handover-only source
   tip for Builder or Verifier. Only its `SAFE TO RESET` line retires the active role lease and
   authorises deletion of the chat.

This preserves all usable content while refusing the dangerous interpretation of "merge all": an
unverified or semantically rejected branch is never landed just because a context window is ending.

## Commands

Run from the repository root:

```powershell
node scripts/ward-flow/chat-control.mjs validate
node scripts/ward-flow/chat-control.mjs status
node scripts/ward-flow/chat-control.mjs export-chat-log --chat "<legacy chat name>" --session-id <id> --source-log <absolute-session-jsonl> --archive-dir <absolute-directory-outside-repository>
node scripts/ward-flow/chat-control.mjs capture-checkout-artifacts --source-id <live-state-source-id> --checkout <absolute-checkout-path> --source-head <full-sha>
node scripts/ward-flow/chat-control.mjs recreate --role lead --session-id ward-lead-20260831-a --owned-paths docs/ward-flow/control/
node scripts/ward-flow/chat-control.mjs recreate --role verifier --session-id ward-verifier-20260831-a --target-sha <full-commit-sha>
node scripts/ward-flow/chat-control.mjs create-assignment --input .local/ward-flow/assignment-draft.json --issuer-session ward-lead-20260831-a
node scripts/ward-flow/chat-control.mjs recreate --role builder --session-id ward-builder-20260831-a --assignment docs/ward-flow/control/assignments/<hash>.assignment.json
node scripts/ward-flow/chat-control.mjs create-handover --input .local/ward-flow/handover-draft.json --session-id ward-lead-20260831-a
node scripts/ward-flow/chat-control.mjs publish-handover --source <builder-or-verifier-ref> --handover docs/ward-flow/control/handovers/<hash>.handover.json --issuer-session ward-lead-20260831-a
node scripts/ward-flow/chat-control.mjs certify-reset --handover docs/ward-flow/control/handovers/<hash>.handover.json
```

`create-handover` requires a clean worktree before it writes anything. The input draft should live in
the ignored `.local/` directory and follow [handover-draft.example.json](./handover-draft.example.json).
The created record is named by the SHA-256 of its canonical bytes. Editing it changes the expected
path and fails validation; corrections are new records.

Builder work begins only from a committed content-addressed assignment created by the active Ward
Lead. The assignment follows [assignment-draft.example.json](./assignment-draft.example.json) and
pins the base SHA, isolated branch and worktree, exact owned paths, acceptance criterion, falsifier
and focused check. Its introduction must be one commit changing only the assignment path. Builder
handovers must match that assignment exactly. Lead and Verifier cannot rewrite the role contract
through their handover permissions; Verifier may add new evidence and retirement records but cannot
modify or delete an existing one.

Ward Lead's lease also records its exact active task paths. `create-assignment` refuses any Builder
path that overlaps them and refuses the integration branch or Lead worktree. A Lead replacement must
receive a new session ID and a new explicit `--owned-paths` value; even an identical session ID cannot
reuse an active lease.

`certify-reset` fails unless the handover is committed exactly as written, its source commit still
resolves locally, it is the newest link in the role's unbroken generation chain, its
lease still matches, the worktree is clean, and Builder integration or parking is independently
resolved. It runs only on the integration branch, proves the handover was introduced by a commit that
changed only that path, and proves the certificate was committed in one subsequent certificate-only
commit. Integrated work must be present on the configured integration branch with the changed
path contents preserved. A parked commit must be retained by a named local branch and match the
commit-object hash; a parked artifact must be committed on the recorded Builder source HEAD in the
control parked-artifact subtree and match its recorded hash. Integrated work must remain byte-,
object-type- and mode-identical both at the recorded landing commit and at the current integration
tip; a later revert invalidates the disposition.

`recreate` prints a ready-to-send prompt containing the fixed role contract, current system state and
latest certified handover. It requires a clean checkout and an explicit session ID, takes the single
atomic lease for that role, refuses an inactive or already leased role, and refuses a committed but
uncertified handover. A new chat starts from that prompt rather than from somebody's recollection of
the deleted conversation.

## Owner phrases

The following meanings should be treated equivalently:

- "Prepare Ward Lead for reset."
- "Save and replace the Ward Builder chat."
- "Clear Ward Verifier's context and recreate it."
- "Delete this Ward chat and start it again."

The responding chat must identify its fixed role, run the protocol, and return the exact recreation
command. It must not answer "safe to delete" before certification succeeds.

## Sudden loss

If a chat disappears before certification, recovery is limited to its last committed code and last
certified handover. Run `status` and inspect the abandoned worktree read-only. The abandoned lease
intentionally blocks replacement: a human must first disposition any recoverable work and record the
loss. Never delete or bypass the lease merely to make `recreate` pass, and never infer that content
absent from durable sources did not exist.

## Human decisions

No AI role can perform the two independent clinician checks, settle disagreement between clinicians,
or convert an owner question into a ruling. Those results are durable inputs to the role system, not
tasks the role system may answer for itself.
