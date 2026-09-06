# Ward Flow — start here. Written by Ward Lead, 2026-09-05.

**Everything from five chats is merged onto one line. This file is what a new chat reads first.**

## 1. Where the work is

    master line   codex/task-ward-flow-live-state-20260831
    worktree      D:/Worktrees/Database/ward-lead
    tip           ae41ca860   (re-read it; see §6 on stale SHAs)

⚠️ **Ward Flow is never pushed.** Both ward branches exist on this disk only. Never `git add -A`,
never bare `git stash`, never delete a worktree. Providers (OpenAI, Supabase, GitHub, hosted CI)
need the owner's explicit say-so every time.

**Branches, re-read against the tip above.** Folded and reading zero unfolded:
`claude/ward-builder-two`, `claude/ward-builder-three`, `build/ward-space-ladder-2026-09-05`,
`ci/ward-journeys-inert-by-default`, `verify/ward-reword-arm-2026-09-05`.
**Still carrying unfolded work:** `claude/ward-builder-four` and
`claude/ward-builder-community-route` — neither chat has declared them ready, so neither has been
folded.

⚠️ **DO NOT COPY THAT LIST FORWARD; RE-DERIVE IT.** The sentence it replaced said _"all five
contributing branches read zero unfolded"_ and was true when written. Within two hours two branches
had moved and a sixth existed. A branch list is a measurement with a timestamp, exactly like a SHA
— run it in the same command as whatever you are about to do with it:

    for b in $(git branch --format='%(refname:short)' | grep -E ward); do echo "$b $(git rev-list --count HEAD..$b)"; done

## 2. THE ONE DELIBERATE RED. Do not "fix" it by deleting tests.

`tests/ward-mode-workspace-reachability.test.ts` — **left red on purpose. It is the only expected
red in the suite.** Any other red is a real failure, including any second red inside this same file.

### What it is red about

**Seven test files render `WardModeWorkspace` modes that no route reaches any more**, because four
merges moved those screens out from under them. They pass forever, describing screens no coordinator
can open.

    capacity     ward-bed-release.dom.test.tsx              -> CapacityScreen
                 ward-capacity-freshness-source.dom.test.tsx
                 ward-capacity-sexmix-release.dom.test.tsx
                 ward-capacity-view.dom.test.tsx
    movements    ward-flow-clock-consistency.dom.test.tsx   -> MovementsScreen
    queue        ward-flow-queue-selection.dom.test.tsx     -> DelaysScreen
                 ward-pull-vocabulary.dom.test.tsx
    exceptions   ward-pull-vocabulary.dom.test.tsx          -> DelaysScreen

⚠️ **THE LIST GREW AFTER THIS DOCUMENT WAS FIRST WRITTEN, AND THAT IS THE GUARD WORKING RATHER THAN
DRIFTING.** It said five files and two modes. **MERGE 01 then folded the priority queue, the
exceptions inbox and the escalation board into `DelaysScreen`** and turned
`/mockups/ward-flow/queue` and `/mockups/ward-flow/exceptions` into redirects — so two more modes
became unreachable and the guard picked them up with no edit. **Do not trust a file count in prose
over the guard's own failure message; run it and read the list it prints.**

### The exact condition that makes it legitimately green

The guard scans `src/` and `tests/` for `WardModeWorkspace mode="…"` and fails on any mode that
appears in `tests/` and not in `src/`. **It goes green when, for every mode rendered anywhere under
`tests/`, some file under `src/` renders that same mode** — nothing weaker.

In practice there are exactly two honest ways to satisfy it, per file:

1. **Re-point the render at the replacement screen** in the table above — `<CapacityScreen />`,
   `<MovementsScreen />` or `<DelaysScreen />` in place of `<WardModeWorkspace mode="…" />` — and
   carry the assertions across, adjusting them to the new screen's structure.
2. **Retire the test deliberately**, because the clinical property it asserts no longer applies to
   anything a coordinator can see.

Today `src/` renders only two modes — `governance` and `network`, from their own route files. So a
third way exists on paper (give the orphaned modes routes again) and **is not what anyone should
do**: those modes were merged away on purpose, with the owner's approval.

