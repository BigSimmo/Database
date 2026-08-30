# Ward Flow — who holds what

**This file exists because messages do not outlive the session that sent them.**

I coordinated with four sessions all evening, recorded the conclusions, and lost the picture of who
they were. **What survived was their commits — and a commit is an artefact, not an agreement.** So a
coordination session that loses its context reconstructs custody from git and gets it wrong, because
git can show that eight commits exist and never show who was asked to make them.

> **The remedy is not "remember better". It is that a register of who holds what belongs in a file.**
> The boundary between the two registers was already written down; the allocation was not, which is
> why the boundary held and the allocation did not.

## What this file is NOT

**It is not a decision register.** `docs/ward-flow-ledger.md` holds decision identity and status and
is the register of record. **This file cites decisions and never restates them.**

**The asymmetry is the reason, and it decides which record must be single:**

> **A wrong custody row fails loudly** — somebody edits a file another session holds, and the
> collision announces itself.
> **A wrong decision row fails silently forever** — nothing breaks, nothing disagrees, and the wrong
> value is simply believed.

**So decisions get one register. Custody gets this one, and custody is the thing no file can derive.**

**And the principle generalises past this programme, which is why it is worth stating rather than
just applying:** _the artefacts that need the most discipline are the ones whose errors produce no
signal._ A lock table, a comment, a decision register, an unpinned label — **none of them fails, so
none of them is ever caught by running something.**

## ⚠️ Names changed 2026-08-30 — use these, and never infer a role from an old one

| Name                  | Role — durable, not a current task                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| **Ward Core**         | the model — referrals, beds, patients, the reducer. **Holds the main line and does every merge** |
| **Ward Board**        | the ward board and the printed daily sheet. **Renamed from Ward Future by the owner 2026-08-30**  |
| **Ward Referrals**    | the referral screens                                                                             |
| **Ward Decisions**    | the decision register and specs. **Never touches a source file**                                 |
| **Ward Verifier**     | checks claims against the **running application** — the one instrument nobody else has           |
| **Ward Orchestrator** | custody, plans, the owner's questions. **Documents only**                                        |

**Named for surfaces, not tasks**, so a chat finishing a piece of work does not need renaming — which
is exactly how `Repo change` and `Future` stopped meaning anything.

**Old names that appear in earlier documents and messages:** `ward-flow-untangle-72b296-ce` was
**Ward Core**; `nostalgic-vaughan-7ee231-88` was **Ward Future**; `lucid-dewdney-ee093b-d8` was
**Ward Decisions**; `Ward Orchestrator #2` was **Ward Verifier**.

## Custody, 2026-08-30

**Every row below was obtained by asking the session and having it run the command — not inferred
from a name.** The last column is what nobody else may touch.

| Session               | Worktree                            | Branch @ tip, 2026-08-30 05:45                          | Holds                                                                                                                             | Off limits to others                                    |
| --------------------- | ----------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Ward Core**         | `D:/Worktrees/Database/pr-2390-fix` | `claude/ward-flow-phases-6-7-design` @ `9daa1e419`       | **THE WORKING LINE.** Phase 0: the stage strip *(in flight)*, the silent tiles, `TR-F3`, `shiftInstants`. Then the patient screen, the polish, the coordinator hub, the timeline, transport. **Owns the model and every fold** | `ward-model.ts` + `ward-flow-reducer.ts` + `ward-management-modes.tsx` |
| **Ward Referrals**    | `.../ward-flow-untangle-72b296`     | `claude/ward-flow-wave1-referral-corrections` @ `3d0f99a74` **(+7)** | `FD-23` transitive guard → the referral screen *(with `FD-30`)* → the ED hub → the community hub. **Owns the whole referral surface and the catchment module** | the referral screens; must not touch `ward-model.ts`    |
| **Ward Board**        | `nostalgic-vaughan-7ee231`          | `claude/ward-flow-print-fixes` @ `51f53c26c` **(+4)**    | **THE WARD PAGE BECOMES THE WARD HUB** *(unblocked — stays on `referredUnitIds`)*, and item 11 landed alongside. Then demo-data labels, synthetic notices, the staleness headline, print the day | board surfaces                                          |
| **Ward Decisions**    | `lucid-dewdney-ee093b`              | `claude/Ward-design` @ `b78a1fa0d` ⚠️ **(+211, DIVERGENT, never folds)** | The decision register + **four design specs that exist NOWHERE ELSE**. Now designing the network diagram, the header, the ward forms, capacity, transport. **Never touches a source file** | `docs/ward-flow-ledger.md` — **the register of record** |
| **Ward Verifier**     | `ward-flow-setup-967aa0`            | `claude/ward-flow-setup-967aa0-wf` @ `68b3f2a69` **(+3)** | ✅ The frozen date, ✅ the nine `D9` stamps, ✅ `run-ward-tests.mjs` **(now merged to the working line)**. Next: the ED and coordinator screens end to end **in the browser** | the ward test wrapper; **the browser is its instrument alone** |
| **Ward Orchestrator** | `ward-flow-prototype-design-bca00c` | `claude/Wardquestions` @ `0aaab5d4b` **(+257)**          | custody, the plan, the rules, the safety checklist, the owner's open questions                                                     | documents only — **never product code**                 |

