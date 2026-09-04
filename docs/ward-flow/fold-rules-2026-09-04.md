# Fold rules — 2026-09-04

**These are resolutions somebody drove, not resolutions somebody reasoned about.** Each one exists
because the obvious way to resolve the conflict produces a GREEN test and the wrong answer. They are
written here because a finding that lives only in a chat transcript is not available to whoever
performs the fold at 3am — and in two of the three cases below, the person folding would have had
no signal at all.

Integration line: `codex/task-ward-flow-live-state-20260831`.

---

## 1. `tests/ward-primitives-shared.test.ts` — `KNOWN_BACKLOG`: DELETE BOTH ROWS

> Remove **both** disputed rows — `statistics/statistics.module.css: .field` **and**
> `statistics/statistics-sections.module.css: .field`. Keep Ward Builder Three's explanatory
> comment. Take neither side, and do **not** take the union.

**Why the obvious resolutions are wrong.** Ward Builder Two renamed `.field` in
`statistics.module.css`; Ward Builder Three renamed it in `statistics-sections.module.css`. Each
removed the allowlist row for the file they fixed and kept the row for the file they did not. In the
merged tree **both** files are renamed — `.field {` count 0, `.fieldName {` count 1 in each — so
both rows are stale.

`KNOWN_BACKLOG` is a one-directional allowlist: it forbids members outside the list and cannot
notice a member that no longer exists. **A stale row in it is not residue. It is a standing
permission for the exact collision the rename removed.**

🔴 **THE TEST IS GREEN IN ALL THREE RESOLUTIONS. Running it cannot tell you which is right.**

    control, no injection      res=two: 5 passed   res=three: 5 passed   res=neither: 5 passed

**The mutation matrix is what separates them** — inject `.field { color: red }` back into each file:

    injected into                       res=two        res=three      res=neither
    statistics-sections.module.css      5 passed  ⚠️   1 failed ✓     1 failed ✓
    statistics.module.css               1 failed ✓     5 passed  ⚠️   1 failed ✓

Symmetric and decisive. Two's side re-permits the collision in `statistics-sections`; Three's
re-permits it in `statistics`; **the union carries both stale rows and permits both**, which makes
the cautious-looking option the worst one. Only deleting both catches both.

Measured by the Ward Verifier on merged tree `516e0d86746e57d7178f556734aec4aa3e065746`.

⚠️ **A method note the Verifier reported against themselves, and it is the reason to trust the
table above.** Their first matrix restored only the file being injected, so leftovers contaminated
three of six cells and it reported Three's side catching an injection it actually permits. They
caught it because one cell contradicted the mechanism, re-ran with a full restore and a hash check
before every case. **A contaminated matrix that happens to agree with expectation is invisible** —
and this one would have vouched for a side that permits a collision.

---

## 2. The statistics screen and its claims register — SAME SIDE FOR BOTH HALVES

> Take Ward Builder Two's `statistics-screen.tsx` with Two's register, or Three's with Three's.
> **Never one of each.**

Ward Builder Three drove the bad pairing rather than predicting it: their `statistics-screen.tsx`
(11 × `styles.field`, zero `styles.fieldName`) against Two's fully-renamed register gives

    FAIL tests/ward-statistics-claims.test.ts > the model-claims register
      > finds every claim's rendered locator on its own surface, exactly once
    Tests  1 failed | 18 passed (19)

All three claims resolve to `statistics-screen.tsx` and find zero occurrences on their own surface.
**Both branches are internally consistent and green alone. A clean merge here is not a consistent
one**, and the test that catches it is the one somebody under time pressure would soften.

**Current decision: take Two's side**, weakly — it is the completed rename and leaves no orphan
`.field` class. This is tidiness, not correctness.

⚠️ **Ward Builder Two measured the merged tree of their branch against Three's
(`git merge-tree --write-tree`, tree `ebb5d9770`) and it takes their side for both halves, so the
red state is not created on that pairing. That is a HEAD-vs-R measurement and it does NOT carry
through a fold that re-bases the pairing. Re-derive it at fold time; do not reuse it.**

---

## 3. Print coverage is per-declarer, not per-file

Established after the central print reset landed at `e2e2b7e4d` / corrected at `78f002750`.

