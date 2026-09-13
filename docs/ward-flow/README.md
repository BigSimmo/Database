# Ward Flow — live state, custody, and recovery order

**Status:** local evidence snapshot and continuation control surface
**Measured:** 2026-08-31 11:26 AWST
**Working-line base:** `claude/ward-flow-phases-6-7-design` at `5db2f02fc6f0d04eed3425bc74b0adad438b7ea7`
**Scope:** Ward Flow only. This does not review or reorganise the rest of Database.

> **Active chat control:** [control/README.md](./control/README.md) now governs Ward Lead, Ward
> Builder, Ward Verifier, chat retirement and recreation. This file remains the measured source and
> recovery snapshot. Its named legacy chats and branches are evidence to migrate, not the active
> allocation model. During recovery only Lead and Verifier are active; Builder remains gated.

This is the measured recovery document a fresh Ward Lead should read after the active control
contract. It replaces chat memory as evidence, but it does not replace owner decisions. Its
machine-readable companion is
[live-state.json](./live-state.json), and the ready-to-send local-chat prompt is
[START-LOCAL-CHAT.md](./START-LOCAL-CHAT.md).

Before trusting any branch number in this file, run:

    node scripts/ward-flow/check-live-state.mjs

Exit `0` means the local checkouts still match this snapshot. Exit `1` means at least one recorded
fact drifted. Exit `2` means the check could not complete. The checker is report-only and makes no
network call or repository change.

## Executive decision

Ward Flow is not currently in a state where another builder should simply “continue.”

The integrated working line contains the folded product work, but it has two uncommitted files. Two
new owner-ruling documents and the newest decision-ledger change are held on other branches. The
community hub is one commit ahead of the working line, but its central patient-to-team association
implements a rule the owner subsequently reversed. The verifier’s final requested walk-through was
not started before its session reached its usage limit.

The safe continuation is therefore:

1. establish one integration writer;
2. preserve and finish the two uncommitted urgency files;
3. transfer the three current decision documents by named path, never by branch merge;
4. add the missing model facts needed by the community ruling;
5. rework the community-hub WIP against that model;
6. independently walk matching → ward acceptance → arrival;
7. resume the parked capacity and ward-board work only after the owner releases it.

No chat should merge, clean, push, or infer “done” from the existing handovers.

## The live topology

The chat names do not map one-to-one to the Git directories bearing similar names:

    5db2f02fc  integration working line (Ward Core actually edited here)
      ├─ 0c94814a  Ward Verifier: one owner-rulings document
      ├─ 2e9499fb  Ward Referrals WIP: community hub, invalid association rule
      └─ 68e501e5  Ward Board: fully contained, 25 commits behind

    623c0c6a  Ward Decisions: divergent docs branch, never merge
    023f8e9f  Ward Orchestrator: divergent docs branch, never merge

The exact measured state is:

| Chat                  | Actual local state                                                                                                                                                                          | What survives                                                                                                        | Next treatment                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ward Core**         | It edited `D:/Worktrees/Database/pr-2390-fix`, not its nominal `ward-flow-untangle` directory. Branch `claude/ward-flow-phases-6-7-design` is at `5db2f02f` with two tracked modifications. | Integrated product line and 139 Ward documents.                                                                      | Preserve the dirty files. One integration writer finishes and commits them only after appropriate verification.                                   |
| **Ward Verifier**     | `ward-flow-setup-967aa0`, `0c94814a`, clean, one commit ahead.                                                                                                                              | Five owner rulings. The matching → acceptance → arrival walk-through was explicitly “not started.”                   | Copy the ruling document by named path after applying the later urgency supersession. Keep this role independent; it verifies rather than builds. |
| **Ward Referrals**    | Its named `test-chat-4-a72f65` directory is empty and has no Git metadata. Its worker committed to `ward-flow-untangle-72b296` at `2e9499fb`.                                               | A substantial community-hub shell, route, navigation, derivations, tests, and documentation.                         | Do not merge. Rework after the referral model carries an explicit team identifier and a follow-up state.                                          |
| **Ward Board**        | `nostalgic-vaughan-7ee231`, `68e501e5`. Tracked tree clean; 139 untracked temporary evidence files. The commit is fully contained in the working line.                                      | Board and clock work already landed. Chat-only knowledge about the queued capacity and ward-hub work remains useful. | Preserve the temporary files. Do not merge or clean. Write the missing handover before resuming the parked work.                                  |
| **Ward Decisions**    | `lucid-dewdney-ee093b`, `623c0c6a`, clean, 300 working-line-only commits and 227 branch-only commits.                                                                                       | Newest decision ledger and nine design specs.                                                                        | Never merge. Review and copy `docs/ward-flow-ledger.md` by named path. Treat its Codex handover as stale evidence, not current instructions.      |
| **Ward Orchestrator** | `ward-flow-prototype-design-bca00c`, `023f8e9f`, clean, 300 working-line-only commits and 331 branch-only commits.                                                                          | Latest community/urgency rulings and the most recent orchestration snapshot.                                         | Never merge. Copy only reviewed named documents. This control surface supersedes its volatile status table.                                       |

## What is landed and should not be rebuilt

- The integration line is `5db2f02f`. It contains the earlier Referrals correction merge, Verifier
  setup merge, Board merge, and thirty copied Ward documents. Its history includes the referral,
  ED urgency, transport, network-clock, patient-screen, and “what this is not” work.
- Ward Board’s tracked branch work is fully contained: comparing the working line with
  `claude/ward-flow-print-fixes` gives 25 commits only on the working line and zero only on Board.
- The two divergent documentation branches were correctly refused as branch merges. The recorded
  reason remains valid: they share an old repository base and bring large unrelated history and
  unreviewed deletions. See
  `claude/Wardquestions:docs/ward-flow-fold-manifest-2026-08-31.md:35-103`.
- The core distinction in the later urgency ruling must survive: six reasons were selected by the
  orchestrator under delegated authority and accepted only provisionally. They are not the owner’s
  wording. See
  `claude/Wardquestions:docs/ward-flow-owner-rulings-2026-08-31-community.md:54-92`.
- The community ruling is explicit: association comes from a team named on the referral, not home
  geography. A community team may see decline reasons for its own referrals and may arrange
  transport when it is the sending location. See the same source at lines `9-50`.
- The owner’s other five-ruling document remains useful for four items: held beds do not count as
  available; network exhaustion is flagged but not auto-declared; the end-to-end walk-through must
  be finished; and Ward Flow is not to be published publicly as it stands. Its urgency section is
  superseded by the later six-reason ruling. Source:
  `claude/ward-flow-setup-967aa0-wf:docs/ward-flow-owner-rulings-2026-08-31.md:12-93`.

## What is not landed or not complete

### 1. Six urgency reasons are an uncommitted working-tree change

The integration checkout has exactly these tracked modifications:

- `src/components/ward-management/ward-change-reasons.ts`
- `tests/ward-change-reasons.test.ts`

They reduce the placeholder reasons from ten to six, update labels and test pins, and preserve the
provisionality warning. Ward Core’s log records a full Ward test run with one failure, followed by a
fix and an 11-test focused pass. It does not contain a subsequent full Ward rerun or a commit.
Evidence:
`C:/Users/joshs/.claude/projects/D--Repos-Database--claude-worktrees-ward-flow-untangle-72b296/23c91695-f037-49fb-ac67-80b7c640afa0.jsonl:14007-14028`.

Do not call this landed. Do not discard it. Do not absorb it into an unrelated commit.

### 2. The newest decision evidence is outside the working line

The integration line has an older decision ledger blob. Ward Decisions’ latest ledger contains the
capacity decision that all six numbers remain and the first label is `Available`, not
`Unoccupied`. Its final chat measured the working-line copy as two lines and one decision behind.
Evidence:
`C:/Users/joshs/.claude/projects/D--Repos-Database--claude-worktrees-lucid-dewdney-ee093b/a4cba676-33d6-41bc-b103-192a7416261b.jsonl:4529-4555`.

