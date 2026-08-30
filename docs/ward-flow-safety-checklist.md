# Ward Flow — the safety checklist

**Run this before calling ANY item done. Every line is a failure that happened here, not a
precaution somebody imagined.** Written 2026-08-30 for the six-hour autonomous run; it outlives it.

> **The governing failure mode of this whole project: AN ABSENT SIGNAL READS EXACTLY LIKE A PASSING
> ONE.** Every rule below is a way of forcing the absent signal to make a noise.

---

## A. Before you believe a check — four questions, in order

**1. Did it RUN?** ⚠️ **Vitest can report green while silently dropping a file.** `scripts/run-ward-tests.mjs`
exists for exactly this: it **refuses unless every file handed in produced a result**, and it prints
**both numbers, always** — handed in and ran. **A hand-picked suite list has shipped a red test twice
on this project.** Discover the set from disk; refuse a silent zero.

> ⚠️ **THE WRAPPER IS NOT A HYPOTHETICAL SAFEGUARD. It refused a real run on 2026-08-30:** a worker
> died on `VirtualAlloc`, several files produced **no result**, **and vitest itself exited 0.** **The
> failure it was written for recurred within hours, unprompted, and was caught.** Re-run clean at
> 84 / 84 / 1249. **Not a planted canary — a real one.**

**2. Can it FAIL?** ⚠️ **Prove it before you believe it passed.** Mutate the thing under test, watch
the check go red, restore, watch it go green. **The vacuous test found tonight was written by the
session that had spent the day hunting vacuous tests, inside the commit fixing one.** Expertise in the
failure mode is not immunity to it — **only the mutation is.**

**3. Was it GREEN BEFORE THE CODE?** ⚠️ **A test that passes before the implementation exists proves
nothing and is counted as coverage of what it never checked.** Test-first is not the discipline;
**watching the red is.**

**4. Does it assert its FIXTURE'S property, or trust it?** Pick the case least able to pass any other
way, **then assert that property**, so a later fixture edit cannot hollow out the proof in silence.

## B. Before you believe a NUMBER

- ⚠️ **NEVER PIPE A GATE THROUGH `tail`.** It **discards the evidence** and **reports the PIPE's exit
  code, not the gate's.** **Redirect to a file and read it**, or capture `$?` directly.
  **Done twice here.** The second time was by the session that had written the wrapper existing to
  stop exactly that blindness, **in the same hour, while reading that wrapper's refusal.**
- **Paste the decisive line.** Exit code 0 is not proof.
- ⚠️ **Compute the property; never grep something adjacent to it.** Three wrong numbers in one session
  came from measuring a proxy.
- ⚠️ **An alarm that names a count must say whether the count was MEASURED or ASSUMED.** A warning
  saying *"this relocates 16 files"* sounds counted. **That one was not, and a window was cleared for
  a move that should never have happened.**
- **Cross-check a screen figure against another screen.** ⚠️ **TWO screens agreed on 43 open
  movements and a third said 50, counting arrived patients. The outlier was the one a coordinator
  looks at first.**

  > ⚠️ **This said *"three screens, three different totals — 43, 45, 50"*. That was wrong in the
  > direction that WASTES somebody's night:** patient search showed **43 movements PLUS 2 waiting
  > referrals as 45 rows** — **a different and legitimate population, not a third contradiction.**
  > **As written it sends a reader hunting a defect that does not exist, and finding nothing will read
  > as their own failure to look hard enough.** **Two screens agreeing is the EVIDENCE that the third
  > is the outlier; describing it as three-way disagreement destroys exactly that.**
- **Two agreeing checks can share one blind spot.** Diff NAMES, not counts.

## C. Before you believe a CLAIM about the code

- ⚠️ **Assert only about code you have opened.** Three wrong claims in one day came from trusting
  prose. **`git rev-parse <branch>:<path>`**, `git merge-tree`, `git show` — not a document.
  **Broken again on 2026-08-30, by the session that wrote this line, in the message telling another
  session to read it:** *"the fix shape already exists"* was inferred from a page that reads the
  provider and asserted about a board that makes **zero** provider calls. ⚠️ **Inferring a fix from a
  PATTERN is the same failure as inferring a fact from a document.**
- ⚠️ **Never write a symbol, path or field name you have not just read.** An invented `RECORD_ARRIVAL`
  reached three comments in another session's code; an invented `beingPrepared` reached an
  instruction. **The field is `preparing`.**
- **Name the file before assigning work in it.** Nine edits were assigned to a session whose branch
  does not contain the file.
- ⚠️ **Cite by DOCUMENT AND ID together, never by phase number.** **Four same-name collisions in one
  night:** two `Q4`s, two `Phase 9`s, `R31`, and the new phase 4 against the cut phase 4. **A dangling
  reference errors; a colliding one returns a confident wrong answer.**
- **An observation expires.** State every measurement with its SHA or its timestamp.
- ⚠️ **A FINDING AGES BETWEEN MEASUREMENT AND DELIVERY. RE-MEASURE BEFORE QUEUEING IT.** Nine
  defects were queued on 2026-08-30; **four had already been fixed and one was a reasoned refusal
  read as an omission.** **Every relayed finding must carry the SHA it was measured at.**
- ⚠️ **A REFUSAL CARRYING ITS REASON IN A COMMENT READS EXACTLY LIKE AN OVERSIGHT** to anybody
  scanning for defects. `formRequired` stayed a bare string **because widening it would disturb the
  Mental Health Act figure guard the owner said must never be disturbed** — written, in place, and
  read past. **The remedy worked; the reader failed. Read the comment before filing the defect.**
- ⚠️ **A NUMBER THAT VISIBLY DOES NOT RECONCILE IS SAFER THAN ONE THAT INVITES RECONCILIATION AND
  FAILS IT.** A remedy that makes a total *look* as though it should add up, while a second exclusion
  keeps it from adding up, is worse than the honest mismatch it replaced.
- ⚠️ **A FINDING CAN BE ACCURATE AGAINST ONE BRANCH AND STALE AGAINST ANOTHER.** The frozen-board
  sentence was reported by two sessions and **had already been fixed at `ab52ba369`**, ahead of the
  working line on the branch that owns the surface. **Neither of us checked which branch owned it
  before reporting.** **Read the branch that OWNS the surface, not the one you happen to be on.**
- ⚠️ **CHECK A RECOMMENDATION AGAINST THE EXISTING RULINGS, NOT ONLY AGAINST JUDGEMENT.** A
  recommendation to withhold decline reasons from a referring team was sensible on its face and
  **contradicted `FD-24`**, which says a decline does not lock a ward out and an option to clarify
  remains — **a referrer who does not know why cannot clarify anything.** ⚠️ **The two rows sat in
  different sections and neither cited the other, so nothing would have caught it.**
- ⚠️ **A RULE THAT COUNTS ITSELF IS BRITTLE, AND KNOWING THAT DOES NOT HELP.** A rules preamble said
  *"Eleven rules"* in two places while listing twelve — **inside the file containing the rule that
  predicts exactly this.** **Found by reading. Never by writing.**

## D. Before you believe a SCREEN

- ⚠️ **Reach the second screen the way a USER would.** A page reload resets this prototype to seed.
  **Navigating by URL produced a confident report that a working transition was broken**, caught only
  because the reset happened to be visible.
- ⚠️ **A control that looks activatable and is plain text trips NO GATE.** **TWO instances**, both
  measured: **the stage strip** (`<span>`, `cursor: auto`, not focusable) and **the search people
  tiles** (`<li>`/`<span>`, no link, no button). **The wiring rule only sees `<button>`.** Look at it;
  do not grep for it.

  > ⚠️ **THIS LINE SAID *THREE* AND NAMED THE NETWORK CARDS. THAT WAS FALSE AND IT WAS THE MOST
  > DANGEROUS SENTENCE IN THIS DOCUMENT.** Measured at `ward-management-network.tsx:287–297`, those
  > cards are `<button type="button" onClick=… aria-pressed=…>` with an `aria-label` reading the whole
  > card aloud including the eligibility verdict — **the best-wired control on the prototype.** **A
  > checklist naming it as a failure sends the next session to "fix" something that is right, and the
  > most likely repair is to strip the very thing making it accessible.**
  >
  > ⚠️ **AND THE SHAPE IS ONE OF OURS: THREE IS ROUNDER AND MORE CONVINCING THAN TWO.** The item
  > READ better with a third instance, **and the third was supplied by PATTERN rather than
  > measurement** — the same failure as an alarm carrying an assumed count, **which section B warns
  > about two paragraphs above the line that committed it.** Caught by Ward Verifier, who had made the
  > original finding and knew it named only two.
  >
  > **The legibility criticism of those cards is separate and still stands:** *five bare digits,
  > unlabelled in place, unreadable without learning a code* — **what a SIGHTED user sees at a
  > glance.** ⚠️ **A screen-reader user gets the fullest description on the page. Both are true and
  > they are different findings; collapsing them is what produced the false one.**
- ⚠️ **A CSS custom property that does not exist falls through to its fallback IN SILENCE.** After
  writing a rule, **check each token exists.**

  > **NEAR-MISS, 2026-08-30, worth keeping because it was caught BEFORE it was written down:** a
  > `git grep -c` for `--surface-critical` returned a hit, and I nearly filed this rule as stale.
  > ⚠️ **The hit was inside a COMMENT saying those properties do not exist.** **A count of matching
  > lines is not a count of DEFINITIONS**, and *"measure the thing, not a proxy"* is the rule that
  > stopped it — **the second grep, for the matching lines themselves rather than their number, showed
  > it in one look.** **`grep -c` answers a question nobody asked.**
- **A frozen literal beside a live value reads as a live value.** `15 Aug 2026 · WA` sat next to a
  moving clock on every screen with a header.

## E. The standing refusals — these are the owner's, and they are absolute

1. ⚠️ **NEVER invent a figure, timeframe or threshold from the Mental Health Act. Anywhere.** Not as
   a placeholder, not as an example, not in a comment.
2. ⚠️ **SYNTHETIC DATA ONLY.** **Two real organisation names shipped to a live screen tonight** —
   *"St John WA accepted, awaiting departure"* — stating who was collecting a patient, chosen by
   nobody. **Placeholders are DERIVED from an exported list, never hand-written into a component.**
3. **NOTHING MAY RANK A PERSON.** ⚠️ **Whether a SERVICE may be ranked is a DIFFERENT question and is
   not ruled on** — it must never be inferred from this one. Service-level patterns turn oversight
   into performance monitoring of named services: **a different product with real consequences.**
4. **A SUBURB IS NOT AN ADDRESS.** A suburb answers which service covers someone; an address answers
   where they live. **Only one of those is a bed-flow fact.**
5. **ONE story field, on a referral (`FD-13`).** Not a second one anywhere, however obviously
   necessary a handover-note box feels.
6. **`FD-23`: no ward-facing surface shows another destination's referral for the same patient.**
   The coordinator sees all of it. **The reason is behavioural** — so a ward does not take its time
   over a patient referred elsewhere.
7. **NO invented thresholds on ANY clock.** Raw durations. The coordinator hub's waiting list and the
   community hub's follow-up list are named in their own specs as **the two most tempting places in
   the prototype to invent one**, and the places such a figure would look most authoritative.

## F. The process refusals — these protect the work itself

- **Never push, never open a pull request.** Every copy is on one disk.
- **Never `git stash`.** The stack is shared with every worktree on this machine.
- **Never `git add -A`.** Another session may share the tree; the wildcard commits its edits under
  your message.
- **Never touch OpenAI, Supabase, GitHub or hosted CI.**
- **Never weaken or delete a test to make something pass.**
- **Never delete a worktree, a handover, a decision document — including a superseded one — or
  either ward branch, without asking.**
- **One committer per worktree.** Before editing, `git rev-parse <other-branch>:<path>`.
- ⚠️ **Content relays fine; AUTHORITY DOES NOT.** Permissions, reversals and capabilities do not
  travel through the orchestrator. **Three sessions refused a relay tonight and all three were right.**

## G. When you record something

- ⚠️ **Record an absence AT THE SITE where somebody would create it**, never only in a list of
  absences. **A list of removals is read by people who already know; the site of the removal is read
  by people who do not.** The medical-ward arm is the precedent that worked.
- ⚠️ **When a ruling WIDENS what is permitted, amend the refusal register in the same act — and
  scope the amendment to the ruling, never wider.** A refusal register decays in the one direction
  nobody watches: everyone checks whether the code broke a rule; **nobody checks whether the rule
  still describes what he wants** — and **a stale prohibition does not go quiet, it ACCUSES.**
- **Supersede; do not overwrite.** ⚠️ **A record that can only show the latest state cannot show that
  he changed his mind** — so *"he changed his mind"* and *"somebody got it wrong"* become
  indistinguishable in it.
- **Before building a list, say which QUESTION its emptiness answers.** If empty means *"we do not
  know"*, say so. **If empty means *"there is nothing left to do"*, say THAT** — it is the most
  valuable state the list can be in and it looks exactly like the failure.

## H. Backups — what one disk means

**Run `bash ~/.claude/scripts/backup-work.sh` before any fold, merge or cleanup.** It writes verified
git bundles plus plain readable copies to `C:/Users/joshs/Backups/claude-work/`.

⚠️ **SOME WARD FILES EXIST ON EXACTLY ONE BRANCH. THE SCRIPT PRINTS THE LIST — READ IT, DO NOT
TRUST A COUNT WRITTEN HERE.**

**It copies each one out by name and FAILS rather than skipping if one cannot be read.** The output
line is `ok  <path> (only on <branch>)`.