⚠️ **A GREEN FROM DELETING THE FILES IS THE FAILURE MODE, NOT THE FIX.** Deleting drops the clinical
question silently and the guard cannot tell the two apart — both make a mode stop appearing under
`tests/`. Four of these seven assert clinical properties: that a capacity figure says who confirmed
it; that a note fires when a ward's occupancy and recorded sex mix disagree; that a lapsed bed
reservation is called a pull and never a hold. **Each needs a decision, not a deletion.**

### 🔴 THE GATE THAT STOPS TESTS VANISHING CANNOT SEE THIS ONE VANISH

Found by Ward Builder One and re-measured here before being written down, because it decides how the
next chat should close this out.

`check:diff-integrity` exists to stop tests being deleted quietly. Its config today:

    maxRemovedFraction        0.25        perFileMaxRemovedFraction   0.5
    minRemovedCases           3           perFileMinRemovedCases      3
    approvedReductions        []          (empty)

And `scripts/check-diff-integrity.mjs` says in terms: _"Deleted files are exempt here and answer to
the aggregate."_ So a whole deleted file skips the per-file floor and must clear the aggregate one —
which needs the loss to exceed **both** a quarter of the changed-file case total **and** three cases.

⚠️ **`tests/ward-mode-workspace-reachability.test.ts` CONTAINS EXACTLY TWO `it(...)` CASES.** Two is
below `minRemovedCases` of three. **Deleting the guard that reports these seven files therefore
cannot trip `check:diff-integrity` at all, whatever else is in the same diff.** The cheapest thing in
this repository to make disappear is the thing holding the list of what still needs answering, and
the gate built to prevent exactly that is structurally blind to it.

**Deleting one of the seven flagged files is only caught if the rest of the diff is small.**
`ward-pull-vocabulary.dom.test.tsx` has 16 cases, which clears the three-case floor — but it must
also exceed a quarter of the changed-file total, so bundling the deletion into a large legitimate
change hides it. That is not a contrived scenario: it is what an ordinary _"re-point the tests and
tidy up"_ commit looks like.

**So each of the two honest routes gets a receipt, and the third leaves a mark:**

1. **Re-pointing** shows up as changed cases in a file that still exists — visible in the diff.
2. **Deliberate retirement** is recorded as an `approvedReductions` entry in `diff-integrity.json`,
   which the script validates for `path`, integer `before`/`after`, a reason of at least twelve
   characters, and an `approvedOn` date. **That array is empty today.** A retirement that leaves no
   entry in it is indistinguishable from a deletion nobody noticed.

### It has now earned itself twice, and the second time was a live hole

The first time, checking rather than re-pointing found a fold that had dropped who confirmed each
capacity figure.

**The second time is worth reading before anyone judges this red to be bookkeeping.**
`ward-pull-vocabulary.dom.test.tsx` pins the ward vocabulary rule — _a lapsed bed reservation is a
**pull**, never a **hold**_ — against `<WardModeWorkspace mode="exceptions" />`. MERGE 01 moved that
inbox into `DelaysScreen`. **Measured 2026-09-05: `ward-delays-screen.dom.test.tsx` asserted nothing
whatever about pull-or-hold wording.** The live label reads `"Bed pull expired"` because the copy was
carried across, not because anything defended it — renaming it to _"Bed hold expired"_ on the screen a
coordinator actually reads would have left **every test in the repository green.**

Closed in `43c56d6c5`, which carries the pin across to `DelaysScreen`. Control run, not asserted:
mutating the live title fails exactly that one test by name, 13 others in the file untouched, source
hash `569a60ef` before and `569a60ef` after. **The other six files have not had this treatment — the
red is still pointing at six unanswered questions of the same shape.**

### One vocabulary question this surfaced, for the owner

The same catalogue entry carries the note _"the hold lapsed before the bed was used"_. That is honest
copy about a **bed reservation**, not about detaining a person, so the new pin deliberately does not
ban the word outright — a blanket ban would go red on truthful copy and the tempting repair would be
to weaken the guard. **Whether that note should say "pull" too is a wording decision, not a defect.**