The source blobs to review and transfer are pinned in [live-state.json](./live-state.json):

- latest ledger at `623c0c6a:docs/ward-flow-ledger.md`;
- five rulings at `0c94814a:docs/ward-flow-owner-rulings-2026-08-31.md`;
- later community/six-reason rulings at
  `023f8e9f:docs/ward-flow-owner-rulings-2026-08-31-community.md`.

### 3. The community hub is written against an invalidated association

Commit `2e9499fb` is a one-commit child of the integration head. It adds 12 files with 1,605
insertions and 9 deletions. Its own commit message correctly labels it WIP.

The invalid part is not cosmetic. At
`2e9499fb:src/components/ward-management/community/community-derivations.ts:100-101`,
`admissionBelongsToTeam` compares `admission.homeRegion` with `team.region`. The later owner ruling
requires an explicit team named on the referral. The present destination arm has no team identifier,
so the correct rule cannot yet be expressed.

The WIP also records that:

- the model has no follow-up-arranged concept, so one requested list cannot be truthful;
- neither referral source nor community destination identifies the community team;
- five admission timestamps may not be shifted by the prototype re-anchor path.

The first two are directly visible in
`community-derivations.ts:14-25,89-101` and
`community-screen.tsx:25-29,250-264` at `2e9499fb`. The clock observation was read from the commit
message and has not been independently reproduced in this reconciliation.

### 4. The independent walk-through is not done

Ward Verifier’s last request was to walk coordinator matching → ward acceptance → patient arrival.
The session explicitly wrote that the honest state was “not started,” then started the local app and
immediately reached its usage limit. No later finding document or completion commit appears.
Evidence:
`C:/Users/joshs/.claude/projects/D--Repos-Database--claude-worktrees-ward-flow-setup-967aa0/96a0e846-6d39-4836-9fa0-0c3fe3e41b92.jsonl:3731-3735`.

### 5. Ward Board’s next-work knowledge is not durable

Board’s final tracked commit is integrated. Its latest chat was asked to write the queued
capacity-screen and ward-hub handover, agreed that a document was needed, checked its branch, and
then reached its usage limit before creating it. Evidence:
`C:/Users/joshs/.claude/projects/D--Repos-Database--claude-worktrees-nostalgic-vaughan-7ee231/db884133-9f0b-4227-abb1-8e177a1270e4.jsonl:9649-9664`.

The 139 untracked `.tmp-*` files remain in that worktree. They are not a task queue and must not be
deleted as cleanup.

## Findings from the reconciliation

### P1 — no single branch contains the current truth

The integration branch contains product work but not the newest rulings or ledger change, and its
working tree contains an uncommitted owner-ruling implementation. A fresh chat reading only the
working line will miss decisions; one reading only the decision branch will miss 300 integration
commits.

**Cost if left:** duplicate work, reversed decisions, or accidental loss of the only uncommitted
implementation.
**Replacement:** one integration writer and one checked-in decision ledger on the integration line;
source branches become immutable evidence, not live authorities. The live-state checker detects
branch movement until that consolidation is complete.

### P1 — the community WIP is merge-shaped but semantically unsafe

Because `2e9499fb` is exactly one commit ahead, it looks cheap to merge. Following that appearance
would associate patients to teams by region after the owner ruled that region is only a geographic
guess.

**Cost if left:** a plausible screen shows the wrong team’s patients.
**Replacement:** add an explicit community-team identifier to the referral model first, add the
missing follow-up fact, then rework or selectively replay the WIP. Never merge `2e9499fb` unchanged.

### P1 — current verification cannot support “ready”

The last full Ward run associated with the urgency edit had one failure. Only the corrected focused
test was rerun. The requested end-to-end walk was never begun.