### ⚠️ `ward-screen.tsx` — SPLIT OWNERSHIP, declared before a collision rather than after

**Measured: its last three commits are SHARED MERGED commits present on three and four branches.
Nobody had claimed it since the ward-hub decision changed what that file is.**

| Half | Owner | What |
| --- | --- | --- |
| **Presentation** | **Ward Board** | sections, hierarchy, the three ward forms, the hub work, **and phase 4 item 23** |
| **The model it reads** | **Ward Core** | `ward-model.ts`, `ward-flow-reducer.ts`, the fields the page renders |

⚠️ **A NAMED EXCEPTION WAS TAKEN, 2026-08-30, while Ward Board was paused.** Ward Core removed one
control from `ward-screen.tsx` at `64c434355`, because a `TR-D6` fix to the reducer would otherwise
have left a live cancel button that silently did nothing — **breaking the screen's own written rule,
four lines from the code.** **The control is gone permanently; the replacement note's WORDING AND
PLACEMENT remain Ward Board's.** **Announced to the coordinator immediately and to Ward Board
directly, rather than left to be discovered.**

⚠️ **THIS IS A DECISION, NOT A MEASUREMENT. Git does not say it; I do.** **Both sessions were told
simultaneously so neither learned it from the other's commit, and both were invited to object.**
**Ward Board verified the git claim independently rather than taking it, and accepted the split** —
adding one thing that strengthens it: **one of the branches carrying all three commits is the
read-only orientation copy, so the number of chats that could have claimed the file and did not is
smaller than the branch count suggests.**

**Why the ward forms go with the page rather than with the model:** *"make the questionnaires more
aesthetic"* is **a judgement about how the page reads as a whole**, and splitting the page's look from
the forms inside it **would put two people optimising one screen against different pictures of it.**

⚠️ **THE ORCHESTRATOR'S SESSION NAME CHANGED, 2026-08-30.** It is
`ward-flow-prototype-design-bca00c-02`; **`Ward Orchestrator` no longer resolves and messages to it
bounce.** **Same worktree, same branch, same session in every other respect.**

> ⚠️ **This is the reachability failure pointed at the coordinator itself, and it would have looked
> like a DEAD orchestrator rather than a renamed one.** ✅ **The handover survives it only because it
> names the WORKTREE and the BRANCH rather than the session name** — **which was luck, not design, and
> is recorded as such.** **All five sessions have been told directly.**

**Checked against git, not inferred:** `git rev-parse` on each branch and
`git rev-list --count claude/ward-flow-phases-6-7-design..<branch>` for the divergence figures.

⚠️ **`claude/Ward-design` is 211 commits ahead of the working line AND NEVER FOLDS.** Four design
specs and the decision register live only there. **Three sessions are building from those specs.**
The backup now copies every ward file that exists on exactly one branch, **by name, failing rather
than skipping** — but **a backup is a recovery route, not a second working copy.**

> ⚠️ **The name column decayed too.** The session the owner renamed **Ward Board** was listed here as
> **Ward Future** with a note that *"the name predates the work"* — which was true when written and
> stopped being true when he renamed it. **A note explaining why a name is wrong survives the rename
> that fixes it, and then explains a discrepancy that no longer exists.**

> **The baton moved twice in one evening and the registry was two rows stale within minutes of the
> second move.** That is not carelessness — **custody is the fastest-decaying fact in the project**,
> and it is why it lives in a file that says when it was checked rather than in anybody's memory.

## A stale heavy-gate lock, held by a dead process — CLEARED 2026-08-30

**Owner approved, removed, verified: zero lock directories remain.**

**Two things worth keeping from it.**

> **The refusal message was TRUE and the diagnosis it invited was WRONG.** _"Another Database
> heavyweight command is active"_ tells you to wait for another session. **Nobody was active and it
> would never have cleared.** Before waiting on a lock, **check whether the holder PID is alive.**

**And the override must LEAD the command.** `CLAUDE_ALLOW_PROTECTED_DELETE=1` placed mid-chain after
an `&&` was **blocked anyway — correctly**, because the hook cannot know which part of a chain the
prefix was meant to authorise. **A single command with the variable first works.**