### THE DEBT DID NOT GROW. The guard's own commit message understated it from the start.

Ward Verifier raised this and it was the right thing to settle before touching anything: the guard's
commit says _"five test files now guard two screens no user can reach"_, and the same unchanged guard
reports **seven files across four modes**. If modes were being retired faster than their tests were
re-pointed, that would matter more than the backlog. **They are not.** Measured:

    MERGE 01   e31c9c462   2026-09-05 16:17:06 +0800   queue/exceptions become redirects
    the guard  e54a58526   2026-09-05 18:31:44 +0800   landed two hours later
    ancestry   MERGE 01 is a strict ancestor of the guard commit

At the guard's own commit, `ward-flow-queue-selection.dom.test.tsx` already rendered `mode="queue"`
and `src/app/mockups/ward-flow/queue/page.tsx` was already a redirect. **So the guard was already
reporting more than its message claimed, on the day it was written.**

⚠️ **The message was prose describing a guard's output, written without running the guard — the same
defect as this section's own stale "five files across two modes", found the same day by the same
means.** Two independent instances in one document. **Read the guard's printed list. Never a count in
prose, including the count in the commit that created it.**

### ⚠️ THE TWO "EXPECTED FAIL" RESULTS, because a number in a status line is not a record

Raised by Ward Builder One, who was right that documenting the red while leaving these two as a bare
count is inconsistent. A full run reports **1 failed, 2 expected fail** — three different objects, and
the next chat meets all three at once.

**There are exactly two, in exactly two files** — `grep -cE "^\s+(it|test)\.fails\(" tests/ward-*`
confirms no third is hiding, and that is checkable in one command by whoever reads this.

⚠️ **THE POPULATION IS 273 FILES. THIS PARAGRAPH SAID 265 FOR SEVERAL HOURS, AND FOUR FIGURES HAVE
NOW BEEN WRONG HERE.** In order: 278, then 263, then 265, and only then 273. Every one was an honest
measurement; each measured a **different unit**. The rule that settles it is the union of the
`ward-*` glob and files whose ward reference is **EXECUTABLE** — on a line that is not a comment:

    { git ls-files 'tests/ward-*' | grep -E "\.(test|spec)\.tsx?$"
      for f in $(grep -rlE 'ward-(management|flow)' tests --include=*.ts --include=*.tsx \
                   | grep -v "^tests/ui-" | grep -E "\.(test|spec)\.tsx?$"); do
        n=$(grep -nE "ward-management|ward-flow" "$f" \
              | grep -vE "^[[:space:]]*[0-9]+:[[:space:]]*(\*|//|/\*)" | wc -l)
        [ "$n" -gt 0 ] && echo "$f"
      done
    } | sort -u

Glob 263, executable filter 270, union **273**. The glob alone misses nine files that exercise ward
code without carrying the name — `proxy.test.ts` asserts a ward route redirect in running code and
imports nothing ward, so an IMPORT-based filter misses it too. A MENTION-based filter goes the other
way and sweeps in six files that name ward only in a comment, giving 278.
**Union, not glob; executable, not mention — and not import either.**

🔴 **THE FAILURE THAT PRODUCED 265 IS THE ONE THIS DOCUMENT KEEPS DESCRIBING, ARRIVING INSIDE IT.**
The command above replaced an import-based one at `10715ee26`. The commit before it corrected the
NARRATIVE to 273 and left the CODE underneath still producing 265, because a `sed` failed silently
on an unterminated expression. For hours this file carried a correct number sitting directly above a
command that could not produce it — and a chat reading top to bottom would have trusted the number.
**When you correct a figure, run the command underneath it in the same breath.**

⚠️ **A STALE COPY OF A COMMAND IS INDISTINGUISHABLE FROM A CURRENT ONE.** On 2026-09-05 Ward Lead and
Ward Builder Three independently measured 265 and read the agreement as corroboration. Both were
running the same superseded command, out of the same stale prompt paste, against a repository whose
own copy had already been fixed. **Two agreeing measurements of one wrong instrument are one
measurement.** Ward Builder Three settled it in a single step by diffing the two populations BY NAME
rather than by count: 265 is a strict subset of 273 — eight files added, none dropped.
**Diff the members, never the totals.**