> A file's themed colour declarations are covered when **each declarer** sits inside a subtree
> reached by a class carrying a winning `@media print` reset — whether that class is on the element
> itself or composed into it. **"The file is covered" is a conclusion, never a lookup.**

    a ROOT composes reaching a winning reset      covers the root AND its descendants
    a NON-ROOT composes reaching a winning reset  covers THAT element and its subtree only

**`composes` is not an ancestor** — the compiled root carries both class names, so a rule on the
composed class lands on the very element that declares the offending colour. That is why one block
on `.wardTokens` replaced ten per-screen patches, and why three files' comments saying it "is not
fixable centrally at `.shell`" were true about an ancestor and wrong about this.

✅ **`tests/ward-management-print-coverage.test.ts` NOW RESOLVES `composes`** — landed 2026-09-04,
Ward Builder One. Until it did, it asked whether THIS FILE carries a winning reset, so it reported
composing screens as uncovered, kept already-fixed files in `KNOWN_UNFIXED` while staying green, and
**would have reported the next screen that adopted the token layer as broken on the day it became
covered.** The two tempting repairs at that moment are both wrong, and are recorded here because the
guard could regress to asking the old question: a redundant per-file print block, or a
`KNOWN_UNFIXED` row for a file that was never broken.

⚠️ **The resolver grants a file-wide blanket only for a ROOT edge** — the first class-declaring
rule, and the only edge composing that (class, target) pair. `ward-management.module.css` composes
`wardTokens` twice, so it gets none and its coverage rests on its own print block. Deliberate: its
DOM containment was never verified the way the seven composing screens' was.

`KNOWN_UNFIXED` is now one row — `wards/ward-overview.module.css`, exempt because nothing in the
repository imports it, which makes its retention an owner decision rather than a defect.

**A per-file fix in a composed-FROM file is not per-file.** Measured, live: a three-selector print
block added to `ward-shared.module.css` (`.hint`, `.pending`, `.wardName`) silently changed the
coverage of three other files —

    ed/ed-home.module.css        hint(83) hero(90) heroFigures(101)   non-root; already root-covered
    search/search.module.css     field(142)                           gains NOTHING — not in the block
    ward-management.module.css   wardName(781) hint(786)              PARTIAL coverage on two subtrees

**Nothing in the diff of `ward-shared.module.css` says any of that**, which is what a reviewer of
that file cannot see.

### Mutations the resolver must pass, in order of strength

1. Delete `ed-home`'s **root** `composes` at line 14 only → must go RED, even though the file still
   composes three other classes. Fails an eager resolver inside a file that composes both kinds.
2. `ward-management.module.css` via `ward-shared` → the assertion must be about what **composition
   contributes**, not the file's final verdict. It has its own print block, so a verdict-level
   assertion passes for the wrong reason and stops discriminating.
3. `ward-management-network.module.css` composes `descendantKill` from the reduced-motion layer,
   which carries no reset → must NOT resolve as covered. Resolve _which_ class was composed; never
   ask whether the file composes anything.

Floor the **resolved edges**, not the covered ones — a resolver that resolves nothing satisfies a
coverage floor trivially.

---

## 4. Control plane: the branch is the identity, the path is a cache

`docs/ward-flow/live-state.json` records five checkouts. **Three of the five folders are gone** —
all under `.claude/worktrees/`, wiped by unrelated cleanup on 2026-08-21. Measured 2026-09-04:

    claude/ward-flow-setup-967aa0-wf          0c94814a6   EXISTS
    claude/Wardquestions                      023f8e9f9   EXISTS
    claude/Ward-design                        623c0c6a5   EXISTS

**All five branches resolve and all five recorded heads are reachable. Nothing was lost**, because
refs and objects live in the shared repository rather than in the worktree folder. A branch survived
what a path did not, on this machine, to these exact records.

> **Integrity requirement: the BRANCH exists and its recorded head is reachable.** Resolve the path
> at validation time from `git worktree list`.
>
> - branch missing, or recorded head unreachable → **error**. That is real loss and must be loud.
> - branch fine, worktree absent → **not an error**. Report "no checkout mounted" and continue.