> ⚠️ **THIS PARAGRAPH SAID "EIGHT" AND LISTED THEM. IT WAS TEN WITHIN THE HOUR AND ELEVEN SOON
> AFTER** — four new tests appeared and `scripts/run-ward-tests.mjs` LEFT the list, because Ward Core
> merged the branch carrying it. **The set changes every time anybody commits a new file or folds a
> branch.**
>
> **`R23` again: a rule that COUNTS is brittle — and this is the second time in one night that rule
> has been broken by somebody who knows it**, the first being a rules preamble saying *"Eleven rules"*
> while listing twelve, **inside the file containing `R23` itself.**
>
> ✅ **The fix is not a better count. It is to stop carrying one:** the script measures it at run time,
> so the checklist points at the script and the script prints the truth. **A document that names a
> figure somebody else's commit can change is a document with an expiry date nobody wrote on it.**

**WHAT IS STRUCTURALLY TRUE, and does not change with a commit:**

> ⚠️ **All four design specs the builders are working FROM exist on ONE branch, and it is the
> divergent one that never folds.** A worktree on this machine has been deleted mid-session twice.
> **Until those specs fold or are copied, the backup is the only other copy.**

---

## I. The documentation layer has a check now, and it has been run

**The audit prompt's first probe asks which of these rules could ever tell you it was being broken.
For the DOCUMENTS, the answer was none. It is now partly answerable:**

**Every commit SHA and every file path cited in `docs/ward-flow-*.md` can be verified mechanically.**
Run from the scratchpad (`check_citations.py`):

- **Scan all 31 ward documents** for backticked SHAs and backticked repository paths.
- **Every SHA** must resolve with `git cat-file -e <sha>^{commit}`.
- **Every path** must exist on at least one of the six ward branches (`git rev-parse <branch>:<path>`).
- ⚠️ **All-digit tokens are reported SEPARATELY, never silently dropped** — they are usually byte
  counts, but a genuinely all-digit short SHA is possible (~3.7% of 7-character SHAs), **and a silent
  skip is the failure this project keeps being caught by.**

**RESULT, 2026-08-30, proved able to fail first:**

```
--selftest (injects one impossible SHA + one absent path)   exit 1, both caught
real run    113 SHAs cited, 111 resolved, 0 unresolved, 2 all-digit (byte counts)
            168 paths cited, 168 found, 0 missing            exit 0
```

⚠️ **It is NOT committed to `scripts/`, deliberately.** `scripts/update-docs-inventory.mjs` fails
when `docs/scripts-index.md` is stale, **so adding a file there would break a gate for four sessions
that are mid-build.** **Committing it belongs to a quiet moment, with `npm run docs:update` in the
same commit.** **Recorded here so the check is not lost with the scratchpad.**

**What it does NOT check, stated so its green is not read as more than it is:** whether a cited SHA is
the RIGHT one, whether a path's CONTENT still says what the document claims, or whether a rule is
still true. **It closes the dangling-citation hole only** — which is the one that made
*"a citation without a row looks live to every reader"* worth writing down.

---

## J. Two findings from reasoning about the plan rather than reading a screen

**Both found 2026-08-30 during an adversarial pass over the plan itself, both verified in the source
before being written here.**

### ⚠️ 1. `run-ward-tests.mjs` DOES NOT GO THROUGH THE REPOSITORY RUN COORDINATOR

**It calls `npx vitest run` directly** (`spawnSync` at line 78). **It never acquires a lease.**

**The repository coordinator permits at most two focused Vitest leases from different worktrees and
treats a FULL Vitest run as exclusive.** ⚠️ **Four sessions running the whole ward suite through this
wrapper bypass that entirely.**

**And there is already one datapoint: a worker died with `VirtualAlloc failed` tonight, several files
produced no result, and vitest exited 0.** ⚠️ **That is what memory exhaustion looks like, and
concurrent full runs are the obvious source — but it is a HYPOTHESIS, not a measurement. Nobody
correlated the death with what the other sessions were doing at that second, and nobody can now.**

✅ **CONFIRMED BY PROBE, not left as reasoning:** `run-vitest.mjs` calls `acquireHeavyRunLock` and
**REFUSED Ward Verifier outright**, because a live Codex worktree (**PID 4288, verified running, not
a stale lock**) held focused-test capacity. **The contention is real and the wrapper has been walking
past it all evening.**

⚠️ **AND ROUTING THE WRAPPER THROUGH THE LEASE IS A BIGGER CHANGE THAN "SWAP THE SPAWN LINE".** **A
capacity refusal is NOT a test failure**, and this repository already separates them — `verify:ui`
exits **75** with `DATABASE_HEAVY_RUN_ADMISSION_BUSY` rather than reporting red. **So the wrapper
needs a FOURTH outcome** — passed, failed, refused-for-incompleteness, **blocked** — not a changed
call. **That belongs to a quiet hour, and it is documented in the tool's own header at `ee0aba0bd`.**

**MITIGATION MEANWHILE, and it costs nothing because the wrapper already supports it: HAND IN ONLY
THE FILES YOUR CHANGE TOUCHES.** The wrapper takes a file list and **still refuses if any handed-in file
produced no result**, so a narrow run keeps the whole guarantee. **Reserve the full suite for a
fold, and say when you are about to run one.**

> **The wrapper's guarantee is about COMPLETENESS OF WHAT YOU HANDED IN, not about breadth. A narrow
> run is not a weaker check — it is the same check over a smaller set.**

### ⚠️ 2. THE WARD PAGE AND THE COORDINATOR HUB MUST READ **DIFFERENT** MODELS, AND BOTH ARE RIGHT

**Verified in `ward-model.ts`:**

```
referredUnitIds: string[]        "Units currently holding a live referral."   <- WARDS ONLY
destinations: ReferralAddressing[]                                            <- THE UNION
```

- **The ward page's inbox asks *"which wards is this addressed to?"*** — `referredUnitIds` answers it
  exactly, and Ward Core has ruled it stays there.
- **The coordinator hub's *"one patient, every destination"* asks *"where else has this person been
  referred?"*** — and **`referredUnitIds` CANNOT REPRESENT A NON-WARD DESTINATION AT ALL.**

⚠️ **So a coordinator hub built on `referredUnitIds` would silently omit every ED and community
referral — which is the exact thing the section exists to show. It would look complete and be wrong,
with no screen to disagree with it** (the ward pages are forbidden that view by `FD-23`).

> ⚠️ **THE TRAP TO NAME NOW: a later reader sees two screens reading two different fields for what
> sounds like the same fact, and HARMONISES them. Whichever way they harmonise, one screen breaks** —
> and the coordinator-hub direction breaks silently.

**Recorded here rather than only in a message, because the person who harmonises them will not have
read the message.**

---

## K. The number that is consistent, plausible, correctly sorted — and computed against a stale fixture

**Found 2026-08-30 by Ward Board. It is the hardest shape in section B and it deserves its own
section, because nothing about it looks wrong.**

### What happened

**`edPressure(now, movements = wardMovements)` — a DEFAULT pointing at the frozen seed.** Both
home-page callers had forgotten to pass live state: `FlowDiagram` called `edPressure(now)`, and
`PressureStrip` declared its prop **optional** while the coordinator screen rendered it without one.

**The provider re-anchors the whole fixture to the hour the demonstration is opened.** ⚠️ **The code
moved only ONE SIDE OF THE SUBTRACTION** — `now` was the re-anchored clock, the movements were the
untouched seed. **Every wait was inflated by exactly the anchor offset, from the first paint.**

### ⚠️ AND THE ORDER MOVED, WHICH NOBODY PREDICTED

```
expected [3895, 757, 1915, 1127, 1090, 1016, 979, 905]
to equal [3720, 1740,  952,  915,  841,  804,  730, 582]
```

**Every figure +175, as expected. But `edPressure` sorts worst-first with BREACH COUNT outranking
wait length — so inflating every wait pushes departments over the legal deadline that have not passed
it.** ⚠️ **The coordinator's ED cards were in the WRONG ORDER, on a panel whose entire job is
*"which department is worst, first"*.**

> **A uniform offset is not a uniform error once anything THRESHOLDS on the value.** **Adding a
> constant to every wait changed which department appeared most urgent.**

### ⚠️ WHY NO TEST COULD SEE IT — the transferable part

**Every test passes `movements` explicitly. Every DOM test pins `initialNow`, so the offset is zero
and shifted == unshifted.**

> ⚠️ **THE SUITE EXERCISED THE PARAMETER THOROUGHLY AND NEVER ONCE EXERCISED ITS ABSENCE — the only
> condition under which the bug exists.**

**THE RULE: a parameter with a default is only wrong when OMITTED. A suite that always passes it can
be exhaustive and still never reach the broken path.** **When you see a default, ask what tests the
call WITHOUT it — and if the answer is nothing, that is not coverage, it is a blind spot with high
line-count.**

> ⚠️ **THE GENERAL FORM, and it is bigger than defaults — Ward Board, joining its own finding to
> Ward Core's:**
>
> **A DEFAULT PARAMETER is only wrong when OMITTED. A TYPE-ONLY REQUIRED FIELD is only wrong when
> ABSENT. In both cases the suite exercised the feature thoroughly and NEVER ONCE EXERCISED THE
> MISSING CASE — the only state in which the bug exists.**
>
> ⚠️ **AND THE COMMON CAUSE UNDERNEATH BOTH: `vitest run` INVOLVES NO `tsc`. Every guarantee
> carried by the type system alone is UNENFORCED AT RUNTIME, and the test suite cannot tell you.**
> **`reason` was declared required; a caller omitting it wrote `undefined` into the record with the
> suite green.**

**This is not about transports and it is not about ED panels. It is the rule for any guarantee that
lives only in a type.**

**And the fix was not to remove the injection point** — that was never the problem. ⚠️ **Making it
OPTIONAL was.**

### The comments were true of the INTENT and false of the CODE

**`ward-pressure.ts` called the default *"deliberately injectable"*. `pressure-strip.tsx` called its
prop a *"test-only injection point"* and stated that PRODUCTION NEVER PASSES IT — while its production
caller was the one OMITTING it.**

⚠️ **That is the rules-go-stale rule pointing at a COMMENT rather than at a register**, and it is
worse there: **a stale register accuses; a stale comment REASSURES.** **Both comments were repaired in
the same commit as the code, which is the only way that ever holds.**

### The bound, measured rather than claimed — and what it does NOT cover

```
grep -rln 'from "@/components/ward-management/ward-movements"' src/components/ward-management/
   -> ward-flow-reducer.ts, and nothing else
grep -rnE '=\s*(wardMovements|wardAdmissions|bedReleases|leaveBeds|referrals|wardPatients)\s*[,)]' src/
   -> nothing
```

✅ **No seed-module parameter default survives anywhere, and the class is closed FOR MOVEMENTS.**
⚠️ **The other four seeds were checked for the DEFAULT and NOT for the SHAPE of the bug. Anything
reading `wardAdmissions` or `bedReleases` outside the reducer deserves the same look.** **Stated as a
gap rather than folded into the good news.**

### One more thing the wrapper caught, and it is a use nobody designed for

**Ward Board discovered its affected set with `grep -rl` over `tests/`, which pulled in two Playwright
`.spec.ts` files. The wrapper reported `10 handed in, 8 ran` and REFUSED.**

⚠️ **Vitest SILENTLY IGNORES a Playwright spec and would have reported 8/8 green.** **So the
completeness guarantee catches a WRONG INPUT as well as a lost worker** — **and a grep-discovered
test set needs a file-type filter, because the discovery step is exactly where a silent zero enters.**

---

## L. ⚠️ THE MACHINE RAN OUT OF COMMIT CHARGE, AND IT KILLED MORE THAN COMMANDS

**Observed directly on 2026-08-30, in two tools in one command:**

```
/usr/bin/bash: fork: retry: Resource temporarily unavailable
dofork: child -1 - forked process died unexpectedly, exit code 0xC000012D
```

**`0xC000012D` is `STATUS_COMMITMENT_LIMIT`** — Windows refused to commit more memory. **A `python`
and a `git commit` both died in the same command; the edit they carried was never written, and the
next command carried on as though it had been.**

⚠️ **AND IT TOOK THE ORCHESTRATOR SESSION ITSELF.** Ward Board's reply bounced with
`ENOINBOX: dead-owner`, and the session reappeared under a **different transport**. **So the condition
is not only losing individual commands, it is ENDING SESSIONS** — which is how work disappears without
anybody deciding to abandon it.

### ⚠️ TWO SEPARATE HYPOTHESES. DO NOT MERGE THEM.

**Ward Board's, and it fits the symptom better than mine did:**

> **`ListAgents` reported 48 PEER SESSIONS.** Five live Ward chats, one Caring Contacts, a Remote
> Control set, and roughly thirty idle cloud sessions. **Commit charge is the SUM of everything
> reserved across every process, and it is a STANDING cost that does not go away when a session is
> idle — whereas a test run spikes and releases.** **The symptom was an ordinary `fork` failing, not
> a huge allocation failing**, which is what a machine already sitting near the limit looks like.
> **This machine has hit a milder form before: enough open sessions that every trivial command took
> seconds.**

**Mine: concurrent full vitest suites caused the earlier `VirtualAlloc failed` worker death.**

⚠️ **KEEPING THEM SEPARATE IS THE POINT, AND IT IS NOT PEDANTRY: if both are filed as one "memory
pressure" item, CLOSING THE CHEAP ONE WILL READ AS CLOSING BOTH.**

| | Hypothesis | Measured | Action | Whose |
| --- | --- | --- | --- | --- |
| **1** | ~48 resident sessions hold standing commit charge | **the 48** — nothing per-session | **close dead sessions** | **the owner's** |
| **2** | concurrent full suites spike past the limit | nothing correlating the death to other sessions | **narrow test runs** | ours |

⚠️ **GUARD THE "WHOSE" COLUMN. It is the load-bearing one.** **It is what stops row 2 being used to
close row 1 — and the expensive row is NOT OURS TO DO AND CANNOT BE DONE BY BEING MORE CAREFUL.**
**If those two owners ever collapse into one, the distinction goes with them and the cheap action
starts standing in for the one that would actually fix it.**