⚠️ **THEY ARE REPORTED SEPARATELY BY VITEST AND ARE NOT INSIDE THE PASSING COUNT.** A full run reads
`1 failed | 3515 passed | 2 expected fail (3518)` — the three numbers sum to the total, so the two
are their own category. **A status line that stops itemising them looks identical to one where they
disappeared**, so any figure quoted anywhere should carry all three or none.

Both are `it.fails` tripwires. Neither is a defect; both are pins on work that is deliberately
unbuilt:

    tests/ward-flow-reducer.test.ts:812
      "deletes the pulled admission and clears movement.admissionId when a pulled bed's
       examination is revoked"
      -> the assertion is the CORRECT post-condition; the reducer does not do it yet.

    tests/ward-movement-fixture-reducer-reachable.test.ts:130
      "every one of them carries an admissionId resolving to a wardAdmissions record with
       state pulled — NOT YET TRUE (5b unimplemented, ward-admissions-seed.ts out of scope)"

**What makes each legitimately green, and it is NOT the same answer for both:** when the behaviour is
built, the tripwire starts passing, and a passing `it.fails` is reported as a FAILURE. So green here
means _go and delete the tripwire, replacing it with an ordinary `it`_ — not _leave it alone_.

🔴 **AND THE HAZARD THAT MAKES THEM WORTH FOUR LINES RATHER THAN A COUNT: `it.fails` passes when its
body throws for ANY reason.** A typo, a renamed field, a dispatch the reducer rejects for an entirely
unrelated cause — all of them keep it green and reporting "expected fail" long after the thing it
pins has been fixed or has rotted. **This codebase has already recorded one case where both halves of
an `it.fails` tripwire went false and it stayed green** (see `ward-community-corrected-claims.test.ts`
and the control at `ward-flow-reducer.test.ts:758`, which exists precisely because the tripwire cannot
provide it for itself). **Neither of the two above should be trusted without running its control.**

### This is NOT Ward Verifier's inert CI flag — they are unrelated

Ward Verifier's `vars.WARD_JOURNEYS_BLOCKING` is a **separate matter with nothing in common but the
word "expected"**. It is a repository variable that is unset, which makes the seven browser journeys
non-blocking in CI; it becomes live only when the owner sets it after seeing those journeys green
once, and it can only take effect on `main`. **It produces no red locally and no failing assertion
anywhere.** A red you can run and a flag you cannot are different objects, and conflating them would
let a real failure hide behind "that one's expected".

## 3. Outstanding work, with owners

✅ **THE TYPECHECK IS CLEAN — 0 errors, measured on the folded line, `npx tsc -p
tsconfig.typecheck.json --noEmit`, exit 0.** It was 3 for most of 2026-09-05 while this document's
expected-state line claimed 0, and two of the three were already standing at `0bb857564`, the tip
this same file recorded. **That line was written, not measured.**

⚠️ **THE REASON A GREEN SUITE HID THEM FOR HOURS: VITEST RUNS NO `tsc`.** All 273 files were green
with three type errors standing, and no ward gate anywhere asks the question. **A green suite is not
evidence about types — run the command yourself.** Three chats found them independently once anyone
looked, which measures how visible they were to a person and how completely invisible to everything
that runs.