### What it looked like before

**Verified here, not taken on report:**

```
/tmp/clinical-kb-heavy-locks/b580ff14189a215228ab.lock/owner.json
  holderPid 3960   — tasklist returns NOTHING for it. Dead.
  mode exclusive, command `vitest run --reporter=dot`
  worktree D:/Worktrees/Database/pr-2390-fix, startedAt 2026-08-29T20:46Z
```

**It would never have cleared on its own.**

**No session can clear it.** The protection hook blocks destructive commands by the **session's own
working directory**, and every session's cwd is inside a worktree — **so the block fires whatever the
command points at.** That is the guard working as designed; the remedy is the owner's approval, not a
workaround.

## Idle has THREE states, not two, and only one of them wants leaving

**The design session's correction, and it is the sharpest thing said about custody all night.**

I asked whether it was **finished or stopped**, on the grounds that a still branch looks identical
either way. **Both wrong. It is waiting on a person.**

| State                   | Looks like     | Should it be left?                                                |
| ----------------------- | -------------- | ----------------------------------------------------------------- |
| **Finished**            | a still branch | nothing to leave                                                  |
| **Stopped**             | a still branch | **yes — something is wrong**                                      |
| **Waiting on a person** | a still branch | **NO. It is the correct state and pressing it wastes both sides** |

> **All three are indistinguishable from outside, and a coordinator that offers only two will read the
> third as the second** — then push a session to leave a state it is right to be in.

**So the custody question is not _"are you working?"_ but _"what are you waiting for?"_** — which
distinguishes all three and cannot be answered wrongly by a session that is behaving correctly.

## PAUSED 2026-08-30 — the closing state, verified

**Owner instruction: finish what is in progress, then pause. All four sessions reported and stopped.
Nothing is at risk, nothing is half-done, and every worktree is clean.**

| Line                                          | Tip         | State                                                   |
| --------------------------------------------- | ----------- | ------------------------------------------------------- |
| `claude/ward-flow-phases-6-7-design`          | `2b9190447` | the working line. Task 17, DB-11, `Patient`, search     |
| `claude/ward-flow-print-fixes`                | `d3e2dfee0` | the board. **9 ahead / 4 behind**, one content conflict |
| `claude/ward-flow-wave1-referral-corrections` | `10f6c931f` | Wave 1 complete, mutations run                          |
| `claude/Ward-design`                          | `fd5054d09` | the register                                            |
| `claude/Wardquestions`                        | `9912af6be` | this file                                               |

### My own instrument error, on the last measurement of the night

**I reported the board session had "67 uncommitted files" and it had ZERO.**

```
git status --porcelain | wc -l           ->  67
git status --porcelain | grep -vc '^??'  ->   0
```

**Every one was an untracked scratch log.** `wc -l` counts lines; **the question was "is work at
risk".** Different questions — **and the count reads as alarming while measuring something else.**

> **This is the exact class I spent the evening cataloguing, committed by me, on the one measurement
> where being wrong would have caused action** — an urgent message telling a session to stop and
> commit work that did not exist. **The discriminating command is one flag longer.**

**And it is the alarming-result rule failing in the one way the rule did not cover.** I check my
instrument before sending an alarming result **about somebody else's system**. I did not check it
before sending an alarming result **about somebody else's tree** — the same category, and it did not
occur to me because the command felt too simple to be wrong.

## The split changed 2026-08-30 — the whole referral SURFACE is Ward Referrals'

**Owner ruling, after Ward Core recommended it.** Ward Referrals takes the referral screens, the
catchment work, **and `FD-23`, the ward-visibility guard.** Ward Core stops touching referral files.

> **His reasoning: two chats queued to build one safety rule is the problem whichever one stops — and
> a rule about what a ward may SEE belongs with the screens that must enforce it.**

**Ward Core keeps everything else and it is unchanged:** sole writer of `ward-model.ts`,
`ward-flow-events.ts` and the reducer, and **owner of every merge.** Ward Referrals routes model
changes through it.

## ⚠️ RETRACTED: the away group does NOT cost page space

**I relayed a warning to the owner that the "Who is off the ward" group would cost space on every
ward. Its own author measured it and refuted it.**

**At A4 the grid is three columns, rows are equal height, and the row height is set by the no-date
group at five rows — so an empty away cell adds ZERO.** It costs only if it becomes the tallest cell
in its row, or if a seventh group forces a third row.

> **The author's account of its own error is the transferable part: reading the code told it the group
> always renders, which is TRUE, and let it conclude a cost that does not exist. The LAYOUT was the
> half it could not read.**