This also removes the cascade in `scripts/ward-flow/chat-control.mjs`, which throws on the first
dead path and hides the next two.

🔴 **NEVER EDIT A PATH INSIDE A HANDOVER OR EVIDENCE RECEIPT.** Their filenames are their own
sha256 — verified for `a60d51ea7706….handover.json` and `inventory-5c5d53d2….json`. Editing the
content destroys the identity. `live-state.json` is the editable record.

---

## What made all four of these findable

Each was found by driving the thing rather than reading it, and three of the four were **green**
right up to the moment somebody injected the defect the check was supposed to forbid.

> **Green has meant "the question I asked has a consistent answer", never "the property holds."**
> — Ward Builder One

---

## 5. A mutation-testing agent makes the working tree an unreliable commit source

Found by Ward Builder One while holding an uncommitted document, with a resolver agent running
mutations against committed stylesheets.

> **While a mutation agent is running, do not commit anything. Nothing announces when that window
> is open.**

Two of its mutations deliberately break a committed file before restoring it from the committed
blob. **Commit during that window and you commit the mutant** — it stages like an ordinary file, the
hook passes, and afterwards the tree is clean.

🔴 **The failure has no symptom, and the reason is that a correct check has had its reference moved
underneath it.** The agent restores and verifies against `HEAD`. Once the mutant IS `HEAD`, the
restore verifies successfully against the mutant, the agent reports success truthfully, and the
guard goes green because **the mutant has become the baseline.**

**Before staging anything while any agent is out:** `git hash-object <path>` against
`git rev-parse HEAD:<path>` for every file a mutation could be targeting.

This sits beside the restore-by-blob rule and covers the other direction: **restore-by-blob protects
the agent's own file; this protects everyone else's commit.**

---

## 6. A sweep's output is a population to READ, never a population to CHANGE

Ward Builder Three, after being handed four call sites and told to apply one treatment to all four.

    site 1  ward-management-network.tsx:166      CHANGED — accepted-only
    site 2  ward-management-modes.tsx:210        CHANGED — in the OPPOSITE direction to the brief
    site 3  ward-management-modes.tsx:415        NO CHANGE — correct as it stands
    site 4  coordinator/shortlist-panel.tsx:413  NO CHANGE — deliberate and documented

> **`destinationUnit`'s fallback is not a defect in itself. It is a defect wherever its answer is
> RENDERED AS A CLAIM, and correct wherever it chooses a default or tests "is this recorded at
> all".** Six of the nine call sites read it as a claim; three do not. **A sweep that replaced every
> call would have broken three working screens.**

**Site 2 is the instructive one.** Narrowing it to `acceptedUnitId` would have labelled every
referred ward "Suggested destination" — the exact fabrication that badge exists to prevent, because
a referral IS something a person recorded. Its real defect was the `[0]`: `destinationUnit`
recognises only the FIRST referred ward, so on a parallel referral to two wards, selecting the
second compared unequal and the panel announced a real, recorded referral as the system's own
suggestion. Membership is the question, so membership is what is now tested.

**Site 3's line is the general test:** _a fallback is only a lie where something reads it as a
statement._

---

## 7. A mirror is a copy that nothing checks

🔴 **CORRECTED. THE FIRST VERSION OF THIS RULE SAID THE BUTTON RENDERS ENABLED ON A CLOSED MOVEMENT
AND THAT WAS FALSE WHEN WRITTEN.** The claim is withdrawn; the divergence underneath it is real and
measured, and the two are not the same finding.

    8e24c17cf  09:19  officer list has NO closure filter     <- the phantom was genuinely live here
    3ea069b6c  10:01  a closed-movement filter is added      <- the phantom dies
    78f002750  10:19  the tip the finding was reported at    <- filter already present, an ancestor

At the tip it was reported against, `jobs` filters `movement.closure === undefined`. **A closed
movement is not in the list, so there is no row, no button, and nothing to press.** The window was
real and it closed about an hour before the finding was written.