| Item                                                                                                                                               | Owner                                                                              | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **THREE guards stay GREEN when the caption they are named for is DELETED**                                                                      | Ward Verifier, `docs/ward-flow/reword-arm-audit-2026-09-05.md`                     | ⚠️ **Reported as TEN and corrected to THREE by its own author; Ward Lead re-traced all ten before shrinking it.** Seven read the caption's OWN element via `getByTestId`, which THROWS on deletion — caught upstream of the helper, so they were never members. The three read something broader: `community-hub:826` and `:827` read `document.body.textContent`; `ed-psychiatry-hub:779` reads the outbox LIST container for a phrase on five rows. **The arm measured the PREDICATE over captured text and the claim was made about the GUARD — and a guard is predicate PLUS query.** Fix = narrow what is READ, never lengthen a spelling list |
| The other seven: a redesign TRIMS one sentence from a multi-sentence caption and another sentence in the same paragraph still carries the spelling | Ward Verifier — RECORD, do not fix                                                 | ⚠️ **Deliberately not fixed.** Per-sentence testids would pin a caption's internal structure, which is §8's failure mode arriving disguised as thoroughness. Worked example: `ward-statistics-arrival-constant-gap`, eight concepts against one paragraph, two duplicated inside it                                                                                                                                                                                                                                                                                                                                                                 |
| 🔴 The "still with team" caveat can be DELETED OUTRIGHT and its guard still passes                                                                 | Ward Verifier — the clinical one                                                   | A second paragraph repeats "no team discharge, no episode end", so the body-text read still matches. **The caveat exists to stop a coordinator reading the table as "currently under this team's care".** Proved by deleting the whole `<p>` and re-running: 1 passed, component restored to hash `e0e496cd0`                                                                                                                                                                                                                                                                                                                                       |
| 52 of 90 converted sites are carried by exactly ONE spelling — no redundancy at all                                                                | Ward Verifier                                                                      | ⚠️ **Quote 52, never 46.** The 46 came from a synonym the verifier chose itself, and against a one-spelling list red was guaranteed — 46 measures the choice, not the code                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Eight ward test files never reviewed — 65 pinned sentences, **20 of them negative**, `expectNeverSaysAgain` unused                                 | Ward Verifier's list, in `docs/ward-flow/redesign-brittleness-audit-2026-09-05.md` | **The most valuable item here, because it records what was NOT done.** The 20 negatives fail in the silent direction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Five statistics screen rebuilds                                                                                                                    | not started, deliberately                                                          | plan + traps in `docs/ward-flow/statistics-primitive-reconciliation.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `WardFigure` gains `tone`/`delta` **and** the flagged ceiling moves, in the same commit                                                            | —                                                                                  | see §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Two chip vocabularies, one renderer underneath                                                                                                     | —                                                                                  | so the wordless-child throw is inherited, not re-derived                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ward-bar.module.css` has no `forced-colors` and no `@media print`, with 11 background declarations                                                | —                                                                                  | ⚠️ **do not quote a ratio**; four figures were produced and all four differed. Re-measure and state the walk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `TransportLeg` — two types, one name, four states vs five                                                                                          | Ward Lead ruling: collapse to the five-state union                                 | flagged in the file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Six unreachable `WardModeWorkspace` branches; the `WardMode` union; the Delays nav entry still carrying `id: "queue"`                              | E9 dead-code                                                                       | `command` is UNKNOWN, not zero — do not count it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/not tracked/i` wording pin in `ward-capacity-screen.dom.test.tsx`                                                                                | Ward Builder Two, diagnosed                                                        | property right, literal phrase wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| The sex-mix integrity signal                                                                                                                       | Ward Lead                                                                          | ruling in §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| About 26 of ~30 ward screens never opened since the white ground landed                                                                            | —                                                                                  | one that leaned on the old tint will look flat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### BACKLOG — the deletion gate's blind spot: a proposal with a cost, NOT a decision made

**Not implemented. It needs the owner, because it changes a repository-wide gate and its obvious fix
has a price the proposal did not name.** Recorded here naming the specific file, because _"the
deletion gate has a floor"_ is a fact somebody will read as safe.

**The gap, verified by reading both rules rather than the summary:**

    scripts/check-diff-integrity.mjs
      per-file   "A deleted file (exists: false) never fails here — judged by the aggregate"
      aggregate  if (removed < config.minRemovedCases) return { ok: true }
    diff-integrity.json      minRemovedCases 3     approvedReductions []
    the guard in question    exactly 2 it(...) cases

**Two below three, so the aggregate returns OK before it computes a fraction, and the per-file rule
exempted the file already. Both doors closed by construction.** And the gate exists precisely because
tests were once silently deleted (`#Y30AXB`) — its own header records that the deletion reaching
`main` was stopped by an unrelated merge conflict, _"luck, not a gate."_