**A separate live figure travels with this and is NOT resolved by it: the sheet measures about 55px
over a page at that width.** Recorded, not fixed.

## ⚠️ The backup does NOT contain session transcripts — verified

```
project dirs on this machine        104   (5 ward-related)
jsonl transcripts in the backup      42
THIS session's transcript            0 matches
canary: .md files found            577    (proves the search works)
```

**The script captures the CANONICAL location. On a machine with 148 worktrees, almost nothing lives
there** — the same shape as the twelve single-branch documents and the register missing from the
plain copies.

> **What is lost is specific, and the obvious answer is wrong.** Decisions and their reasoning
> **survive** — they are in the register by design. **What exists only in transcripts is the
> cross-session messages: the corrections, the arguments that changed a ruling, the times one chat
> caught another.**

**The owner's script, and his call.**

## Sequencing that is a dependency, not a collision

**Patient search and the ED hub looked like an overlap and are not.** The hub spec references search
twice, and both are load-bearing: **patient search is the ENTRY POINT of the hub's inbox.** Under
`FD-16` nothing arrives from ED medical, so psychiatry find the patient and create the referral
themselves — **without search, no referral can come into existence at all.**

**The spec depends on search and does not design it.** So:

> **The board session's patient search is sequenced AHEAD of any hub build.** One surface, one owner,
> and the hub is a consumer. **The referrals session's patient screen is a third surface the hub does
> not reference.**

## The backup covers the register of record, with two gaps the owner has been told about

**A verified backup ran tonight: `2026-08-29T195705Z`, 303 refs bundled, and `claude/Ward-design` at
`ec9a146af` is in it.** So a lost worktree or a cleanup now costs a restore rather than the record —
which is why nobody needs to fold a 179-commit divergence in a hurry to protect a document.

**Two gaps, and the first is the one that matters:**

> **`ward-flow-ledger.md` is NOT in the plain copies** — only inside the git bundles. The plain copies
> are taken from the main checkout, and this file exists only on a branch checked out in a worktree.
> **The plain copies exist precisely to be readable when git is the thing that failed, so the one
> artefact recoverable only through git is the register of record.**

**And the backup script verifies three critical branches by name**, none of them this one — so a
future run that dropped it **would still report success.** Both reported to the owner; the script is
his and lives outside this repository.

## How to check this file is still true

**Do not trust it. It is the same kind of document as the registry that missed a live session.**

```
git -C <the session's worktree> rev-parse --abbrev-ref HEAD    # what a session actually holds
git worktree list --porcelain                                  # which branch is where
git for-each-ref --sort=-committerdate refs/heads/             # which lines are moving
```

**The check that failed before was phrased as _"which of these is right?"_, and a question in that
shape can never answer _"none of them"_.** Ask the tree, then ask the session.

## The two failures this file was written after

**I allocated one small fix to two sessions.** Neither erred: the claim had been made
**session-to-session**, which an orchestrator cannot see unless somebody relays it. **The session
that declined rather than complying is what caught it** — compliance would have produced the same
change twice, merged against itself.

**And a fifth live session was committing to a ward branch with no row anywhere.** A worktree
directory and a session name sharing a stem is **not** evidence of a relationship: the harness names
sessions after worktrees, and a rename breaks exactly that mapping.

## One standing risk — measured, and the remedy is NOT the one I first gave

**`claude/Ward-design` carries the register of record and is not a descendant of the working line.**
Measured here, independently of the session that raised it:

```
divergence          179 commits on Ward-design / 174 on the main line
merge-tree          CONFLICTS — a fold is a real merge, not a fast-forward
ledger on main      ABSENT
protection hook     grep -Eqi, and `ward-design` is named explicitly — deletion IS denied
```

**So of the two risks I named, one is already covered and the other is worse than I thought.** A
shell deletion of that branch or worktree is blocked by the hook. **The fold is the risk that
stands** — and 179 commits each way with confirmed conflicts is **not a branch that folds; it is a
second history.**

> **My first remedy was wrong twice over. "Fold it" would make the most dangerous operation in the
> programme happen for a reason that has nothing to do with the code in it. And "or mirror it" is
> the exact failure I had just accepted the rule to prevent** — two copies of the one record whose
> errors produce no signal. **A mirrored ledger disagrees with itself within a day and nothing
> errors.**

**The cheap remedy, and it is the design session's call:** bring the one file across as a single
commit — `git show claude/Ward-design:docs/ward-flow-ledger.md` written onto the working line — and
write it there from then on. **One file, one authority, no fold**, and the branch keeps its own
history. **Nobody else is to touch that branch.**