**Neither excludes the other, and the actions do not compete:** **narrow runs cost nothing and help if
2 is right; closing sessions is the owner's and helps if 1 is right.** ⚠️ **Even hypothesis 1 is not
promoted past "hypothesis with a measurement attached" — the 48 is real, but no per-session commit
charge was measured, so the sessions could be a CO-SYMPTOM of a machine already under pressure rather
than its cause.**

### ⚠️ AN UNWRITTEN EDIT LOOKS EXACTLY LIKE NOTHING TO COMMIT

**A fork failure is silent in the way that matters. The error scrolls past in a wall of output, the
file simply does not change, and `git status` comes back clean** — **indistinguishable from having
already committed.**

**THE RULE, in Ward Board's sharper form: VERIFY THE COMMITTED CONTENT, NOT THE WORKING TREE.**

> ⚠️ **A working-tree check passes in the WORST case: the edit landed, the `git commit` died, the
> files look perfect, and `HEAD` does not have them.** **That is exactly what happened here.**

```bash
git show --stat HEAD          # did the commit exist at all
git show HEAD:<path> | grep   # does the COMMITTED blob contain what you wrote
```

⚠️ **`git commit --amend` IS THE ONE TO FEAR.** **It is the only common git operation that
DESTROYS the previous state as a precondition of creating the new one.** Every other failure here is
merely *"the new thing did not happen"*. **A dying amend can leave the old commit unreferenced and the
new one unformed** — recoverable from the reflog, **but only by somebody who knows to look, and it
presents as a branch that lost a commit for no reason.** **Under these conditions, add a follow-up
commit instead.**

⚠️ **AND THIS SITS UPSTREAM OF `run-ward-tests.mjs`, WHERE THE WRAPPER CANNOT SEE IT.** **The
wrapper guarantees every file handed in produced a result. It cannot guarantee the EDIT YOU MEANT TO
TEST was ever written to disk** — **so a run can be honestly, completely green over the old content.**

### ⚠️ A VERIFICATION CHAIN CAN ABORT AND STILL READ AS A FINISHED REPORT

**`cmd && cmd && cmd` where one step is a `grep -c` expecting ZERO matches.** ⚠️ **Zero is the
CORRECT answer and `grep` exits 1 on it, so the chain aborts and every later check never runs.**
**The output ends looking like a completed report, with nothing announcing that most of it was never
attempted.**

> **The same shape as `83 passed (83)` when 84 files went in: a confident total over a set nobody
> checked the size of.**

**THE RULE: use `;` not `&&` in an inspection sequence, so every question is asked and answered
separately.** **Both sessions hit this tonight, independently, within an hour.**

### ⚠️ AND THE REASON ONE OF US SAW IT AND THE OTHER DID NOT IS THE MORE USEFUL FINDING

**I hit the truncation an HOUR EARLIER and read it as a nuisance.** Ward Board hit it and named it.
**The difference was not care:**

> ⚠️ **A FINDING THAT ARRIVES DISGUISED AS FRICTION IS THE HARDEST KIND TO CATCH, BECAUSE THE COST
> OF IGNORING IT IS ZERO AT THE MOMENT IT HAPPENS.** You re-run the command, it works, you move on.

**It became visible to Ward Board because it hit it WHILE VERIFYING SOMETHING IT HAD A SPECIFIC REASON
TO DISTRUST.** **I hit it during ordinary work, where nothing made it stand out.**

**That is a difference in CIRCUMSTANCE, and it is the version worth recording** — **because ordinary
work is where it will happen to everybody else.** ⚠️ **The defence cannot be *"be more alert"*. It is
to treat a command that had to be re-run as a report about the TOOL, not about your typing.**

### ✅ A CLAIMED COMMIT IS EXACTLY WHAT THIS CONDITION MAKES UNRELIABLE — have somebody else resolve it

**Ward Board verified `846be82bb` independently, from the shared object store in its own worktree,
rather than taking my word: subject matched, and `git show 846be82bb:<path>` carried both new
sections.**

> **A second pair of eyes on the object store costs ONE COMMAND, and it is the only thing that stops
> a commit claim being self-reported — by the session that lost a `git commit` an hour earlier.**

**THE RULE: when a session under these conditions claims a commit landed, another session should
resolve the SHA and grep the blob.** **It is cheap, it is mechanical, and it does not depend on the
claiming session being right about itself.**


### What follows for how work is run

1. **Keep test runs narrow — now for a physical reason, not lock etiquette.** **A shared module half
   the app imports still earns the full run; iteration does not.**
2. **Announce a full suite before running one.**
3. **Do not diagnose memory pressure by launching more processes.** **A cheap check that fails is
   better evidence than an expensive one that cannot start.**
4. **Commit early and often, and verify the COMMIT** — not the tree.

---

## M. ⚠️ THE HARDEST FINDING OF THE NIGHT, AND IT IS ABOUT THIS DOCUMENT

**The `&&` / `grep -c` truncation was NOT discovered tonight. It was already in this project's durable
memory, filed 2026-08-18, in a file called *"checks that cannot fail"*:**

```
checks-that-cannot-fail.md:28   A guard chained behind `grep -c` with `&&`. A mutation proof ran
                          :30   grep exits non-zero when it matches nothing, so `&&` short-circuited
                          :34   use `;` between the presence check and the gate, never `&&` --
                                the first command's exit status is DATA ABOUT THE FILE, not a precondition.
```

⚠️ **THE RULE WAS WRITTEN, CORRECTLY, TWELVE DAYS AGO. IT WAS IN THIS SESSION'S LOADED CONTEXT AT
STARTUP. TWO SESSIONS HIT IT ANYWAY, WITHIN AN HOUR OF EACH OTHER.**

> ⚠️ **A MEMORY NOBODY READS AT THE MOMENT THEY NEED IT IS NOT A CONTROL.** — Ward Verifier

**And that is a verdict on THIS DOCUMENT, not only on that one.** **This checklist is now thirteen
sections of correct, hard-won rules — and the evidence in front of us is that a correct rule, loaded
into context, does not fire at the moment of use.** **The rule did not fail; the RETRIEVAL failed.**

### ⚠️ Why "read the checklist" cannot be the remedy

**Every failure tonight came from somebody doing ordinary work at speed. Nobody was being careless and
nobody stopped to consult a document, because nothing in the moment announced that a document
applied.** **The friction finding above is the same thing said from the other side: the cost of
ignoring it is zero AT THE MOMENT IT HAPPENS.**

**So a longer or better-written checklist buys very little. But the remedy is NOT simply *"move each
rule into a tool"* — Ward Verifier's qualifier, and it changes the table:**

> ⚠️ **A RULE CAN ONLY MOVE INTO A TOOL IF THE THING IT GOVERNS PASSES THROUGH SOMETHING THAT RUNS.**

| Rule | What it governs | Status |
| --- | --- | --- |
| every file handed in must produce a result | **a test run — a process** | ✅ **A CONTROL.** `run-ward-tests.mjs`; three real catches |
| verify `HEAD`, not the working tree | **a claim made after a commit** | ⚠️ **A REMINDER, NOT YET A CONTROL** — stated in the wrapper's header, enforced by nothing |
| a cited SHA or path must resolve | **text in files; hooks run over files** | ✅ **A CONTROL.** `scripts/check-ward-citations.mjs`, committed |
| `;` not `&&` in an inspection sequence | **an ad-hoc shell command typed mid-task** | ❌ **PERMANENTLY PROSE.** Never a file; nothing runs over it |
| a rule that counts is brittle | **prose somebody writes** | ❌ **permanently prose** |
| a CSS token used must exist | **source** | ⚠️ **eligible, not built** |

⚠️ **THE LAST TWO CATEGORIES ARE THE POINT, AND MARKING THEM STOPS THIS TABLE READING AS A BACKLOG.**
**The checklist's weakest sections are NOT the ones that failed to mechanise — they are the ones where
mechanisation was NEVER POSSIBLE and the prose is therefore the whole control.** **Most of what was
learned tonight is in that class, because most of it is about THE MOMENT OF COMPOSING A COMMAND.**

### ⚠️ AND MY OWN ROW FAILS MY OWN RULE

**A checker that sits in a scratchpad is not a control either.** **Ward Verifier lived this exact
failure the same morning: its wrapper existed, worked, had caught things — and it told four chats to
run something that existed only on its branch.**

> **If a tool is good enough to appear in this table, it is good enough to COMMIT. If it is not, it
> should not be COUNTED.**

✅ **AND IT IS NO LONGER STRANDED. `scripts/check-ward-citations.mjs`, committed with
`node scripts/update-docs-inventory.mjs` in the same commit.**

⚠️ **THE REASON I HAD NOT COMMITTED IT WAS WRONG, AND IT WAS WRONG IN A FAMILIAR WAY.** I said
regenerating the docs index was *"a build command on a machine killing processes at
`STATUS_COMMITMENT_LIMIT`"*. **Ward Verifier measured it. `npm run docs:update` is a FOUR-LINK CHAIN
and only the second link is the inventory** — and that link alone is **one `git ls-files -z -- scripts`,
two counts, and a regex replacing two numbers in one line.** **No build, no server, no toolchain
fork.** **I priced my caution against a different command**, which is *measure the thing, not a proxy*
in its most ordinary form: **I read a script NAME in a document and assumed its weight.**

**Two things learned in the doing, both worth keeping:**

- **`git ls-files` sees only TRACKED files, so `git add` comes BEFORE regenerating the index.** Run
  it the other way and the count does not move and the tool reports *"current"* — **a green result
  meaning nothing.**
- **The two counts are INDEPENDENT.** Adding a file under `scripts/` moves the file count and does
  **not** require a matching `package.json` entry.

**The port was verified rather than trusted:** the original Python and the committed `.mjs` were run
**at the same moment** and returned **byte-identical** lines — `130 SHAs / 128 resolved / 0 unresolved
/ 2 all-digit`, `174 paths / 174 found / 0 missing` — **and the `--selftest` canary exits 1 naming both
injected faults.** ⚠️ **A rewritten checker whose whole value is being trustworthy has to be checked
against the thing it replaces, not against its own output.**

### ⚠️ ONE RULE DELIBERATELY NOT MECHANISED, and the reasoning is the useful part

**Ward Core found that a behavioural test which does not route through the thing it tests is a
structural test in better clothes.** **The obvious wrapper check — *"a test file importing nothing
from `src/` is structural"* — WOULD BE WRONG HERE**, because this repository **deliberately** contains
string-scan and structural guards that are correct and intentional. **The check would fire on good
tests.**

> ⚠️ **A refusal that is SOMETIMES WRONG destroys the one property the wrapper has: that when it
> refuses, it is right. And a warning instead would be noise — and noise is how a real refusal gets
> ignored later.**

**So that one stays prose, and the control remains what Ward Core actually did: MUTATE, AND WATCH
WHICH TEST GOES RED.** **Recorded as a decision rather than left as silence, so nobody builds it later
believing it was merely overlooked.**

⚠️ **Do not read this as "the documents were a waste".** **They are how a rule gets stated precisely
enough to be mechanised, and every tool above started as a paragraph here.** **The error would be
stopping at the paragraph and calling it a safeguard.**

### The corroboration that came with it, filed at its true strength

**Ward Verifier: PowerShell failed to START with a `ServicePointManager` type-initializer failure** —
**an allocation failure at PROCESS INIT, not inside a test run.** ⚠️ **Consistent with a machine-wide
standing charge rather than a transient spike — and it filed this as *"consistent is not evidence"*,
explicitly declining to be a second vote for the ~48-session figure it had not measured.**

**That is the calibration rule working in the direction that costs something: it would have been
easier, and wrong, to report it as confirmation.**

---

## N. ⚠️ I REPORTED A DEFECT CLASS CLOSED FROM A GREP ON ONE BRANCH