**Cost if left:** a handover can convert partial proof into an all-clear.
**Replacement:** finish the focused source/test change, run the smallest complete Ward domain gate
that covers it, then have the independent verifier walk the three-step journey and record observed
results separately from code changes.

### P1 — publication state is a governance risk, not a settled fact

The older Codex handover says the branches are never pushed
(the Ward-design Codex handover, lines 36–38 and 66). The later orchestrator handover
says the working branch was pushed and names a draft PR
(`claude/Wardquestions:docs/ward-flow-orchestrator-handover.md:38-53`). This reconciliation verified
only local tracking refs; it did not contact GitHub. The owner’s “public” statement is therefore not
presented here as a measured current fact.

**Cost if left:** sensitive-looking synthetic records may be treated as safely local, or a local
claim may be repeated as hosted proof.
**Replacement:** keep all continuation local. Resolve visibility and history cleanup as a separate,
explicitly authorised repository-governance task.

### P2 — chat identity and Git custody are misaligned

Ward Referrals has no checkout at its named path. Ward Core edited the integration worktree while
its nominal worktree now holds Referrals’ WIP branch.

**Cost if left:** the next person acts on the wrong directory or assumes an empty folder means no
work exists.
**Replacement:** identify work by `checkout + branch + HEAD`, never by chat title. The JSON snapshot
and checker make that triplet explicit.

### P2 — the status documents contain mutually true historical states without a current-state type

The newest orchestrator handover says “everything is here” and then lists two branches one commit
ahead. Older tables still say ten urgency reasons and parked sessions. The files often acknowledge
their own staleness, but nothing prevents a reader from using a stale section.

**Cost if left:** a careful reader can follow written instructions and still resume the wrong task.
**Replacement:** this file holds only the current recovery surface; historical handovers remain
evidence. `live-state.json` stores re-checkable facts, and the checker turns drift into a non-zero
exit.

### P2 — the model cannot express two approved community outcomes

There is no explicit community-team identifier on the referral destination and no follow-up-arranged
state.

**Cost if left:** the community screen either guesses association or asserts follow-up safety it did
not record.
**Replacement:** model both facts before UI completion. Empty data must remain visibly unknown.

### P2 — two owner rulings remain unimplemented or unverified

Held beds still need to be excluded from availability, and the exhausted-referral-network condition
needs a coordinator flag without automatic escalation. The owner-rulings document assigns the first
to Core and defines the second boundary, but no later implementation is present in the inspected
heads.

**Cost if left:** available capacity can be overstated and a stuck patient can remain
indistinguishable from an ordinary wait.
**Replacement:** queue both after the integration recovery, each with a focused derivation test and
an independent screen check.

### P3 — the old Codex prompt is now actively misleading

The Ward-design Codex handover is useful history but says nothing was ever pushed and describes
the ledger copies as comprehensive/current. Later local evidence contradicts both statements.

**Cost if left:** a new local chat starts from false safety and currency assumptions.
**Replacement:** use [START-LOCAL-CHAT.md](./START-LOCAL-CHAT.md). Do not copy the old prompt onto the
working line as current guidance.

## Ordered recovery sequence

This is dependency order, not a second task ledger.

### Recovery 0 — preserve and appoint

- One chat owns `D:/Worktrees/Database/pr-2390-fix` and all integration commits.
- Ward Verifier remains read-only with respect to product work.
- Do not resume Board or Referrals yet.
- Preserve the two dirty urgency files, Board’s 139 untracked temporary files, the WIP commit, and
  the tracked process-audit evidence file.

**Exit condition:** one named integration writer; all other chats acknowledge no-write custody.

### Recovery 1 — close the dirty working line

- Inspect the exact two-file urgency diff.
- Confirm it matches the later six-reason ruling and retains the owner’s provisional wording.
- Run the focused reason test, then the smallest Ward domain gate that covers the change because the
  prior full run had one failure and was not rerun after the correction.
- Commit only those two named paths. No amend, stash, `git add -A`, or unrelated formatting.

**Exit condition:** clean integration checkout; committed six-reason implementation; exact checks
and counts recorded.