⚠️ **HOW IT HAPPENED, BECAUSE THE MECHANISM IS THE POINT.** The integrator's brief asserted
_"Confirmed reachable, the button is enabled, and clicking it silently does nothing"_ and asked only
WHICH of three mechanisms explained it. The verifier determined the mechanism correctly, by driving
the reducer — **but the reducer knows nothing about which movements the screen lists.** The
reachability half was inherited on trust from a confident sentence in a brief, never re-measured,
and then amplified. **A relayed claim, believed because it arrived with certainty.** The brief was
mine.

### What is measured and stands

All four reducer cases — `TRANSPORT_ACCEPTED` (1527), `TRANSPORT_EN_ROUTE` (1551),
`PATIENT_COLLECTED` (1575), `PATIENT_ARRIVED` (1598) — guard on `movement.closure`. **None of the
four `*BlockedReason` predicates mentions closure at all.** Unchanged by the retraction.

Widened across the other screens: of nine movement-scoped predicates over four files, **seven omit a
precondition their reducer case enforces.** `examinationBlockedReason`, `bookTransportBlockedReason`
(ED) and `pullBlockedReason` (ward) join the officer's four; `handoverBlockedReason` and
`withdrawReferralBlockedReason` do check closure. Three others — `declineReasonBlockedReason`,
`referralDraftBlockedReason`, `transportAnswersBlockedReason` — are draft validators with no reducer
counterpart and do not belong in the same count.

⚠️ **THE HONEST FINDING IS DEFENCE-IN-DEPTH, NOT AN EMERGENCY.** In every case the only thing
standing between the divergence and a phantom control is a **list filter written elsewhere in the
same file** — `ed-screen.tsx:799` filters `!movement.closure`, `ward-screen.tsx` filters through
`isOpen`, the officer list filters `closure === undefined`. **One load-bearing guard, four screens,
and the layer meant to back it up is wrong on seven of nine.** Delete a filter, reuse a screen, or
add a control outside the list, and the phantom returns with no defence. Worth fixing. Not urgent.

⚠️ **`officer-screen.tsx` contained no reference to `rejections` anywhere**, while coordinator, ED,
ward, referrals and morning-tour all read them. **The screen whose gates are furthest from the
reducer was the only one with no channel to report a refusal.** That pairing is what would turn a
wrong predicate into a phantom instead of an error message — so the fix is two things, and the first
must not substitute for the second. Both landed; it now references `rejections` 11 times.

**Required guard shape:** for each `*BlockedReason`, drive every movement it permits through the
corresponding reducer case and assert none is rejected. **Driven over the fixture, never compared by
reading** — a reading-based check is another hand-written mirror and inherits the defect. Floor the
PERMITTED population.

⚠️ **Why nobody found it.** `arrivedBlockedReason` carries a comment claiming it "mirrors
`case PATIENT_ARRIVED` exactly, including the floor guard". **It does mirror the floor guard.** The
specific thing it names as evidence of completeness is true, and it omits closure. A comment that
enumerates what it covers is read as an inventory — and `ed-screen.tsx` then cites those four
functions as the convention to hold to.

---

## 8. "Carry the message across verbatim" is wrong whenever the message states a mechanism

Ward Builder One refused this instruction from the integrator, and was right to.

`tests/ward-management-print.test.ts` carries the best-written failure text in the ward suite. The
integrator told them to preserve it verbatim into its replacement. Measured: **background
declarations on `.patientWorkspace` anywhere in `ward-management.module.css` — zero.** The file's own
comment records that both were deleted. So the message's own justification —

> _"the page's own `background: var(--background)` (the SECOND of its two declarations, which is the
> one that wins) prints as a near-black rectangle in dark mode"_

— names a declaration that does not exist, a first one that does not exist, and a cascade outcome
that cannot occur.

    KEEP     "The reader gets a black page where a movement list should be."   <- the CONSEQUENCE
    DELETE   everything naming the declaration, its order, and what wins        <- the MECHANISM

> **The consequence clause ages well. The mechanism clause is a claim about code, and it expires
> silently the moment the code moves — while reading better than ever.**

⚠️ **And being well written is what makes it dangerous.** A false claim inside the most fluent, most
specific, most clinically grounded sentence in the suite is the most believable false claim
available: it names a token, a declaration order and a cascade outcome, so a reader acts on it
rather than checking it. The person who caught it is the person who wrote it, and they said they
would have believed it.