**I told Ward Core: *"No seed-module parameter default survives anywhere. The class is closed FOR
MOVEMENTS."*** **When it checked, `ward-pressure.ts:25` still read `movements: Movement[] =
wardMovements` and both callers still omitted it.**

⚠️ **BOARD'S FIX WAS REAL AND LIVED ON BOARD'S BRANCH ONLY.** **The class was closed where Board
could see it and WIDE OPEN ON THE LINE EVERY OTHER SESSION BUILDS FROM.**

> ⚠️ **DO NOT REPORT A CLASS CLOSED FROM A GREP ON ONE BRANCH.**
>
> **NAMING THE BRANCH YOU MEASURED ON WOULD HAVE MADE IT SELF-CORRECTING. ONE WORD.**

**Ward Core nearly took it and moved on; the only reason it did not is that it happened to be in that
file already.** **It has since merged Board's five commits (`93827a799`, merge-tree checked first), so
the parameter is non-optional on the working line now.**

**SECOND TIME TONIGHT THE BRANCH DIMENSION HAS BITTEN**, and the first was the mirror image: **the
frozen-board sentence was reported as a live defect by two sessions when Board had ALREADY FIXED IT on
its own branch.** ⚠️ **Once in each direction — a fix invisible from elsewhere, and a defect invisible
from elsewhere — and both came from a measurement stated without its branch.**

**THE RULE: an observation carries its BRANCH as well as its SHA. *"Measured at `<sha>` on
`<branch>`"* is the whole fix, and it costs one word.**

## ⚠️ A SECOND LIVE INSTANCE THE FIRST FIX DID NOT REACH

```
OutOfAreaBoard({ admissions = wardAdmissions })   // the frozen seed
const { units, now } = useWardFlow();             // re-anchored
```

**Same shape, and on the worst screen for it: the out-of-area board's headline fact is DAYS IN A BED,
the route renders `<OutOfAreaBoard />`, so the default was taken IN PRODUCTION.** ⚠️ ***A wrong clock
looks wrong; a wrong length of stay looks plausible*** — **and out-of-area duration is a figure people
ESCALATE on.** Fixed at `74253c367`.

## ⚠️ A STATED REASON THAT IS NOT THE OPERATIVE ONE IS WORSE THAN NO REASON

**Behind that defect sat another. The screen's provenance paragraph told the reader that a patient who
arrives during the session IS added, and blamed their absence on a missing home region.** **The real
reason was entirely different: arrival appends to REDUCER STATE and the screen was not looking at
state.**

> ⚠️ **A stated reason that is not the operative one READS AS DILIGENCE AND SENDS THE NEXT READER
> SOMEWHERE ELSE.** **It is worse than silence, because silence prompts a question and a wrong reason
> answers it.**

**The doc comment above it had the same shape** — asserting `Admission` was not in reducer state.
**Accurate when written; nothing failed when it stopped being true; it went on justifying a read that
had become wrong.** **Fourth comment this week doing exactly that.**

## ⚠️ A BEHAVIOURAL TEST THAT DOES NOT ROUTE THROUGH THE THING IT TESTS IS A STRUCTURAL TEST IN BETTER CLOTHES

**Ward Core's own first test for the fix DID NOT BITE, and it only knows because it mutated.** **The
test called `outOfAreaLedger` directly, so it proved the DERIVATION and never routed through the
COMPONENT'S DATA SOURCE — which was the thing under test.** **Under mutation it passed happily while
only a string-scan guard failed.**

**Rewritten to render the screen at a NON-ZERO anchor offset.** ⚠️ **That is the condition every DOM
test in this project excludes BY CONSTRUCTION: they all pin `initialNow`, which makes the offset zero,
and at zero the shifted and unshifted fixtures are BYTE-IDENTICAL.** **Board's *"exercised the
parameter, never its absence"*, one layer down.**

**And its first clock value proved nothing either — every seeded arrival sits 90 minutes into its day,
so no positive offset reaches a day boundary.** ✅ **The canary asserting that live and frozen readings
DIFFER caught it on the first run.** **Two mutations, two rewrites, before the test was worth having.**

### ⚠️ THE CHECKER I JUST COMMITTED COULD NOT FAIL, AND IT TOOK MINUTES TO FIND

**Ward Verifier read `scripts/check-ward-citations.mjs` from my branch and asked the one question I
had not: WHAT DOES IT DO IF THE SCAN FINDS NOTHING?**

⚠️ **It printed `0 SHAs, 0 unresolved, 0 missing` and EXITED 0.** **Run from the wrong directory, or
in a worktree whose `docs/` carries no ward documents, it reported a clean bill of health for a
corpus it never reached.**

> ⚠️ **A CONTROL WRITTEN TONIGHT, INSIDE A DOCUMENT ABOUT CONTROLS THAT CANNOT FAIL, COULD NOT
> FAIL.** **Third instance of this shape in one night** — the vacuous test written by the session
> hunting vacuous tests, the stranded document written by the author of the stranded-tool rule, and
> now this. **It is no longer evidence about anybody's care. It is a property of the work.**

**FIXED, AND THE FIX IS A THIRD EXIT CODE, because *"clean"* and *"never ran"* must not share one:**

```
0  every citation resolved
1  a citation did not resolve
2  REFUSED -- the scan never reached a corpus
```

⚠️ **An absent `docs/` originally threw an uncaught `ENOENT` and exited 1** — **which in this tool
MEANS "a citation did not resolve".** **Two entirely different situations sharing an exit code is the
same fault one layer down, and the first fix introduced it.**

**All four states proved before the tool was believed:**

```
no docs/ at all                 REFUSED, exit 2
docs/ with no ward documents    REFUSED, exit 2
--selftest injected faults      exit 1, both named
healthy tree                    exit 0, 130 SHAs / 128 resolved, 175 paths / 175 found
```

### ⚠️ AND I OVERSTATED ITS STRANDING — corrected

**I wrote that it was stranded on a 260-commit docs branch. Ward Verifier measured the file instead of
reading my claim: 119 lines, three Node builtins, NO local imports and NO dependencies.**

> **So availability was never a branch problem. Any session, any worktree, one command, touching
> nothing:**
>
> ```bash
> git show claude/Wardquestions:scripts/check-ward-citations.mjs > scripts/check-ward-citations.mjs
> ```

⚠️ ***"Stranded on a 260-commit docs branch"* and *"one `git show` away"* are very different
situations, and I described the first.** **Overstating a limitation is not the safe direction — it
stopped people using something available tonight.**

**What was NOT verified, and is written down rather than assumed: nobody has RUN it in another
worktree.** **The first person to copy it should watch what it REPORTS, not just its exit code** —
⚠️ **which is exactly the failure the exit-2 refusal now catches, and the reason it exists.**

### ⚠️ THEN IT COVERED A QUARTER OF THE CORPUS AND SAID "31 DOCUMENTS SCANNED"

**The first version globbed `docs/ward-flow-*.md` — the top of `docs/` only. That is 31 documents
out of roughly 130.** ⚠️ **The plans and specs under `docs/superpowers/**` carry MORE CITATIONS THAN
ANYTHING ELSE IN THE PROJECT and were all outside it** — **while the output line read
`documents scanned: 31`, which sounds like the corpus rather than a quarter of it.**

> **A control's COVERAGE is part of what it claims. A green run over a quarter of the corpus is not
> a quarter of a guarantee — it is a whole guarantee about a set nobody stated.**

**Widened to a recursive walk. The result is the finding:**

```
before   31 documents   174 paths   0 missing
after   101 documents   315 paths  28 MISSING
```

**All 28 are in DATED PLANS from 14–25 August, naming `src/app/ward-management/**` and
`src/components/ward-management/*` — paths that stopped resolving when the project moved to
`src/app/mockups/ward-flow/**`.** ✅ **ZERO are in live documents.**

### ⚠️ AND I DID NOT TUNE THE CHECK TO MAKE THEM GO AWAY

**The temptation was immediate and it had a good argument: 28 permanent findings make a tool
nobody runs, and *"a refusal that is sometimes wrong destroys the property that when it refuses it
is right"* is a rule from this very document.**

**What was done instead: the missing paths are SPLIT INTO TWO REPORTED GROUPS — live documents and
dated plans — and BOTH STILL FAIL THE RUN.**

> ⚠️ **The split exists so a reader is not told there are 28 LIVE broken references when there are
> 28 HISTORICAL ones. It does not exist to make the tool green.** **The remedy for the historical
> group is a supersession banner on those plans — a claim about completed work that only somebody
> who did it may make** — **and *"do not tune the threshold to make an existing diff pass"* is this
> repository's own rule, which applies to a tool its author wrote an hour ago exactly as it applies
> to anybody else's.**

**A one-file false positive was found in the same pass and is worth the line: my document inventory
matched the bare word `ward`, which also matches `docs/forward-codify-retrieval-rpcs-workorder.md`.**
⚠️ **The checker matches `ward-flow` / `ward-management` / `ward-board` instead** — **a substring
match on a common English fragment is a measurement error waiting for the right filename.**

---

## O. ⚠️ I MEASURED ONE FACT AND OFFERED IT AS EVIDENCE FOR A DIFFERENT ONE

**I found 28 paths in nine dated plans that no longer resolve, and offered it to Ward Verifier as
evidence those plans have earned a supersession banner. It declined, and the reason is a better rule
than the evidence was:**

> ⚠️ **`src/app/ward-management/**` no longer resolving proves THE LAYOUT MOVED. It does not prove
> those plans' 555 unchecked tasks were COMPLETED rather than abandoned, deferred, or silently
> dropped — and a banner asserts the first.**
>
> **The paths and the tasks are two different facts, and only one of them I measured.**

**This is the most seductive error in the document, because everything about it is sound except the
join.** **The measurement was real, reproducible, and specific to the file and line. The inference
from it was a category jump nobody would have noticed in a review** — **the plans DO look finished,
and the evidence IS strong for the claim it actually supports.**

**THE RULE: before offering a measurement as evidence, say out loud which claim it supports and
which claim you WANT it to support. If those are different sentences, you have a gap, however
strong the measurement.**

**And its alternative is better than the banner it refused:** ✅ **the checker's own output IS the
artefact** — nine files, 28 paths, file and line, reproducible by anyone. ⚠️ **Unlike a banner it
CANNOT BE WRONG ABOUT COMPLETION, because it never claims anything about it.** **A record that makes
no claim cannot make a false one.**

## ⚠️ AND THE HANDOVER FILE COULD NOT SOLVE ITS OWN REACHABILITY

**Ward Verifier, on `docs/ward-flow-orchestrator-handover.md`:**

> **That file is on ONE branch, `cat` will not find it, and a fresh session will not know to run
> `git show`. The handover's own reachability is the thing it cannot fix from inside itself.**

**Third time in one night** — a test wrapper on one branch that four chats were told to run, a
safety checklist four chats were told to read, and now the document written to survive this session
dying.

✅ **FIXED, and the fix had to be OUTSIDE every branch:** a pointer now sits at the top of
`C:/Users/joshs/.claude/worktree-ownership.md`, **which is surfaced to every session at start, in
every worktree, outside git entirely.** **That is the one property the handover could not give
itself.**

> ⚠️ **A document findable only by somebody who already knows it exists is not reachable.** **The
> test is not "is it written down" but "what does a session that has never heard of it see first".**

## Two more from the same hour, both Ward Verifier's

**ITS WRAPPER HAD THE COVERAGE PROBLEM TOO, AND IT RESOLVES DIFFERENTLY** — **84 discovered, 6
excluded, and the 6 are CORRECTLY excluded: `tests/ui-ward-*.spec.ts` are Playwright journeys vitest
cannot run.** ⚠️ **A different runner, not a hole. My 70 missing documents were genuinely in scope;
its 6 never were.** **But the tool said nothing either way, and *"files handed in: 84"* reads as
*"the ward suite"* to anybody who has not counted.** **The boundary is now printed on every run with
its reason.**

**AND THE SUBSTRING TRAP CAUGHT IT INSIDE THE MEASUREMENT OF ITS OWN GAP:** grepping `ward` across
test files returned `tests/forward-codify-retrieval-targets.test.ts`. ⚠️ **The honest report is 84 of
90, not 84 of 91 — and it had 91 in front of it first.** **Same fragment, two sessions, two
measurements, one evening.**

## ⚠️ FEWER LAYERS BEATS CLEVERER ESCAPING

**Ward Verifier lost THREE edits getting one change in: one refused on a bad anchor, one wrote a real
newline inside a template literal and broke the file, and one — `node /tmp/fix2.mjs` — EXITED 45,
PRINTED NOTHING, AND LEFT THE FILE UNTOUCHED.**

**Second time in one evening it has seen a command produce no output, no error and no change.**
⚠️ **That is not a coincidence of style; it is what this machine is doing tonight.** **The edit that
finally worked had NO NESTED QUOTING IN IT AT ALL.**

**THE RULE, for as long as the machine is like this: prefer the form with fewer layers.** A
scratchpad file run directly beats a heredoc; a heredoc beats a nested quoted one-liner. **And
re-read the file rather than the exit line.**

---

## P. ⚠️ AN OBSERVATION PINS A SHA. A POINTER MUST NOT.

**These two rules look like the same rule and they are opposites. Getting them the wrong way round
breaks whichever one you apply.**

| | What it is | What it must name | Why |
| --- | --- | --- | --- |
| **An OBSERVATION** | a claim about a moment | ✅ **a SHA, and its BRANCH** | *"48 open movements"* is only true somewhere. Without both, it misleads — twice tonight |
| **A POINTER** | a way to FIND something | ⚠️ **a BRANCH, never a SHA** | It has to still work after the thing it points at has moved on |

**Caught by Ward Verifier while checking the handover pointer.** **I told it the handover was at
`9fed2e0ba`; the branch was already at `01df4e7fc` by the time it read the message.** ⚠️ **Minutes.**

> ✅ **The registry block works because it cites `claude/Wardquestions:docs/...`, a ref that TRACKS.**
> ⚠️ **Had it carried the SHA — as the observation rule would seem to demand — it would have been
> WRONG BEFORE IT WAS FIRST READ.**

**THE RULE: a pointer that must survive your death names something that MOVES WITH THE WORK.** **And
this is written down precisely so a later session does not "improve" the registry block by pinning
the commit, which would look like applying the observation rule correctly.**

**Verified rather than assumed, by a session that is not me:**

```
git show claude/Wardquestions:docs/ward-flow-orchestrator-handover.md   93 lines, resolves
ls docs/ward-flow-orchestrator-handover.md                              No such file  <- correct
registry block                                                          line 21, ~15 lines
```

⚠️ **The local `ls` genuinely fails from inside that worktree, so the warning about `cat` is not
theoretical.** **And the size was checked because that registry is injected into EVERY session's
context — growth there is paid by everybody, which is a cost worth checking before adding to it and
not after.**

---

## Q. ⚠️ A SAFETY BRIEF THAT QUOTES A FORBIDDEN COMMAND IS REFUSED BY THE GUARD

**Ward Referrals lost a turn writing a brief that WARNED AGAINST certain commands — and was blocked,
because the protection hook matches command TEXT, not intent.**

> ⚠️ **The document explaining why not to do a thing contains the thing. The guard cannot tell a
> warning from an attempt, and it must not try.**

**THE RULE: describe the prohibition; never paste the command.** *"Never stash — the stack is shared
across every worktree"* passes. **The same sentence with the command in it does not.**

**Why the guard is right to be this blunt, and must not be softened:** ⚠️ **a hook that tried to
distinguish a warning from an attempt would be a refusal that is SOMETIMES WRONG — and this document
already records what that costs: it destroys the one property a refusal has, that when it fires it
is right.** **Losing a turn is the cheap side of that trade.**

**This survives the machine condition and the fewer-layers rule in an odd direction:** the fix is the
same shape — **write the file through a scratchpad script and a `-F` message file rather than putting
the text on a command line**, so a document ABOUT dangerous commands never has to travel AS one.

## ⚠️ AND THE SEED-DEFAULT CLASS WOULD NOT HAVE BEEN CAUGHT ON THE NEXT SCREEN EITHER

**Ward Referrals, on the ED hub it starts next:**

> **It is a wait per row, sorted by pressure — nothing BUT durations against a clock.** **And my
> fixture's longest wait is about sixteen hours, so NOTHING ON SCREEN IS OLD ENOUGH TO LOOK ABSURD.**
> **Every inflated figure would have rendered as a plausible number in a plausible order.**

⚠️ **That is the third session to say it would not have caught this class, each about a different
screen.** **The defect is invisible not because people are inattentive but because THE FIXTURE'S RANGE
IS TOO NARROW FOR THE ERROR TO LOOK WRONG** — a sixteen-hour wait inflated by a couple of hours is
still a believable sixteen-to-eighteen-hour wait.

**THE RULE it is carrying into the hub, and it is the right one: check which CLOCK and which DATA, at
every call site, BEFORE it renders a duration.**

**A corollary for fixtures generally: a fixture whose values all sit in the plausible middle cannot
show you an arithmetic error.** **The out-of-area board was caught only because a canary asserted
that live and frozen readings DIFFER — not because a number looked wrong.**

---

## R. ⚠️ A LOOSE IDEMPOTENCY GUARD REPORTS "ALREADY DONE" FOR WORK THAT NEVER HAPPENED

**Caught in the act, on my own edit, minutes after writing section Q.**

**Every edit script tonight has carried a guard of the form `assert MARKER not in s, "already
applied"` — so re-running it is safe.** ⚠️ **I chose `"RE-MEASURE"` as the marker for a new block in
the task ledger. That string already appeared TWICE in that file, in two unrelated lines written
hours earlier.**

```
line 208   ### RE-MEASURED AT `1fcca3498` -- FIVE OF THE NINE WERE STALE OR WRONG
line 229   > every relayed finding carries the SHA it was measured at, and is RE-MEASURED before it
```

**The script refused, said `already applied`, and the edit had never happened.**

> ⚠️ **AND "ALREADY APPLIED" IS A REASSURING MESSAGE.** **A plain failure makes you look; an
> idempotency guard firing reads as the guard WORKING.** **I nearly moved on — the only reason I did
> not is that the assertion printed at all, and I happened to check the distinctive string
> afterwards.**

**Same family as `ward` matching `forward`, and as `grep -c` counting a comment rather than a
definition: A SUBSTRING CHOSEN FOR CONVENIENCE MATCHES SOMETHING YOU DID NOT MEAN.** ⚠️ **Here it
does it in the one direction that looks like success.**

**THE RULE, two halves:**

1. **An idempotency marker must be a string that exists ONLY in the block being inserted.** **Take
   it from the new text, and prefer a distinctive phrase over a keyword.**
2. ⚠️ **VERIFY THE WRITE AFTER IT, NOT THE INTENTION BEFORE IT.** **Re-read the file and assert the
   marker is now present.** **That single line turns a silent no-op into a loud one, and it costs
   nothing.**

**Third distinct way a write has silently not happened tonight** — a fork killed at
`STATUS_COMMITMENT_LIMIT`, a heredoc that swallowed its own fallback, and now a guard that refused
its own edit. ⚠️ **All three end with a clean tree and a session that believes it is finished.**

---

## S. ⚠️ A PERMISSION CHANGE IS NOT FINISHED WHEN THE MODEL IS

**`TR-D6` says a transport may be cancelled by the team that BOOKED it and by the COORDINATOR, and
that the receiving ward may NOT. The reducer had the EXACT INVERSE** — it permitted a `ward` caller
**only** when its unit matched `movement.acceptedUnitId`, **the one party the ruling excludes**, and
refused every other ward.

⚠️ **AND `ward-screen.tsx` DISPATCHED THAT EVENT AS ROLE `"ward"`.** **Landing the model fix alone
would have left a live button that does nothing, silently: the form closes, the reason clears, the
transport is untouched.**

> ⚠️ **THE BLAST RADIUS OF A ROLE-TABLE EDIT IS EVERY SCREEN THAT DISPATCHES THAT EVENT** — **and a
> role gate refuses BEFORE it inspects the payload, so the failure mode is a control that looks
> completely normal and does nothing at all.**

**THE CHECK IS TEN SECONDS: `grep` the event type across `src/**/*.tsx` before landing any change to
who may raise it.**

**The screen also carried its own written rule four lines from the code** — *"each control renders
ONLY when the reducer would accept it — never dispatched optimistically and left for the reducer to
refuse silently."* **Leaving the button would have broken the screen's OWN stated contract, not
merely good practice.**

### ⚠️ A TYPE-ONLY REQUIREMENT IS ALREADY OPTIONAL

**`reason` was declared REQUIRED on the cancel event. A caller omitting it wrote `reason: undefined`
into the unwind record, and the suite was green** — **because `vitest run` involves no `tsc` at all.**

> **`TR-D6` says the requirement must not be weakened to optional. AN UNENFORCED REQUIREMENT ALREADY
> IS.** **Now checked by membership at runtime.**

⚠️ **This is the same shape as every other item in this document: the guarantee existed, was
correct, and was never executed.** **A type is a claim about a program that a test run does not
evaluate.**

### ⚠️ A TEST THAT CANNOT TELL "REMOVED" FROM "NEVER THERE" PROVES NOTHING

**Ward Core's first screen test PASSED BEFORE THE CHANGE EXISTED.** **It rendered `rph-adult-secure`,
whose only transported patient has ALREADY BEEN COLLECTED — so the cancel control was absent for
reasons with nothing to do with the ruling.**

**Moved to `fre-adult-open`, and given a canary that asserts FROM THE MODEL that the ward genuinely
holds a cancellable transport.**

> ⚠️ **Identical in shape to a citation checker printing `0 SHAs, 0 unresolved` and exiting 0: an
> empty precondition and a satisfied assertion look the same from the outside.** **The fix is the
> same both times — assert that the thing you are testing the removal of was PRESENT to begin with.**

### ✅ AND THE OWNERSHIP EXCEPTION WAS HANDLED CORRECTLY, which is worth recording as a pattern

**`ward-screen.tsx` is Ward Board's presentation surface and Ward Board is PAUSED. Ward Core edited
it anyway.** **That was right, and these are the four things that made it right:**

1. **The alternative was worse** — a silent dead control, deliberately introduced.
2. **It was MINIMAL** — the control removed, a note in its place; no restyling, no adjacent tidying.
3. **It was ANNOUNCED IMMEDIATELY**, to the coordinator, rather than left for the owner to discover.
4. **The wording was explicitly HANDED BACK**: *"Board should feel free to reword or re-place that
   note; the wording is presentation and is Board's. What must not come back is the button."*

5. ⚠️ **SAY WHICH BRANCH THE EDIT IS ON**, because the paused owner's action depends on it.

**The fifth is Ward Board's, added after I got it wrong.** I told it *"your surface was edited"* —
**true of the CODEBASE and false of its CHECKOUT:**

```
git branch -a --contains 64c434355           ->  claude/ward-flow-phases-6-7-design only
git merge-base --is-ancestor 64c434355 HEAD  ->  no
```

> ⚠️ ***"Your file changed"* tells a session to READ A DIFF. What it actually needed was **"MERGE
> BEFORE TOUCHING THE TRANSPORT CARD"*** — **the cancel block sits beside the accepted-transport card
> it would be reworking, so restarting and editing that region before merging writes against the old
> shape and collides in the exact lines that were just rewritten.**

⚠️ **THIRD TIME the branch dimension has bitten this project in one night, and the third victim was
me twice.** **A statement about a file is not complete without the branch it is true on** — and here
the missing branch did not merely mislead, **it produced the WRONG INSTRUCTION.**

⚠️ **A pause is not a lock, and an owner who cannot be reached does not make a defect somebody
else's problem. But the exception is only legitimate with all five** — **the fourth keeps it an
exception rather than a transfer, and the fifth makes the notice ACTIONABLE rather than merely
honest.**

### ⚠️ AND THE COMMIT WAS NOT PRETTIER-CLEAN, which eslint could never have told anybody

**`64c434355` left two surplus blank lines where the removed handlers had been.** **Ward Board proved
it with a CONTROL** — its own branch's version of the same file, same temp path, same parser, clean;
the other not — **so it is the content and not an artefact of how it checked.**

**The commit message lists eslint clean and typecheck exit 0 AND NEVER MENTIONS PRETTIER.** ⚠️ **That
is section F almost verbatim, committed by a session that had read it.**

> ⚠️ **And the sharp part: ESLINT DID CATCH THE FALLOUT — it named all four orphaned handlers,
> states and imports. THE BLANK LINES THEIR REMOVAL LEFT WENT STRAIGHT THROUGH.** **The dead code and
> the whitespace it leaves are caught by DIFFERENT TOOLS, and only one of them is in the ordinary
> loop.**

**Also worth keeping: Ward Board checked that the `.notice` style class ACTUALLY EXISTS at that
commit rather than assuming.** ⚠️ **A style class that silently does not exist is the section D
failure and it looks perfect in a diff.**

**And it deliberately did NOT reword the note it had been handed:** ***"changing it to demonstrate
that I own it would be worse than useless."*** **Ownership exercised by leaving something alone is
still ownership.**

**The note names BOTH permitted parties, not just the coordinator** — **because a ward told only
about the coordinator will ring the coordinator when the sending department is the faster route.**

---

## T. ⚠️ THE SENTENCE RIGHT AFTER A CORRECTION IS THE ONE NOBODY RE-CHECKS

**I accepted a correction about a branch, wrote it up carefully as the fifth condition of a pattern
— and in the SAME MESSAGE wrote *"everything else on your five surfaces is unaffected."***

**It was false. Measured by Ward Board:**

```
git log HEAD..claude/ward-flow-phases-6-7-design -- ward-management-network.tsx
  e6234a059  The numbered stage cells do what their numbering promises
  9daa1e419  The strip above the queue counts the same people the queue does