### Recovery 2 — bring decisions to the code, as files

- Review and copy the latest `ward-flow-ledger.md` from `623c0c6a`.
- Copy the two owner-ruling documents from `0c94814a` and `023f8e9f`.
- In the earlier five-ruling document, mark only its urgency section as superseded by the later
  six-reason document. Do not discard the other four rulings.
- Keep the old handovers as historical evidence or add a clear supersession banner; do not maintain
  another mirrored “current” table.

**Exit condition:** the integration line contains the current decision evidence and one ledger of
record. Neither divergent docs branch was merged.

### Recovery 3 — make the community ruling expressible

- Add an explicit community-team identifier to the appropriate referral destination arm.
- Define the provenance and lifecycle of that identifier.
- Add a representable follow-up-arranged state, or explicitly rescope the list with the owner.
- Reproduce the WIP’s re-anchor timestamp claim before changing clock code.
- Add the held-bed availability and exhausted-network prompt work as separately testable changes.

**Exit condition:** association and follow-up are facts in the model, not UI inference.

### Recovery 4 — salvage the community hub

- Rebase or replay from clean integration state only after Recovery 3.
- Keep the route, shell, wording constraints, navigation registration, and tests where still valid.
- Replace `admissionBelongsToTeam` and region-keyed page identity with the explicit referral-team
  rule.
- Update the tests so a region match cannot stand in for team identity.

**Exit condition:** no region-derived membership remains; all four sections either have source facts
or visibly state what is unavailable.

### Recovery 5 — independent journey verification

Ward Verifier walks, without building:

1. coordinator matches a patient to a bed;
2. receiving ward accepts;
3. patient arrives and survives navigation/state transitions.

Record READ, RAN, and INFERRED separately. A failure becomes a new owned task; the verifier does not
fix it in the same pass.

**Exit condition:** durable walk-through evidence with exact branch, HEAD, route, actions, and
observed result.

### Recovery 6 — resume the parked Board work

- First write the chat-only capacity/ward-hub handover.
- Confirm the owner has released the Board hold.
- Build capacity with all six numbers retained and `Available` as the first label.
- Then continue the ward-hub work without rebuilding already integrated Board commits.

**Exit condition:** the parked work has durable custody and no dependency on an expiring chat.

### Recovery 7 — finish the demonstrable flow before optional polish

Complete the coordinator, arrival, discharge, timeline, and transport journeys in dependency order.
Defer catchment mapping, real provider/team lists, escalation questions, and persistence unless the
owner explicitly reopens them. The project test remains: does this help a person get from an
emergency department to a ward, or make the reason for delay visible?

## Which check to run, and what it costs

The full Vitest ward suite is 120 files and about 110 seconds. On 2026-08-31 it was run **nine
times in one session**, mostly for changes a single four-second file would have caught. The owner
asked for that to stop, and he was right: a gate run out of habit rather than judgement is not
rigour, it is just slow.

**Run the smallest check that could actually fail on THIS change.**

- One module and its own test — that file alone. `npx vitest run tests/ward-<name>.test.ts`, ~4s.
- A screen — its own `.dom.test.tsx`, nothing else.
- The control plane (`scripts/ward-flow/**`, control records) — `tests/ward-flow-chat-control.test.ts`
  alone. Note it now takes ~90s in steady state, because `validateControlPlane` genuinely clones a
  124 MB bundle into a fresh repository rather than trusting a recorded outcome.
- Wording or comments only — the test that pins the wording, or nothing at all. A comment cannot
  fail a test.
- **A shared model or derivation** — `ward-model.ts`, `ward-admissions.ts`, `ward-derivations.ts`,
  `ward-clock.ts`, `ward-reanchor.ts`, `ward-flow-reducer.ts` — the whole ward suite, **once**,
  immediately before the commit. These are the only changes that earn it, because they are the only
  ones whose blast radius is genuinely the whole product.