**Ward Builder Two's proposal:** judge a deleted test file **categorically** — any deleted test file
that had cases requires an `approvedReductions` entry, whatever the counts. It does not touch
`minRemovedCases`, which is right: lowering that would make the gate noisy enough to be turned off.

⚠️ **THE COST THE PROPOSAL DID NOT PRICE, AND IT IS THE REASON THIS IS NOT DONE.** The per-file
exemption is not an oversight — the script states its rationale: _"so that deleting a spec while
adding its replacement in the same commit is not treated as lost coverage."_ **Renaming or moving a
spec is exactly that shape, it is common, and under the proposal every one of them would need an
approval entry.** That is the same noise argument the proposal correctly makes against lowering
`minRemovedCases`, arriving at its own recommendation from the side.

**A narrower form probably threads it** — require the entry only when a deleted test file's cases do
not reappear elsewhere in the same diff — but that is a real piece of design, not two lines, and it
is a repository-wide gate rather than a Ward Flow one.

**Whoever takes it: `approvedReductions` is empty today, so it is provable immediately.** Add the
rule, delete `tests/ward-mode-workspace-reachability.test.ts` in a scratch diff, and **watch it go
red.** If it stays green the rule did not land — and on this gate that is worth watching rather than
assuming.

## 4. 🔴 FOUR GUARDS WILL FIRE WHEN THE OWNER REPLACES THE TEAM DATA. They are the system working.

He has said he will. **Full detail is pre-registered at the top of
`tests/ward-community-ratified-aliases.test.ts`.** In short:

1. **`ratifiedDecisionsOnMovedFigures()` is SUPPOSED to fire.** ⚠️ **Do not update `shownCounts` to
   make it green.** The owner signed a ruling about 21 suburbs under four specific spellings; if
   those move, his ruling has stopped being about what was in front of him. **Take it back to him.**
2. `ratifiedAliasesWithNoSuchTeam()` — retire the entry with a note; do not delete the guard.
3. `RECORDED_COLLISIONS` (10 families / 24 names) will be wholly wrong. ⚠️ **Re-derive BY HAND.
   Never paste the module's output** — that recreates the tautology it exists to replace.
4. Ward Builder Three's independent implementation — re-run both and take the **symmetric difference
   BY NAME**. That comparison found both of 2026-09-05's real bugs; two agreeing counts found neither.

## 5. Owner decisions of 2026-09-05, with the question that produced each

**Quote the question when relaying a ruling.** The same decision asked two ways gets two honest
answers, and this project has been caught by it.

- **Ready beds.** _"Some beds counted as Ready are still being cleaned and the system refuses to
  admit into them — how should the screen handle it?"_ → **show the cleaning count beside the
  figure; do not change the number.** Built against `bedsPendingPreparation`, the reducer's own
  helper, so the screen and the refusal cannot disagree.
- **Inner City.** _Shown all four spellings with suburb counts, and told plainly that merging ICC
  pulls in plain `Inner City` — 16 suburbs he had not been asked about._ → **all four are one
  service, 21 suburbs.** Held as an owner-confirmed synonym GROUP (not pairs — pairs smuggle the
  transitivity back in), attributed and dated, kept separate from the three string relations, with
  raw values untouched and referrals still findable under any spelling.
- **Scratch files / `.next`** — approved by name, per file. An approval for two named files does not
  stretch to a third.
- **Browser tests** — keep them, do not run them. Now behind `vars.WARD_JOURNEYS_BLOCKING`,
  inert until deliberately enabled.
- **White ward ground** — asked for three times; done in the one shared token.

**Rulings I made that are not yet built:**

- **Sex-mix signal.** Carry the SIGNAL, not the data. `RELEASE_BED` raises `allocatable` and `empty`
  together (`ward-flow-reducer.ts:1703`), and `allocatable` is what `ready` reads — so a ward whose
  mix disagrees with occupancy is mid-update and `ready` has just moved. Sentence: _"this ward's bed
  records are mid-update — this figure may not be settled."_ Renders only when true; guard over the
  property with a fixture each way; preserve the direction check.