```

**+95 lines of component, +86 of CSS, and the reverse direction empty — purely behind, not
divergent.** **FOURTEEN files under `ward-management/` differ, including `ward-model.ts` (+49),
`ward-flow-reducer.ts` (+66), `ward-derivations.ts` (+50) and two new `patients/` files.**

> ⚠️ **FOURTH instance of one failure in one night, three of them mine** — and this one wearing a
> different coat: not a bare claim without its branch, but **a GENERALISATION attached to a
> correction.**

### Why it survived, which is the transferable half — Ward Board's diagnosis, not mine

> ⚠️ **The sentence right after a correction is the one nobody re-checks, because attention is on
> the thing just fixed. The correction was SPECIFIC and the all-clear beside it was a GENERALISATION
> — and the generalisation was the false half.**

**And why it was the RIGHT thing to check:**

> ⚠️ **AN ALL-CLEAR LICENSES ACTION RATHER THAN DESCRIBING STATE.** **It is higher-stakes than the
> fact it accompanies, and it arrived immediately after a correction on the same axis.**

**THE RULE: after correcting yourself, re-read what you wrote NEXT.** **A correction buys credibility
that the sentence after it spends.** ⚠️ **And be most suspicious of the sentence that TELLS SOMEBODY
IT IS SAFE TO PROCEED** — a wrong fact misleads, **a wrong all-clear authorises.**

### The corrected instruction is simpler than the one it replaces

**Not *"merge before touching the transport card"*. ✅ MERGE BEFORE TOUCHING ANYTHING.**

**Two of five are behind, and with the model, the reducer and the derivations all moved, ANY of the
five could be reading a model that changed underneath it** — ⚠️ **which is this evening's clock-and-
data failure in another form: the surface stayed still and what it reads moved.**

> **One merge beats auditing five files for whether each is safe in isolation.** ⚠️ **A per-file
> all-clear is exactly the artefact that has been wrong twice tonight; a merge needs no such claim.**

### A pattern to look at, deliberately NOT a finding

**`9daa1e419` — *"the strip above the queue counts the same people the queue does"* — is a
two-panels-disagreeing fix on the NETWORK page. This evening's ED-panel defect was the same class on
the COORDINATOR page.**

⚠️ **Two independent instances on two screens in one evening is a pattern, not a coincidence.**
**Worth asking whether anything else on those pages derives a COUNT separately from the LIST beside
it.**

✅ **Ward Board raised it having read the commit SUBJECT and nothing else, and said so** — **refusing
to audit a surface on the strength of a one-line summary while paused.** **That is the calibration
rule applied to a suspicion rather than to a result, which is the harder case.**

---

## U. ⚠️ A CHECK THAT COUNTS A TERM INSIDE ITS OWN RETRACTION — twice, two sessions, one evening

**I wrote a guard asserting the superseded spec SHA no longer appears in the ledger. It fired.** ⚠️
**The only occurrence was inside the paragraph RETRACTING it, where it must appear** — a correction
has to name what it corrects.

**Ward Core wrote the same guard the same evening, and said so before I found mine.**

> ⚠️ **A retraction contains the thing it retracts. A guard that greps for the term cannot tell the
> warning from the mistake** — **exactly like the protection hook that refuses a safety brief quoting
> a forbidden command.**

**THE RULE: a staleness guard must exclude the retraction, or check the CONTEXT rather than the
token.** **In practice: assert the term does not appear WITHOUT the word *superseded* near it, or
scope the check to the sections a reader would follow rather than the whole file.**

## ⚠️ AND THE SHARPEST VERSION OF TONIGHT, FROM WARD CORE

**It set out to fix the formatting defect Ward Board had measured. Its first check extracted the blob
to a temp path and ran `prettier --check --parser typescript` on it. THE FILE REPORTED DIRTY.**

⚠️ **It was ONE COMMAND from "fixing" something that had already been fixed two commits earlier** —
**on the strength of a check that had forced the wrong parser onto a `.tsx` file at a path the
repository config does not govern.** **The real check — real path, repo config, no forced parser —
says clean.**

> ✅ **"A confident, well-formed answer to a question I had not actually asked."**

**That sentence is the whole night in nine words, and it covers every entry in this document:** a
citation checker reporting `0 SHAs, 0 unresolved` over an empty scan; a `grep -c` counting a comment
rather than a definition; `ward` matching `forward`; a test rendering a ward whose patient had already
been collected; an idempotency guard matching text written hours earlier; and this.

⚠️ **AND THE IRONY IS LOAD-BEARING RATHER THAN DECORATIVE: Ward Board had warned about a temp-path
control TWENTY MINUTES EARLIER, and Ward Core walked into it anyway.** **Which is the same finding as
section M — a correct rule, recently read, does not fire at the moment of use.**

## ⚠️ AN OBSERVATION CARRIES ITS COMMIT AS WELL AS ITS BRANCH

**Ward Board's formatting measurement was CORRECT for `64c434355` and STALE by the time it reached
Ward Core** — fixed at `7a9a85948`, two commits later.

**Nothing went wrong. Board used a control, named the exact diff, and did not touch another session's
file.** ⚠️ **The information simply AGED IN FLIGHT, and on this project that takes about twenty
minutes.**

**So the rule has a third component: an observation carries its SHA, its BRANCH, and — on a project
moving this fast — the awareness that a message crossing between sessions may arrive after its
subject has changed.** ⚠️ **Which is precisely why the receiving session re-measures rather than
acting, and why every session doing that tonight was right to.**

## V. ⚠️ A NAMED SOURCE FOR EVIDENCE NOBODY GATHERED IS WORSE THAN A BLANK

**Ward Board found that the ledger's most load-bearing phase 1 task rested on a claim with no list
under it. It was worse than that.** ⚠️ **The record NAMED A SOURCE — Ward Verifier — and I sent
Ward Board to collect from it. Verifier had never assessed those surfaces.**

> **"My record does not hold the list because the list was never made. This session walked three
> screens tonight — the coordinator hub, the ED screen, and governance — and none of them is the
> ward page."**

⚠️ **AND THE COST IS NOT THE WASTED ERRAND, WHICH IS WHY THIS IS ITS OWN CLASS.** Verifier's words:

> ⚠️ **"If the ledger says I assessed those surfaces, then my FIRST look at them will be received as
> an independent SECOND look."**

**A missing citation FAILS TO SUPPLY evidence. A false attribution MANUFACTURES CORROBORATION THAT
WAS NEVER PERFORMED** — and then consumes the one genuine check still available, by disguising it as
a repeat of a check that never happened.

✅ **A blank space is VISIBLY blank. That is the entire advantage it has, and it is a large one.**

### ⚠️ THE SECOND PLACE IT WAS LOAD-BEARING, WHICH I HAD NOT CONNECTED TO IT

**The same false premise — *"it ASSESSED all seven surfaces"* — was carrying the whole
assessor/builder separation: Verifier does not build, because it assessed.** ⚠️ **Correcting the
premise appears to dissolve the rule.**

> ⚠️ **"IT DID NOT ASSESS THEM, SO IT MAY BUILD THEM" IS THE NATURAL READING OF THE CORRECTION AND IT
> IS WRONG.** **It trades the only instrument that found the frozen board, the queue miscount, the
> stale refusal register and the header claiming to know the date, for an extra pair of hands.**

✅ **THE FIX IS NOT TO SOFTEN THE CORRECTION. It is to state the rule on its real basis, which
Verifier supplied while correcting me and which is BETTER than what I had written: the separation
binds PER SURFACE, on the surfaces actually walked.** **It assessed governance, so the governance fix
is not its to build. No claim about seven is needed, and the rule now cannot be dissolved by
correcting a count.**

> ⚠️ **WHEN YOU RETRACT A PREMISE, FIND WHAT ELSE WAS STANDING ON IT BEFORE YOU PUBLISH THE
> RETRACTION** — **and if a rule falls with it, the rule needed a better basis, not a protected
> premise.**

### ✅ AND THE HARDEST DIRECTION TO SPEAK IN

**Verifier volunteered that the median fix was not its to build BEFORE anyone assigned it** —
declining work on the grounds that taking it would compromise its own value as a check.

⚠️ **Nobody would have noticed if it had simply built the fix.** **It is the assessor, it found the
defect, it knows the file. The moment an assessor becomes a builder is invisible from outside and,
by its own account, invisible from inside too.**

## W. ⚠️ THE CLIENT DOM IS NOT THE APP — and the false positive it produces is the expensive kind

**Ward Verifier had a serious defect half-written and killed it before sending. Its numbers were all
correct.**

```
in the browser pane   ward-ed-screen x2, 80 duplicated data-testids, 162 testid nodes,
                      one copy inside a classless display:none div