Typecheck when the change can affect a type contract — a new field, a changed signature, a widened
union — and not otherwise. It is about 60 seconds and it is the right tool for exactly that job:
adding `Admission.followUp` was found at every one of its nine construction sites by `tsc`, which no
test run would have listed.

Two things worth more than another suite run:

- **When you write a new guard, prove it can fail.** Break the thing it guards, watch it go red with
  the right message, restore, and verify the restore by hash. Four seconds, and it is the only
  evidence that distinguishes a guard from a decoration. Two guards in this project were green and
  blind for months.
- **Never re-run a suite that already passed on unchanged content.** Repository policy has a
  receipt mechanism for exactly this (`AGENTS.md`, "Do not pay twice for the verdict"). Reusing a
  receipt must be reported as "reused receipt", never as a fresh run.

## Hard boundaries

- Never merge `claude/Ward-design` or `claude/Wardquestions`.
- Never merge `2e9499fb` unchanged.
- Never clean, reset, stash, amend, or delete any of the six supplied worktrees.
- Never use `git add -A` in this work.
- Never let another chat write in `D:/Worktrees/Database/pr-2390-fix` while its current writer is
  active.
- Never report the matching → acceptance → arrival walk-through as complete.
- Never call the six urgency reasons the owner’s wording.
- Never infer a community team from home region.
- Never contact GitHub, hosted CI, OpenAI, Supabase, or a live database without a new explicit
  request naming that action.
- Never present local tracking refs as proof of current hosted state.

## Evidence method and coverage

### READ

- All six supplied checkout paths and their live Git state.
- The six active Claude JSONL logs, concentrating on their final substantive work and claimed
  completions.
- The newest orchestrator handover, fold manifest, task ledger, open questions, remaining work, two
  owner-ruling documents, latest decision ledger, and the community WIP commit.
- The earlier process-audit handover is now durably tracked at
  `docs/ward-flow/evidence/ward-flow-process-audit-ai-handover.txt`, verified at 37,727 bytes and SHA-256
  `765E35439C15E89EF797B3E55E46E58949B08E9B879739367011428125E176C0`.

### RAN

- Local, read-only Git inspection: branch, HEAD, status, ancestry, merge-base, rev-list counts,
  tree/blob identity, log, show, and diff.
- Local filesystem inspection of the supplied chat directories, JSONL logs, and task-output files.
- No product test, build, server, formatter, hosted check, provider call, or remote fetch was used to
  produce this reconciliation.

### INFERRED

- A one-writer recovery is safer than restarting the five parallel builders while custody is
  inconsistent.
- The community WIP must wait for model work because the current model cannot represent the latest
  ruling.
- Historical handovers should not remain live status authorities; their own contradictions show
  that prose-only state tracking is not self-correcting.

Three delegated agents performed bounded extraction of chat tails, orchestration documents, and
branch/WIP facts. Their results were treated as leads. Branch heads, status, ancestry, document
blobs, the dirty urgency diff, and the high-risk WIP/ruling conflict were independently confirmed in
the primary session. JSONL line citations for the chat-tail conclusions come from the delegated
extraction and were spot-checked against the corresponding live logs.

### Not examined

- Current GitHub repository visibility, PR state, hosted CI, or remote branch state. Local tracking
  refs may be stale.
- Runtime browser behavior beyond what the logs claim. No server was opened in this reconciliation.
- Every historical line in all 120+ Ward documents. The prior process audit covers the document
  system; this pass focused on current live custody and unfinished work.
- The 139 Board temporary files individually. Their presence and count were measured; their contents
  were not treated as authoritative.
- The clock re-anchor defect claimed by the WIP was not reproduced.

These gaps mean this document can order safe local recovery, but it cannot certify runtime,
clinical, hosted, publication, or release readiness.

## One-hour choice

If only one hour is available, do Recovery 1: preserve, verify, and commit the two-file urgency
change on the integration line, then copy the two owner-ruling documents and latest ledger into a
review queue. Do not start the community hub. A clean, decision-complete integration line prevents
more loss than another visible screen.