- **`WardFigureStrip` ceiling.** It throws above two `flagged` tiles. **A new `tone` prop routes
  straight around that count** — the constraint stays in the file, stays green, stops being true.
  Both changes together or neither. **Control: classify every member of the tone union in ONE place
  so a new tone fails to COMPILE**; failing that, enumerate the union at runtime and floor on its
  size, then add a tone without classifying it and require red.

## 6. ⚠️ Instruments that lied to us. All of them fail toward ABSENCE or false success.

    git rev-parse <ref>:<path>        prints its argument back instead of failing
    git show <ref>:<path>             MSYS mangles the colon into a Windows path; reports "missing"
    git merge-base --is-ancestor      same answer for "not folded" and "not in my object store"
    node -e '...'                     the shell eats \b, \n, \t; a mutation never runs and reports
                                      the UNMUTATED result as a pass
    gate-receipts cache               reuses a prior pass; use GATE_RECEIPTS=refresh for anything
                                      you will quote in a commit
    a blob comparison, for OWNERSHIP  cannot tell AHEAD from BEHIND — see below
    git diff TIP..B -- <path>         same defect: an endpoint diff calls a file "changed" on a
                                      branch that is merely behind
    a guard's printed output          authoritative and wrong when your copy of the guard is stale
    --reporter=basic (vitest 4)       startup error, and the wrapper reported exit 0

**Use `git ls-tree` + `git cat-file blob`. Check the object exists before calling something
unfolded. Write probes to a FILE and hash the subject either side.**

**And re-read a branch tip inside the same command as the action.** Four tips went stale under a
measurement of mine within minutes; three chats made the mirror-image error. A SHA in a message is a
claim with a timestamp.

### 🔴 "DIFFERS" IS NOT "OWNS", AND TWO CHATS AGREED ON THE WRONG ANSWER BECAUSE OF IT

The single most expensive method error of 2026-09-05, because it produced **agreement**.

Ward Verifier routed `ward-movements-derivations.test.ts` to Builder One on two true facts —
community-route is unfolded, AND it holds a different blob. Ward Lead confirmed it with an
independent blob comparison across all six branches. Both wrong, and the confirmation was worthless:

⚠️ **A BRANCH THAT IS BEHIND ALSO "DIFFERS", IN THE OPPOSITE DIRECTION.** The differing blobs were
simply OLDER MASTER BLOBS of the same file — community-route held master's blob from one commit
back, builder-two and journeys-inert held master's from two commits back. **Nobody owned it.**

    ✅ git rev-list --count HEAD..<branch> -- <path>     commits UNIQUE to the branch touching it
    ❌ comparing blobs                                    cannot distinguish ahead from behind
    ❌ git diff HEAD..<branch> -- <path>                  same defect; reports 1 for a stale branch

**Ward Lead then ran the blob method over two candidate work packages and it produced a FALSE
COLLISION** — a job was nearly withheld from an idle chat because a branch was behind. The correct
check returned zero.

> **Two methods that cannot tell ahead from behind are one method.** The agreement was not
> corroboration; it was the same error run twice. **When a second method confirms the first, ask
> what they share before believing it.**

### 🔴 THE OWNERSHIP CHECK IN FULL — BOTH HALVES, THE RIGHT BASE, AND THE RIGHT IMPLEMENTATION

Three chats broke this rule in three different ways within one hour of it being written. **Neither
half is sufficient alone, and their failure directions are OPPOSITE:**

    blob comparison alone   cannot tell AHEAD from BEHIND
                            -> a stale branch reads as an owner. FALSE OWNERSHIP.
    rev-list alone          cannot tell "somebody is working on this file" from "I am behind"
                            -> every branch ahead of you counts, by construction. FALSE OWNERSHIP.
    ✅ the pair             non-zero count AND differing content  = a claim, go and ask
                            non-zero count, IDENTICAL content     = your own staleness, proceed