in the server HTML    data-testid="ward-ed-screen" appears ONCE in 87,207 bytes
```

⚠️ **The consequence it was about to file is real IF the duplication is real, and it is this
project's exact theme: a Playwright selector resolving to two nodes either fails strict mode or
SILENTLY ASSERTS AGAINST THE HIDDEN COPY** — **a test passing against an invisible subtree while the
visible screen is broken.** `ui-ward-roles.spec.ts` calls `getByTestId("ward-ed-screen")` **twelve
times**.

✅ **What killed it: fetching the route's raw HTML instead of counting nodes in the pane.** **Measure
the thing, not the proxy** — ⚠️ **and note WHY this one was hard: the client DOM genuinely IS the app
in almost every other context, which is what made it read as authoritative.** **The pane's own
instrumentation and Fast Refresh are not the app.**

> ⚠️ **NOBODY REVIEWING THE DRAFT WOULD HAVE CAUGHT IT, because every number in it was correct.**
> **It cost four rounds of investigation — the real price of a plausible false positive is paid by
> the person who finds it, and again by everyone who believes it.**

**STANDING RULE FOR BROWSER WORK IN THIS PANE: a duplicate-node finding is UNPROVEN until checked
against the server HTML.**

### ⚠️ AND I PRODUCED THE SAME SHAPE FROM A DIFFERENT DIRECTION, WITHIN THE HOUR

**Checking Verifier's retraction offline, I found `data-testid="ward-ed-screen"` written TWICE in the
SOURCE** — `ed-screen.tsx:295` and `:404` — **and began writing it up as a latent hazard: uniqueness
that holds today by which branch renders, and breaks the twelve strict-mode selectors the day both
do.**

✅ **It dissolves on reading the control flow.** **Line 295 sits inside `if (!department) return
(…)`, so the two are UNCONDITIONALLY exclusive.** **An early return is a guarantee, not a
coincidence — there is no state that renders both.**

> ⚠️ **MY COUNT WAS CORRECT AND MY INFERENCE WAS WRONG.** **Two writes of an id is the right thing to
> notice and the wrong thing to conclude from; the property that matters is not how many times it is
> WRITTEN but whether two can RENDER.** ✅ **Same lesson as Verifier's, reached from the opposite
> end: the grep count was the proxy, the control flow was the thing.**

**Two instances in one hour, two sessions, both starting from a correct number. That is the shape to
watch for, not the specific screen.**

### ⚠️ HOW THIS RULE WILL DECAY, NAMED IN ADVANCE BY THE SESSION THAT FOUND IT

**Ward Verifier endorsed the boundary above and then said the more useful thing — where it will
break:**

> ⚠️ **"The tempting shortcut a month from now will be to remember tonight as *'duplicates in that
> pane are always fake'*."**

**The rule is *unproven until checked against server HTML*. The anecdote compresses to *fake*.**
⚠️ **A correctly-stated rule and its memorable story decay in DIFFERENT directions, and the story
wins, because the story is what gets retold.**

> ✅ **IF A FUTURE DUPLICATE SURVIVES THE SERVER CHECK, IT IS REAL.** **Written here in that form so
> the sentence a later session finds is the one that keeps the check alive rather than the one that
> retires it.**

## X. ✅ A SCOPE QUESTION GIT CAN NARROW AND CANNOT SETTLE — decided, and recorded as a decision

**`coordinator/shortlist-panel.tsx` carries the second bare-digit urgency picker. I asked rather
than assigned. Ward Verifier answered with evidence and refused to close the gap by inference:**

```
directory says   coordinator/
history says     referral -- four consecutive referral-shaped commits, verified:
                 df96f26e1  An ED referral says which department, and why
                 5cdcd3c25  An override is kept, and the ward it was made against can read it
                 0e3c7691a  A decline gives a reason and nothing else
                 8874d0c07  referral board and match view (Phase 7 Task 5)
branch says      nothing -- newest commit 8fa5bcaa3 is contained in ALL THREE live branches
```

⚠️ **Two facts pointing opposite ways, and NEITHER IS AUTHORITY.** **Whether a coordinator's
shortlist falls inside "the whole referral surface" is a SCOPE question about the owner's
instruction, not a fact git holds.**

✅ **DECIDED, by me, and routed WITH the ED picker to Ward Referrals** — **Ward Verifier's reasoning
and I agree: they are the same defect in the same idiom, and splitting them across two chats risks a
FIFTH copy of the bare `{option}` being written while both wait.** **The merge cost is zero either
way, because nobody has diverged on the file.**

> ⚠️ **RECORDED AS A DECISION, NOT AS SOMETHING GIT ESTABLISHED.** **The evidence narrowed it; a
> judgement closed it; the owner can reverse it at no cost.** ✅ **That distinction is the whole
> point — the failure would have been reporting "git shows it is referral surface", which git does
> not show.**

## Y. ⚠️ NO SINGLE INSTRUMENT WAS SUFFICIENT, AND THE CHEAPEST ONE WAS THE MOST COMPLETE

**Three sessions looked for the same defect with three instruments. Ward Verifier's summary, and it
is the closing lesson of the whole thread:**

```
an import-graph inference (mine)     found NEITHER reliably
                                     -- cannot distinguish a file with one picker from one with two
a source-level search (Referrals)    found TWO
                                     -- grepped for a data-testid the third picker does not have
a live walk of the screen (Verifier)  found the one that MATTERED MOST
                                     -- by filling the form; the bare 1 2 3 was simply in front of it
```

> ✅ **"No single instrument was sufficient and the cheapest one was the most complete."**

⚠️ **NOTE WHAT THE TWO CODE-SIDE INSTRUMENTS HAVE IN COMMON: both answered a question ADJACENT to
the one asked, and both returned a clean plausible number with no error.** **An import graph answers
*which files reference the helper*. A testid search answers *which controls are labelled*. Neither
answers *how many pickers show a bare digit*, and neither says so.**

✅ **THE LIVE WALK HAS NO SUCH GAP because it is not a proxy at all** — **the thing being asked
about is the thing in front of it.** ⚠️ **It is also the instrument least often reached for,
because it is slow, manual, and produces no artefact anybody can re-run.**

**THE RULE: for any question of the form "what does a user see", the screen is not one instrument
among several. It is the only one that is not a substitution.** **Reach for it FIRST on that class
of question, and use the code-side instruments to establish scope AFTER the screen has established
existence.**

### ✅ AND THE CREDIT CORRECTION IS PART OF THE LESSON, NOT A FOOTNOTE

**Ward Verifier declined credit for "finding the third picker":**

> **"I did not find it by counting anything. I filled the form to check whether the values
> round-tripped, and the bare `1 2 3` was simply in front of me. The instrument was walking the
> screen, not any judgement of mine."**

✅ **It also declined to let my failed inference be read as a lapse: an import-graph inference COULD
NOT have distinguished one picker from two, so that is a limit of the instrument rather than a
mistake by its user.**

⚠️ **BOTH HALVES MATTER FOR NEXT TIME.** **If the win is credited to a person's judgement, the
lesson is "be more careful". If it is credited to the INSTRUMENT, the lesson is "walk the screen"**
— **and only the second one is repeatable by somebody who is already being careful.**

## Z. ⚠️ THE BOUNDARY MUST BE AS EXPLICIT AS THE MOTIVE — and the better the motive, the further past it a good implementer will go

**Ward Referrals briefed an implementer on the urgency labels. The brief named `urgency: 3` as part
of the STAKES — *"the default is already 3, and 3 sorts the sickest patient to the bottom"* — and
never said "leave it alone".**

> ⚠️ **"I SUPPLIED THE MOTIVE AND OMITTED THE BOUNDARY."**

**A fresh implementer reading that has every reason to change the default as part of the same
repair.** ⚠️ **And it would have been RIGHT to, on the brief as written — the failure is upstream
of the implementer entirely.**

> ⚠️ **"THE BETTER THE MOTIVE, THE FURTHER PAST THE BOUNDARY A GOOD IMPLEMENTER WILL REASONABLY
> GO."** ✅ **Which inverts the usual instinct: a brief that explains WHY is not automatically
> safer than one that does not — it is more persuasive, and persuasion travels past the scope
> line.**

**THE RULE: every brief that explains why something matters states, in the same breath, what must
NOT change because of it.** **Not as a caution — as a named list.**

### ⚠️ TWO SHAPES OF THE SAME TRAP, AND THE SECOND IS THE DANGEROUS ONE

```
default 3 -> 1        a WRONG change wearing a safety fix's clothes    <- an error to catch
display urgency       a RIGHT change wearing the wrong commit's clothes <- nothing to catch
```

⚠️ **BOTH arrive on the momentum of a genuine finding. The second is more dangerous precisely
because refusing it FEELS LIKE REFUSING TO FIX A REAL DEFECT** — **there is no error for a reviewer
to spot, only a scope boundary that nothing enforces, and every reviewer nodding along because the
change is good.**

✅ **A design decision made inside a labelling commit is a design decision MADE BY NOBODY.**

### ✅ THE SENTENCE THAT MADE THE DEFECT LEGIBLE

**On the ED card the change button carries `ward-change-urgency-toggle-{id}`, and `movement.urgency`
appears once in the entire file — as an argument, never as a rendered value.**

> ✅ **THE ADDRESSABLE THING IS THE ACTION. THE UNADDRESSABLE THING IS THE TRUTH.**

⚠️ **So no test can ever assert the urgency appeared, because it never appears — the absence is
not merely untested, it is UNTESTABLE.** **A missing element cannot fail a test; it can only fail a
person looking at the screen.** **That is why a green suite sat over it indefinitely, and it is the
cleanest statement this project has produced of its own governing failure mode.**

## AA. ⛔ A FAILED WRITE DESTROYED A FILE, BECAUSE OPEN-FOR-WRITE TRUNCATES BEFORE IT WRITES

**A script appended a section to `ward-flow-coordination-rules.md`. One character in the new text
was an invalid surrogate escape, so the encode threw.**

```
io.open(path, "w", ...)   <- TRUNCATES THE FILE TO ZERO IMMEDIATELY
    .write(text)          <- throws here, having written nothing

result: 61,285 bytes -> 0 bytes.  1,101 lines gone from the working tree.
```

⚠️ **THE VALIDATION THAT WOULD HAVE CAUGHT THE BAD CHARACTER RAN AFTER THE FILE WAS ALREADY
EMPTY.** **The script's own `assert ... in read()` guard never executed, and its purpose was exactly
to prove the write landed.**

> ✅ **NOTHING WAS LOST, AND THE ONLY REASON IS THE COMMIT-EARLY DISCIPLINE.** The file was committed
> at `ac2e31cb5` minutes before. `git checkout HEAD -- <path>` restored it, **verified by hash rather
> than by eye**: `9d1731f43969ff7c90dbca4d9d51195a06b0d0e9` on disk and in `HEAD`.

**THE FIX IS TWO LINES AND IT IS MECHANICAL: encode FIRST, then replace.**

```python
data = text.encode("utf-8")      # any encoding error throws HERE, touching nothing
with open(path + ".tmp", "wb") as f:
    f.write(data)
os.replace(path + ".tmp", path)  # atomic
```

### ⚠️ WHY THIS BELONGS IN A SAFETY CHECKLIST AND NOT A STYLE GUIDE

**Every ward document is edited by exactly this pattern — a scratchpad script that reads, splices
and writes back.** ⚠️ **Any one of them, on any bad character, silently empties a document whose
only other copy is an uncommitted working tree.**

> ⚠️ **AND THE FAILURE IS SILENT IN THE DIRECTION THAT MATTERS: an empty file still opens, still
> greps clean, and still passes any check that looks for the ABSENCE of something.** **The citation
> checker would have reported one fewer document scanned and nothing else.**

✅ **Commit before every scripted edit. Verify a restore by hash. Never `open(path, "w")` on a
document this project cannot rebuild.**

### ⚠️ THE SHARPER STATEMENT OF IT, FROM WARD REFERRALS

> ⚠️ **"A VERIFICATION STEP DOWNSTREAM OF THE DESTRUCTIVE STEP IS NOT A VERIFICATION STEP."**

**The script's own `assert ... in read()` existed precisely to prove the write had landed. It could
not run, because opening for writing had already emptied the file.** ✅ **Same shape as proving a
mutation was restored by reading the file you just wrote** — **the check and the damage share a
cause, so the check cannot see it.**

**And its placement of this in the night's sequence is right:**

> ⚠️ **"It is the flat allowlist that inspected nothing, the anchor that matched no block, and the
> guard whose fixture never produced its case — one more way for absence to read as pass. And this
> one is the purest: A FILE WITH NOTHING IN IT SATISFIES EVERY 'X IS NOT PRESENT' CHECK
> PERFECTLY."**

### ⚠️ AND ITS OWN EXPOSURE WAS AVOIDED BY ACCIDENT, WHICH IS NOT A MITIGATION

**Ward Referrals is less exposed only because its document edits go through an atomic
string-replacement tool rather than read-splice-write.** ⚠️ **But it reached for a bash heredoc
earlier tonight and was refused FOR AN UNRELATED REASON.** **Its own verdict: *"the safe path was
luck, not design."***

✅ **It checked its five files on the warning rather than assuming, and all are intact** — including
`ward-flow-catchment-data.md` at 123,466 bytes, **537 suburb rows transcribed from five documents,
which existed on ONE never-pushed branch until the fold a few hours ago.**

> ⚠️ **THAT IS THE FILE THIS INCIDENT WAS AIMED AT AND MISSED.** **Nothing about tonight's near-miss
> makes the next one land somewhere recoverable.**

## AB. ⚠️ A DEFERRAL JUSTIFIED BY A SAFETY NET THAT WAS NEVER THERE

**`ward-priority.ts`'s docblock recorded the decision to defer the three bare pickers, and said the
four surfaces "carry their own pinned tests". THEY DID NOT.**

```
tests referencing `ward-change-urgency`   0
coverage on both change pickers           NONE, before the fix
```

⚠️ **So the deferral was not a judgement about risk. It was a judgement about risk MADE AGAINST A
FACT THAT WAS FALSE** — and it read as careful, because naming the safety net is what a careful
deferral looks like.

> ⚠️ **AND NOTHING COULD EVER HAVE REPORTED IT, BECAUSE A CONTROL NO TEST NAMES CANNOT FAIL ONE.**

**This is the same shape as the missing card display, arriving from the opposite direction, on the
same field, out of the same docblock:**

```
the missing display   an element that does not exist   -> no test can assert it appeared
the missing tests     a control nothing references     -> no test can report it is unguarded
```

✅ **Both are absences that are not merely untested but UNREPORTABLE.** ⚠️ **Twice on one field, in
one comment, in one night — which is the argument for reading a claim about coverage as a claim to
be CHECKED, exactly like a claim about behaviour.**

**THE RULE: when a deferral cites a mitigation, verify the mitigation exists BEFORE accepting the
deferral.** **A named safety net is the most persuasive part of a deferral and the least often
looked at.**

### ✅ HOW THE CORRECTION WAS MADE, WHICH IS THE MODEL

**Ward Referrals corrected the docblock itself (`209d6ca1b`) rather than annotating around it, named
BOTH false claims in the body, and KEPT the reason the deferral was worse than it looked rather
than deleting the embarrassing part.** **Verified: the comment now carries *"They did not"* and
*"the deferral rested on a safety net that was never there"* in its own text.**

✅ **It also recorded what remains true — `shortlist-panel.tsx:535` renders `Tier {movement.urgency}`
as a badge, dropping the qualifier, now the only ward surface not reading the helper** — **and left
it deliberately, because a badge has a width, so whether the qualifier fits is a DISPLAY decision
rather than a correctness one, and nobody CHOOSES a value from a badge.**

### ⚠️ AND A QUOTING TRAP THAT HAS NOW COST TWO SESSIONS IN ONE NIGHT

**A PowerShell here-string used inside the Bash tool: an apostrophe ended the string early and
truncated a commit message.** ✅ **The implementer verified the parent and the staged set before
`reset --soft`, then reported the abandoned hash `ee9bcf2e` rather than leaving the short message
and saying nothing.**

⚠️ **The Bash tool is Git Bash, not PowerShell. Use a heredoc.** **Both tonight's occurrences were
a session reaching for the shell it was thinking in rather than the shell it was in.**

## AC. ⚠️ A TRUE COUNT AND A WRONG INFERENCE — the tell, and every instance from one night

**Ward Verifier named the pattern after dissolving two of its own drafts in one sitting:**

> ⚠️ **"I had two plausible defect reports drafted off pattern-matched line numbers, and both
> dissolved on reading the actual block. THE TELL IS IDENTICAL EVERY TIME: I was matching a shape
> instead of reading the thing."**

**Every instance from this one night, enumerated rather than totalled — because the count is not
the point and rounding it up is the error this list is about:**

| The measurement, correct | The inference, wrong | What dissolved it |
| --- | --- | --- |
| `ward-ed-screen` ×2 in the browser pane | a real duplicate breaking 12 strict-mode selectors | the server's raw HTML — one copy |
| the same testid written twice in SOURCE | uniqueness is contingent, a latent hazard | the control flow — `if (!department) return` |
| no urgency testid in `ed-screen.tsx` | "there is no raise-referral picker in this file" | walking the screen — it exists, unlabelled |
| `urgencyTierLabel` ×4 in `ed-screen.tsx` | one picker went unconverted | reading — 1 import, 1 comment, 2 call sites |
| a bare `{option}` at `shortlist-panel.tsx:702` | a fifth missed picker | reading the block — it is LEGAL STATUS, correctly bare |

⚠️ **FIVE. Three sessions. One evening. Every number in every one of them was CORRECT.**

> ✅ **THE TELL IS THE USABLE PART, because a class name is not actionable and a tell is: you are
> matching a shape instead of reading the thing.** ⚠️ **It feels like evidence because it IS
> evidence — of something adjacent.**

**THE RULE: a count is where an investigation STARTS. Nothing may be reported from one until the
thing itself has been read.** ✅ **Note what dissolved each: server HTML, control flow, the screen,
the file, the block. All five were reading. None was a better search.**

### ✅ AND THE STANDARD THAT ALL OF THIS IS MEASURED AGAINST

**Ward Referrals' commit: four mutations, predictions written FIRST, each failing exactly one test,
both sources restored byte-identical by `git hash-object`.** — **the new assertions were shown able
to FAIL before they were trusted, rather than being green on arrival.**

✅ **Ward Verifier's own assessment, volunteered:** *"that is the standard, and it is higher than
what I did on my own commits tonight."* ⚠️ **Recorded because a session marking its own work below a
peer's, unprompted, is the only way that comparison ever gets made.**

### ⛔ INSTANCE SIX, COMMITTED BY ME, INSIDE THE COMMIT THAT RECORDS THE PATTERN

**Immediately after appending the table above I ran a repair script and reported:**

```
escapes repaired: 211
```

⚠️ **NOTHING WAS REPAIRED. The replacement was a no-op, and `211` is the number of em-dashes the
file ALREADY CONTAINED.** **The doubled backslashes in my script were flattened before Python saw
them, so both arguments to `replace()` were the same character** — **and the one genuine literal
escape I had just introduced survived untouched at line 1636.**

> ⚠️ **A TRUE COUNT, REPORTED AS SOMETHING IT WAS NOT — in the paragraph directly beneath a table of
> five earlier instances, written by the session writing the table.**

✅ **What caught it: the number was WRONG-SHAPED. I expected 1 and got 211, and 211 was too large to
be anything I had done.** ⚠️ **Had the file happened to contain one stale escape, the script would
have printed `escapes repaired: 1`, matched my expectation exactly, and the defect would have
shipped.** **The alarm came from arithmetic, not from any check.**

✅ **THE DIFF IS WHAT SETTLED IT, NOT THE SCRIPT'S OWN OUTPUT:** `git diff --stat HEAD~1 HEAD` showed
**39 insertions and ZERO deletions**, which is impossible if 211 pre-existing characters had changed.
**A tool's report of what it did is not evidence of what it did; the repository's record of what
changed is.**

**Repaired with the pattern built from `chr(92)` rather than an escape sequence, so nothing in the
chain can flatten it, and verified by re-reading the file.**

## AD. ⚠️ THE ABSENCES THAT READ AS A PASS — a different list from AC, and the project's whole thesis

**Section AC lists a true count with a wrong inference. THIS list is the other failure and the one
this project exists to catch: something that is not there, and nothing anywhere going red.**

**Enumerated, not totalled** — Ward Referrals said "six times over" and named four; the four are
verified and the total is not, so the four are what is written:

| The absence | Why nothing could report it |
| --- | --- |
| a guard inspecting an arm **no fixture ever produced** | the assertion ran; its case never arrived |
| a field with **no producer** | nothing wrote it, so nothing could find it missing |
| an element **no test could assert** (`movement.urgency`, rendered nowhere) | you cannot assert the presence of a thing that has no element |
| a docblock **promising tests that did not exist** | a control no test names cannot fail one |

✅ **AND ONE MORE FROM TONIGHT, WHICH IS THE PUREST OF ALL: a file truncated to zero bytes still
opens, still greps clean, and satisfies every "X is not present" check perfectly.**

> ⚠️ **EVERY ONE OF THESE ENDS WITH A GREEN RUN AND A SESSION THAT BELIEVES IT HAS FINISHED.**

### ✅ WHY "EVERY CARD" WAS THE SUBSTANCE OF THE OWNER'S RULING, NOT A DETAIL

**The tier could have been shown only on urgent patients. Ward Referrals' reason for rejecting that,
and it is the same thesis applied forward instead of backward:**

> ⚠️ **"If the tier appeared only on urgent patients, ITS ABSENCE BECOMES THE SIGNAL."**

✅ **Same position on every card is the only version where a glance carries information** — **because
the alternative asks a clinician to read a blank space, and this list is five demonstrations that
nobody does.**

### ✅ A RULE ONLY KEPT WHEN IT IS CHEAP IS NOT A RULE — and the inverse

**Ward Referrals declined to build on my relay of the owner's answer, even though the answer was
first-hand to me, minutes old, and unambiguous.** ⚠️ **Its reason is the better half of the rule it
wrote earlier tonight:**

> ✅ **"The community hub was the version where it mattered; this is the version where it costs
> nothing, and A RULE I ONLY KEEP WHEN IT IS EXPENSIVE IS NOT A RULE."**

**It also declined to re-ask him, because the question is already live in its own chat and a second
copy is the error it has made three times tonight.** ✅ **So it told him the ruling reached it
second-hand and that one word turns it on** — **the narrowest possible action, and it blocks nobody
because its implementer is live in that same file regardless.**

### ✅ TWO MORE ABSENCES, VERIFIED BEFORE ADDING — the list grows, the total stays unwritten

**5. A prop accepted and ignored.** `WardFlowProvider` took `initialNow` and read it only as a
`!== undefined` FLAG; the value itself was discarded. **Verified in the file, which now carries its
own record at `ward-flow-provider.tsx:113`:** *"THIS READ `initialNow !== undefined ? 0 : …` UNTIL
2026-08-30 — the prop was accepted and its value thrown away."* ✅ **Repaired at line 124, which now
reads the value.**

> ⚠️ **THE PUREST API-LEVEL FORM OF THE SHAPE: THE CALL SITE LOOKS LIKE CONFIGURATION AND IS
> DECORATION.** **Every caller passed a value that did nothing, and because the values passed
> happened to equal the anchor, nothing was wrong, nothing failed, and nothing could have been.**

**6. A test run over an empty file list, reporting green.** ⚠️ **`vitest` exits 0 with no failures
and a clean summary — a total standing for nothing.** ✅ **Verified: `scripts/run-ward-tests.mjs`
exists BECAUSE of this and refuses it explicitly** — its docblock names *"zero collected tests (a
selector that matches nothing, reported green)"*, and line 59 exits with **"REFUSED: no test files
selected. An empty selection cannot pass."**

> ⚠️ **A GATE THAT RAN NOTHING AND A GATE THAT PASSED EVERYTHING PRODUCE THE SAME OUTPUT.** ✅ **Which
> is why that wrapper always prints BOTH numbers, handed in and ran: "a single number cannot be
> checked."**

### ⛔ AND THE ADMISSION THAT IS WORTH MORE THAN EITHER INSTANCE

> ⛔ **"'Six times over' WAS A NUMBER I NEVER COUNTED. I had four in mind, wrote six because it felt
> like more than four."** — Ward Referrals, unprompted.

**Its own tally of tonight: "eight consumers" that was seven, "five test files" that was
thirty-five, and "six absences" from four.** ⚠️ **All three travelled attached to a claim that WAS
verified** — **and that is the mechanism: the argument had been checked, so the number beside it
inherited the credibility.**

> ⛔ **AND THIS ONE IS WORSE THAN THE OTHER TWO, BECAUSE THE NUMBER WAS THE EVIDENCE.** *"Six times
> over"* was doing the persuasive work in a sentence about how often absences pass unnoticed.
> **A made-up count inside an argument about false confidence is the argument demonstrating
> itself.**

✅ **THE REMEDY IT PROPOSED AND I HAVE ADOPTED: write the instances you verified, and NO TOTAL.**
**A list that grows is stronger than a count that is wrong, and a list is what a reader checks
against their own case anyway.**

⚠️ **A FOURTH, IN THE SAME MESSAGE, AND I AM NAMING IT RATHER THAN LETTING IT PASS:** the same
report described *"~85 call sites across 35 files"* for `initialNow`. **Measured here on
`claude/ward-flow-phases-6-7-design`: 42 files and 109 total occurrences across `src` and `tests`**
— occurrences are not call sites, so the figures are not comparable and neither confirms the other.
✅ **The SUBSTANCE is verified and is what the entry above records. The counts are not, so they are
not written.**

> ⚠️ **It arrived inside the admission about uncounted figures, which is exactly where a number is
> least likely to be checked.**

### ⛔ TWO CORRECTIONS TO THE ENTRY DIRECTLY ABOVE — both mine, one of them the same error it describes

**1. `~85 call sites across 35 files` was RELAYED, not invented.** ⚠️ **Ward Core wrote *"roughly
eighty-five call sites across thirty-five files"*; Ward Referrals passed it through in its own voice,
unmeasured.**

> ⛔ **SO IT IS NOT A FOURTH INSTANCE OF THE SAME MECHANISM. IT IS A SECOND INSTANCE OF A DIFFERENT
> ONE** — **relaying an unmeasured number as your own** — **which Ward Referrals had NAMED AN HOUR
> EARLIER** (*"five test files was my implementer's figure, passed on in my own voice"*) **and then
> did again inside the message admitting to it.**

⛔ **AND MY OWN ERROR IS THE WORSE HALF: I CALLED IT "A FOURTH", WHICH FOLDED A DIFFERENT MECHANISM
INTO A RUNNING TALLY TO MAKE IT ACCUMULATE.** ⚠️ **In the section about counts inflating because the
surrounding argument is sound.** **The list was right; the word "fourth" was the same reflex the
list exists to catch.**

**Both mechanisms belong in the record, separately, because they need different remedies:**

```
inventing a figure   -> count it, or do not write it
relaying a figure    -> attribute it, or measure it
```

⚠️ **A relayed number is the more dangerous of the two, because it arrives already believed and the
relay erases the one thing that would prompt a check: whose number it is.**

**2. Instance 6 was filed as a failure and is a SUCCESS.** ✅ **`run-ward-tests.mjs` was BUILT
against an empty selection reporting green and refuses it by name.** ⚠️ **So Ward Referrals meeting
that refusal was THE CONTROL WORKING, not a gap it discovered.**

> ⚠️ **"I filed a success as a failure because I met it while it was stopping me."**

✅ **The HAZARD stays in this list — a gate that ran nothing and a gate that passed everything
produce the same output. The ENCOUNTER moves to the constructive list, beside the self-invalidating
pins.** **A control is most visible at the moment it blocks you, which is also the moment it is most
easily mistaken for the problem.**

## AE. ⛔ AGREEMENT IS THE CONDITION UNDER WHICH NUMBERS STOP BEING READ

**Every wrong figure tonight passed because the surrounding argument was sound.** ⚠️ **Not one of
them was attached to a claim anybody doubted.**

> ⛔ **THE NUMBER INHERITS THE CREDIBILITY OF THE ARGUMENT IT SITS BESIDE, AND AN ARGUMENT YOU AGREE
> WITH IS ONE YOU HAVE STOPPED CHECKING.**

**This is the sharper form of *check the conclusion that flatters the theme*: the theme does not
have to flatter you.** ⚠️ **It only has to be one you have already accepted** — **and by the time
you are nodding, the figures have become decoration you read past.**

✅ **THE RULE: check figures in the messages you AGREE with, first.** **A number in a claim you
doubt is already going to be checked; a number in a claim you endorse is the one that travels
onward under your name.** ⚠️ **Tonight that is exactly how each of them travelled — through a
session that agreed, into a record, in a new voice, with the attribution gone.**

## AF. ⛔ A MEASUREMENT PINNED INSIDE THE TREE IT MEASURES IS STALE THE MOMENT IT IS WRITTEN

**Ward Core measured `initialNow` properly, corrected its own eyeballed figure, and pinned the exact
counts in a test docblock so the next reader would get a measurement rather than a memory of one.**
✅ **Exactly the right instinct.**

**Then I re-measured and got one more than it did, on both totals, with the file counts matching
exactly. A consistent off-by-one is a mechanism, not an error, so I looked for it:**

```
699cc3586   (before its commit)   initialNow=  ->  85     <- Ward Core's figure, CORRECT when taken
416fb1e48   (its commit)          initialNow=  ->  86     <- mine, CORRECT now
            the commit added exactly ONE line containing `initialNow=`