⚠️ **THE BASE MUST BE THE MASTER TIP, AND `HEAD` IS NOT THAT IN A BUILDER'S WORKTREE.** Ward Lead
wrote the check as `git rev-list --count HEAD..<branch> -- <path>` without saying so. Run from a
builder worktree, `HEAD` is that builder's own branch, so **every branch ahead of it counts non-zero
for every file** — Ward Builder Three's gate fired on all three of its assigned files, and every
count traced back to a single commit that was **its own earlier work**, already folded onto the
master line and absent from its history. Name the tip explicitly:

    MASTER=$(git rev-parse codex/task-ward-flow-live-state-20260831)
    git rev-list --count "$MASTER..<branch>" -- <path>          # then compare content

⚠️ **AND DO NOT IMPLEMENT THE CONTENT HALF WITH `git rev-parse <branch>:<path>`.** It echoes its own
argument back when the file is ABSENT from that branch, so an absence renders as a difference — §6's
first listed instrument, failing exactly as described, INSIDE the check built to replace a different
unreliable one. Use `git ls-tree --format='%(objectname)' <branch> -- <path>`, which returns empty
and tells the truth.

**And check for a worktree before calling a non-zero count a collision.** Three of the branches this
gate fired on are dormant — no worktree, last commits days old, one self-describing as built on an
association the owner has since overruled. **A branch is not a person.**

### 🔴 A STALE GUARD FAILS IN THE MOST AUTHORITATIVE DIRECTION AVAILABLE

Ward Builder Three's, in its words, and it is the sharpest thing anyone wrote tonight.

It followed this document's own rule — _run the guard, read its printed list, never a count in
prose_ — exactly, and produced a false finding: it reported the deliberate red as naming eight files
and offered that as a correction to §2. Its branch was 17 commits behind and carried the pre-fix
guard. Comment-stripping had already landed on the master line, precisely because
`ward-delays-screen.dom.test.tsx` was being flagged for describing the problem in a doc comment.

> **Moving trust from a document onto a program does not remove the version problem, it relocates
> it.** And it relocates it somewhere worse: **you now have running output, so you argue harder.**

**Diff the guard's own blob against the master line before quoting its output at anyone** — above
all before offering it as a correction to someone else's document.

## 7. The night's actual finding, and it is not any single bug

**Every serious defect found was invisible to the thing that should have caught it, and visible to a
second, independent look.**

- The whitespace fold and the four-way Armadale split — found by an independent implementation, not
  by the biconditional that is structurally blind to them.
- A prototype's self-contradiction — found by an agent whose brief could not act on it.
- Duplicated primitives — found by the agent that built them, reporting rather than burying.
- Albany unclickable, and a name rendering as a one-character column at 390px — **green in every
  suite, found by opening the page.**
- A tint justified in the token layer as providing separation, measured at 1.08:1.

> **A correctly-scoped brief produces a correctly-scoped omission, and nothing inside the brief can
> see it.**

**So: every brief should name the thing the work could silently duplicate or contradict, and require
a REPORT rather than a decision when it does.** For UI work that means naming the primitives
directory and saying _"compose what exists; if what exists is weaker, say so and stop."_

## 8. Standing test policy — the owner made this binding

> _"Please can you ensure that all testing works with the redesigns rather than fighting them since
> i am going to redesign many pages."_

    GUARD THE CLAIM AND THE CLINICAL PROPERTY. NEVER THE RENDERING.

**A guard that goes red on a legitimate redesign gets deleted — and the honest guards go with it in
the same tidy-up.** The test for whether a guard is a fighter is a control, not a judgement: **mutate
the subject to state the SAME FACT differently and require the guard to SURVIVE.**

⚠️ **And the two failure modes found today when acting on that rule:**

- **A guard broader than its own stated rationale forbids the correct fix.** The index's numeral
  guard forbade every digit; its own message was about a count labelled as _services_.
- 🔴 **A narrowing can go GREEN on the very defect the guard exists for.** Mine required a numeral
  and a service noun in the same element; the page puts them in a button and a nested span, so the
  predicate could never match. **It would have shipped — page green, noun honest — had the mutation
  not been run.** Always re-run the original defect after narrowing anything.