```

> ⛔ **THAT LINE IS THE DOCBLOCK SENTENCE ITSELF: *"85 `initialNow=` call sites in 38 files"*.**
> **The record of the measurement is COUNTED BY the measurement.**

⚠️ **NEITHER NUMBER IS WRONG. The tree changed, and what changed it was the act of writing the
number down.** ✅ **The file count stayed 38, because that file already contained the token — so the
failure appears on one axis and not the other, which is exactly how it evades a sanity check.**

**WHY IT IS DANGEROUS RATHER THAN CUTE: the discrepancy is ONE.** ⚠️ **A future reader re-running
the grep gets 86, sees 85 pinned, and concludes the count was sloppy** — **when it was exact.**
**A pinned figure that is off by one reads as carelessness; a pinned figure off by fifty reads as a
bug and gets investigated.**

✅ **THE REMEDY IS NOT A BETTER NUMBER. Writing `86` is stable — recording it adds nothing further —
but it is still a figure that any later edit to that file silently invalidates.** **The record must
say that it counts itself**, or the pattern must exclude the file that holds it.

> ⚠️ **GENERAL FORM: any count of a token, pinned in a file that the count would match, is
> self-referential.** **The same applies to a doc listing TODO markers, a test asserting how many
> `@ts-expect-error`s exist, and a checklist counting its own warning symbols.**

### ✅ AND WARD CORE'S OWN RULE FOR REPAIR NOTES, WHICH IS THE BETTER HALF OF ITS COMMIT

**Asked what made its provider comment a model, it declined the obvious answer:**

> ✅ **"The part worth copying is not the history — it is that line 124 makes the history
> CHECKABLE. The comment says the value was thrown away, and the line immediately below is the one
> that now uses it, with a test that fails if it stops."**

⚠️ **"A repair note with nothing beside it that can contradict it becomes folklore at exactly the
same rate as any other comment."**

✅ **THE SHAPE: a finding recorded together with the thing that will contradict it.** **Which is
precisely what the pinned count above lacks — a number with nothing beside it able to go red when it
drifts.**

### ⛔ AND THE COMMIT MESSAGE RECORDING THIS WAS TRUNCATED BY THE TOKEN IT WAS COUNTING

**The commit above (`fa2197824`) carries a message that stops mid-sentence:**

```
That line is the docblock sentence itself -- 85
                                                ^ ends here
```

⚠️ **The next words were `initialNow= call sites`.** **Passed to `git commit -m` in a double-quoted
shell string, `initialNow=` reads as a VARIABLE ASSIGNMENT and `call` as the command to run with
it** — **so the string ended there, the rest of the message was consumed as shell, and the command
exited `127` with `call: command not found`.**

> ⛔ **THE COMMIT RECORDING A SELF-COUNTING MEASUREMENT WAS TRUNCATED BY THE VERY TOKEN IT WAS
> COUNTING.**

**Third shell-quoting truncation tonight, third distinct mechanism, all three producing a short
message and a plausible-looking result:**

```
a PowerShell here-string in the Bash tool   an apostrophe ended the string early
a `-m "..."` string                          `word=` read as an assignment, next word as a command
a here-doc with \u escapes                   written literally, silently, into the document
```

✅ **THE FIX IS ONE HABIT, NOT THREE: always `git commit -F -` with a QUOTED heredoc (`<<'EOF'`).**
**Nothing inside a quoted heredoc is interpreted — no assignments, no expansion, no early
termination — and every commit tonight that used one is intact.**

⚠️ **AND THE COMMIT ITSELF IS NOT AMENDED.** **A follow-up costs one line of history; `--amend`
destroys the previous state as a precondition of replacing it, and that is not a trade worth making
to tidy a message.** ✅ **The lost remainder is preserved here instead, which is where a reader
looking for the reasoning would go anyway:**

> **Neither number is wrong — the tree changed, and what changed it was the act of writing the
> number down. The file count stayed 38 because that file already held the token, so the failure
> appears on one axis and not the other. It is dangerous rather than cute because the discrepancy is
> ONE: a reader re-running the grep gets 86, sees 85, and concludes the count was sloppy when it was
> exact. The remedy is not a better number — `86` is stable, but any later edit to that file
> silently invalidates it. The record must say that it counts itself, or the pattern must exclude
> the file that holds it.**

### ⛔ TWO ERRORS THAT CANCEL, AND REPRODUCE THE CORRECT ORIGINAL FIGURE EXACTLY

**Ward Core fixed the self-counting docblock by taking NEITHER repair I offered.** ✅ **It stamped
the figure with the tree it was taken on** — `d8cc6c628`, counted at `699cc3586` — **which is
strictly better, because a number naming its own SHA cannot be contradicted by a later edit at
all.** ⚠️ **It explicitly refused to exclude the file from the pattern: "that tunes the measurement
so the record fits, and the measurement is not the thing that should move."**

**Then it found a second error in its own figures, and I measured all three trees under both units
to check it. The result is worse than either of us described:**

```
                 matches (-o)     lines with a match (-c)     files (-l)
699cc3586            109                    107                    42     <- where 109 was taken
416fb1e48            110                    108                    42
d8cc6c628            111                    109                    42     <- today
```

⛔ **`git grep -c` TODAY RETURNS 109 — THE EXACT FIGURE ORIGINALLY REPORTED, MEASURED THE WRONG WAY,
ON THE WRONG TREE.**

> ⛔ **So anyone "verifying" the pinned 109 today with `-c` gets 109, confirms it, and is wrong
> TWICE — wrong unit AND wrong tree — with the two errors cancelling to the exact right answer.**

⚠️ **A confirmation that is doubly wrong and looks perfect. Nothing about the check would feel
weak.** ✅ **And it is not a freak: the tree drifts by one per commit that mentions the token, and
`-o` exceeds `-c` by a small constant, so the two quantities cross regularly. The coincidence is
STRUCTURAL, not lucky.**

### ✅ WHICH IS WHY BOTH HALVES OF WARD CORE'S FIX ARE LOAD-BEARING

```
stamp the SHA   kills the wrong-tree half
name the unit   kills the wrong-measure half
```

⚠️ **EITHER ALONE STILL ADMITS THE CANCELLING PAIR.** ✅ **It did both, and its generalisation is
the rule to keep: "one is the dangerous size" is an argument for stamping EVERY count, not only the
self-referential ones.** **Off by fifty gets investigated; off by one gets attributed to sloppiness
and quietly discredits a record that was exact.**

> ⚠️ **"Reaching for a count without naming the unit is the same failure as the grep on a table of
> tuples, one level up."** — **`-c` counts LINES CONTAINING a match, `-o` counts MATCHES, `-l`
> counts FILES. Three plausible answers to "how many", and nothing anywhere says which was asked.**

### ✅ AND THE TOOLING POINT, WHICH IS NOT THREE LAPSES

**Three shell truncations tonight between two sessions.** ⚠️ **Ward Core's own lost the words `as
never` to BACKTICK SUBSTITUTION — a fourth mechanism, and the one that proves the general fix.**

> ✅ **The QUOTED delimiter is what makes `-F -` total.** ⚠️ **An unquoted heredoc still expands `$`
> and backticks, so it fixes two mechanisms and leaves the one that bites hardest: a message
> containing shell metacharacters BECAUSE IT IS DESCRIBING CODE.**
