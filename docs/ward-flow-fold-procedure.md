# The ward board fold — procedure, list, and the traps

Written 2026-08-29, before the fold, by the session that will run it. Everything here was
established by reading git or the code, not by relaying a claim. Where a fact came from another
session it says so, and it was re-checked before being written down.

**The fold** merges `claude/ward-flow-ward-board` into `claude/ward-flow-phases-6-7-design`, which
stays the main line. Owner's decision.

---

## 1. The owner's seven conditions

Authorised by the owner directly, on these conditions, with the instruction to **stop and ask him if
any of them fails**.

1. **Phase 8 finished and committed**, with its own explicit signal — tip SHA plus confirmation the
   worktree carries no tracked modifications.
2. **A fresh backup, taken and verified** — all three ward branches, bundles and plain copies.
3. **The exact pre-merge tip written down first**, so undoing it is one command.
4. **Both sides have committed everything**, and `merge-tree` is re-run **at that moment**, against
   committed tips only.
5. **The three add/add files taken wholesale from the board side.** Never file-by-file, never mixed.
   **A FOURTH conflict now exists and this condition does not cover it** — see §2a. It is resolved by
   hand, taking both sides, with the Phase 8 session's agreement on the record.
6. **The post-merge check passes** — see §3. **Three legs, all required:** the four name greps (3a);
   a value check that at least one seeded admission carries a non-null `dischargeConfirmedAt` (3c),
   because names alone are blind to fields present and dead; and the stay-band grep (3d), because the
   owner replaced those bands today and nothing else checks his choice survived. A different second
   leg was proposed earlier, read, and rejected (3b) — it is not the same as 3c.
7. **Ward suite green afterwards**, with the route-count failure resolved by making the board screen
   reachable — **never by moving the number**.

### Three clarifications the conditions did not carry, agreed with their author

- **"Not yet" is not "failed".** A precondition that has not arrived is the expected state, not a
  fault to escalate. Escalating "condition 1 is not met" interrupts the owner to report that nothing
  has happened, which is how a safety rule becomes noise and then gets ignored.
- **Condition 2 means at the moment of merging.** A backup of a superseded state satisfies it only on
  paper. A backup is only a backup of the thing you are about to change.
- **Condition 4 is two-sided.** Either branch finishing does not unblock the merge on its own.

### While the owner is away — the three-way split

He is unreachable for roughly six hours and has put the Phase 8 session in the decision seat. That
grant is to that session; it does **not** cancel the specific instruction he gave this one about an
irreversible action. Both sessions agreed the following, and each holds itself to it:

- **All seven hold → merge, without waking him.** That is what he authorised in terms. Waiting for a
  sleeping man to re-confirm what he already confirmed is deferral wearing caution's clothes.
- **One fails → stop, do not merge.** Report the **measurement, not the conclusion**, to the Phase 8
  session. It may investigate and clear the underlying cause properly, after which the condition is
  met on its merits and the merge proceeds on that. It may **not** judge that a failure does not
  matter, and has said it would refuse to.
- **Something the seven did not anticipate → decide it with that session rather than parking it for
  six hours — unless the novel thing is itself irreversible, or would relax a condition in substance
  while satisfying it in form.** Those wait for him. "The conditions did not cover this" is exactly
  how a condition gets routed around without anyone deciding to.

Standing limits are untouched throughout and none is near being tested: nothing pushed, no pull
request, nothing reaching a provider or live database, no protected work deleted. **All local, all
reversible** — which is the property that makes merging without him acceptable at all.

### The conditions are the judgement, not a checklist

They were made and written down at a calm moment. The situations where one looks droppable —
everything else green, the branch finally quiet, late in the day — are precisely the situations they
were written for. **A condition that survives only until it is inconvenient never existed.**

---

## 2. The resolution, and why the wrong answer is the green one

Three add/add conflicts, verified with `git merge-tree --write-tree` and re-verified at every tip
change through the day:

```
src/components/ward-management/ward-admissions.ts
src/components/ward-management/ward-admissions-seed.ts
tests/ward-admission-model.test.ts
```

**Take the board's copy of all three wholesale, then repair Phase 8's test literals.**

The hazard is not an ordinary conflict. `tests/ward-admission-model.test.ts` holds the structural
allowlist asserting the record's exact field set — **so the guard that would catch a wrong resolution
is itself one of the three files being resolved.** Resolving toward Phase 8 removes
`dischargeConfirmedAt`/`dischargeConfirmedBy` **and** the assertion requiring them, in the same move.

| Resolution      | Record fields | Allowlist | Suite                |
| --------------- | ------------- | --------- | -------------------- |
| All three board | 28            | 28        | green, and right     |
| All three P8    | 26            | 26        | **GREEN, AND WRONG** |
| Mixed           | 28            | 26        | red                  |

**The fully-wrong resolution passes. Only the half-wrong one fails.**

**Expiry.** This resolution is correct only while Phase 8 has not independently edited those three
files. Verified: its only commits touching them (`a039940b5`, `4c3c4625a`) are cherry-picks of the
board's own commits. **Re-run `merge-tree` immediately before folding and confirm the conflict set is
still exactly these three.**

### 2a. The fourth conflict — `tests/ward-nav.test.ts`

Appeared the moment the board branch committed its nav edits. Both branches had edited the file once
since the merge base, so it was always going to conflict; it was invisible until then because
`merge-tree` cannot see a working tree. **Every clean answer about this file earlier in the day
described a branch where those edits did not exist.**

**Wholesale is wrong from either side.** Measured on all three:

| Side       | Routes | `exampleOnly` entries |
| ---------- | ------ | --------------------- |
| merge base | 20     | 2                     |
| board      | 21     | 3                     |
| Phase 8    | 21     | 2                     |
| **merged** | **22** | **3**                 |

Each branch added one route and neither has the other's. The board's copy would claim 21 against a
tree of 22; Phase 8's would be wrong twice.

**Resolution, agreed with the Phase 8 session:** resolve by hand, taking **both** route additions —
count 22, both new routes named in the comment the way the existing ten are, and the board's
three-entry `exampleOnly` set. Fold-list item 3 goes in the same edit: assert the **set** of
`exampleOnly` ids rather than the count.

**Condition 7 is satisfied, not bent — checked rather than assumed.** Both new routes are genuinely
linked before the number moves (`ward-nav.ts:89` for the board screen, `:101` for out-of-area), so 22
is the honest count of two reachable screens rather than a silenced alarm. Reachability first, number
second, which is the order the condition demands.

**There is no `exampleOnly` off-by-one**, despite a report of one. A `grep -c 'exampleOnly: true'`
returns 3/4/3 because a **comment** on line 72 describes the flag. Excluding comment lines gives
2/3/2, exactly matching what the test asserts. Nothing carries the flag uncounted.

That near-miss is worth keeping: the first count was a word-occurrence proxy, its author spotted that
and corrected it — and **the correction was also a proxy, one layer down**, specific enough to look
like the real measurement. It nearly produced a recommendation to derive the expected set from the
source being checked, which would have made the assertion a check that cannot fail — the exact thing
`ward-admissions-seed.ts` refuses in its own header. **The hand-written expected set is the
assertion; if both sides come from the same place, nothing is checked.**

---

---

## 3. The post-merge check — one leg that works, and one that was rejected

### 3a. The four greps (primary)

Per-file, because a single-file check passes a **mixed** resolution while eight seed references go
silently. Counts measured on the board branch; Phase 8's copies read 0 for the first three.

```bash
grep -c dischargeConfirmed   src/components/ward-management/ward-admissions.ts       # >= 4
grep -c dischargeConfirmed   src/components/ward-management/ward-admissions-seed.ts  # >= 8
grep -c confirmedHoursAgo    src/components/ward-management/ward-admissions-seed.ts  # >= 8
grep -c dischargeConfirmedAt tests/ward-admission-model.test.ts                      # >= 4
```

`confirmedHoursAgo` is a **seed** figure and correctly reads 0 in `ward-admissions.ts` — aimed at that
file it fails on a correct resolution.

**It is a grep _because_ a test run cannot see this.** State the reason, not just the command, or
somebody later downgrades it to "the suite passed".

### 3b. The witness that is not one — REJECTED, and why it is worth recording

`tests/ward-board-consistency.test.ts` was proposed as an independent second leg, on the reasoning
that it is an add on the board side only — so not in the conflict set, and undeletable by the
resolution — while importing `bedIsOccupied` and `Admission` from `ward-admissions.ts` and
`wardAdmissions` from `ward-admissions-seed.ts`.

**Half of that reasoning was right and it is the useless half.** It is indeed beyond the
resolution's reach. It also **cannot detect the failure that matters.** Measured:

| Check                                                  | Result                                      |
| ------------------------------------------------------ | ------------------------------------------- |
| References to `dischargeConfirmed`/`confirmedHoursAgo` | **0**                                       |
| `bedIsOccupied` on the two branches                    | **byte-identical** (`pulled \|\| occupied`) |
| Occupant lines in the two seeds                        | **259 on both**                             |
| Source of the left-hand figures                        | `ward-sites.ts`, not in the conflict set    |

Its assertions are `beds − empty − blocked === occupied` and `occupied ≤ beds`. Under the
**fully-wrong** resolution nothing it reads has changed: same occupancy function, same unit figures,
same occupant count, and the two deleted fields invisible to both assertions. **It passes.**

What it would catch is a **mixed** resolution — which 3a already catches, and which was never the
dangerous case. So it is blind to the failure that matters and redundant on the one that does not.

**That is worse than having no second leg**, because it would have been reported as independent
corroboration of a resolution it never examined. It is the day's own failure shape — a check
answering a question adjacent to the one being asked — arriving one layer further out, inside the
mechanism built to catch that shape. It was written into this document as a witness before anyone
read the test.

**What would make it a witness**, if anyone wants the second leg: an assertion on a property only the
board's data can satisfy — that at least one admission carries `dischargeConfirmedAt`, or that some
unit reaches the `confirmed` discharge stage at all. Unsatisfiable under Phase 8's copies, so it goes
red **by name**, saying which thing vanished rather than that an arithmetic identity broke. Until
such an assertion exists, there is no second leg.

**3a remains load-bearing and is not softened by any of this.** A grep on something the resolution
cannot delete is the check that works — **but it is not sufficient on its own.** See 3c.

### 3c. The value check — REQUIRED, and it closes a hole in 3a

**3a greps field NAMES. The seed builds those fields conditionally**, so a name can be present and
its value dead:

```
165:  const isConfirmed = confirmedHoursAgo !== undefined;
180:  dischargeConfirmedAt: isConfirmed ? WARD_ADMISSIONS_ANCHOR - confirmedHoursAgo * 60 : null,
184:  dischargeConfirmedBy: isConfirmed ? DISCHARGE_DATE_SETTERS[...] : null,
```

Force `isConfirmed ?` to `false ?` and every confirmed discharge in the network becomes `null` while
the field names are untouched. **Demonstrated, not reasoned about** — simulated on a copy of the
committed seed:

```
after mutation:  dischargeConfirmed 8   confirmedHoursAgo 8   -> condition 6 PASSES
                 and every confirmed-discharge value is dead
```

So 3a catches _fields deleted_ and is blind to _fields present and dead_. It was written against the
resolution failure, and nobody asked what else produces the same grep output.

**The cover is a VALUE assertion**, and this is why it is not the 3b that was rejected. That one never
referenced the disputed fields and passed under the wrong resolution. This one asks whether at least
one seeded admission carries a **non-null** `dischargeConfirmedAt` — precisely what a name grep cannot
see. It reddens on the deletion **and** on the dead-value case.

**Condition 6 is therefore two legs, and the second is not optional:** the four name greps, plus at
least one non-null `dischargeConfirmedAt` in the merged seed. This strengthens the owner's condition
rather than relaxing it, which is why it did not wait for him.

**The remedy is part of the check, and must not be separated from it.** A red here means **the
confirmed-discharge data was lost in the resolution, and the fix is to re-resolve toward the board's
copy.** It is **never** to add a confirmed date to the seed by hand.

That matters because this leg, unlike the greps, is **satisfiable the wrong way**. "At least one
non-null `dischargeConfirmedAt`" can be made true by re-resolving correctly, or by one hand-edited
seed row — and the second makes it green while the merge stays wrong, and looks like a fix, because
the assertion now passes. It is the route-count failure in a new place: **an alarm whose cheapest
silencing is not its intended remedy.** A check whose remedy is not written beside it is one tired
person away from being satisfied in form.

The failure mode of a tightened check is not that it blocks a good merge — that costs delay and is
recoverable. It is that the red gets satisfied the cheap way.

### 3d. The stay bands — a third grep, and a stale "verbatim" record

The owner's stay bands **changed today** and the two branches hold different sets. Both live in
`ward-admissions.ts`, which is in the add/add set, so the wholesale rule already protects them — but
**nothing checks that it worked**, and the witness in 3c covers the discharge fields only.

| Branch  | Bands                                                                | Introduced                        |
| ------- | -------------------------------------------------------------------- | --------------------------------- |
| Phase 8 | `under-1-week` · `1-4-weeks` · `1-3-months` · `over-3-months`        | `4c3c4625a`, 2026-08-29 **03:49** |
| board   | `under-2-weeks` · `2-weeks-1-month` · `1-3-months` · `over-3-months` | `1d2f64c5f`, 2026-08-29 **12:25** |

`1d2f64c5f` reads "Replace the stay bands with the owner's four: 2 weeks / 1 month / 3 months". **The
board's set is the owner's later decision and Phase 8's is the superseded one.** Third leg for
condition 6:

```bash
grep -c 'under-2-weeks' src/components/ward-management/ward-admissions.ts   # >= 1
```

**And a trap for whoever reads the handover.** `docs/ward-flow-handover-2026-08-29.md:171` states:

> **Stay bands, verbatim:** under 1 week · 1–4 weeks · 1–3 months · over 3 months.

That is the **superseded** set, and **three things armour it at once** — checked in the document as it
stood at `98a4a77a7`, not recalled:

- the word _verbatim_ on the line itself;
- the heading directly above it, **§6 "The owner's decisions that must not be re-litigated"**, which
  tells the reader not to question what follows;
- a separate standing rule at **line 192 (§7)** — "Verbatim rule unchanged; no agent may alter them."
  Its subject is "the three approved lists", which is nowhere defined as including the stay bands, so
  whether it strictly governs this line is genuinely unclear. An unclear rule cited by a
  conscientious reader points the same way as a clear one.

So the authoritative record instructs a future reader to "restore" bands the owner replaced nine hours
later, and **the apparatus protecting his decisions is what would carry the reversion**.

Fixed at `a1c733cdf`, in **three** documents — the handover, the board design spec (`:266`) and the
plan (`:28`). The plan was the worst: eight further occurrences of the old ids inside task bodies as
literal code samples, so a reader who skipped a corrected header and copied a sample would
reintroduce the superseded set out of a document that had been "fixed". Those samples were
**deliberately not rewritten** — back-dating a plan's code to match a later decision destroys the
provenance that made this findable — and the header now states that the code is the authority.

### 3e. Check for the ABSENCE of the superseded value, not only the presence of the current one

A presence check cannot see a wrong thing sitting alongside a right one. `under-2-weeks` returning 5
proves the owner's bands arrived; it does not prove the superseded ones left. Only the pair rules out
a mixed resolution:

```bash
grep -c under-2-weeks src/components/ward-management/ward-admissions.ts   # >= 1   the current set arrived
grep -c under-1-week  src/components/ward-management/ward-admissions.ts   # == 0   the superseded set left
```

Contributed by the ward board session, which ran the absence half at the fold **without being asked
for it** — nothing in this procedure required it. It generalises past stay bands to any supersession:
whenever a value replaces another, assert both that the new one is there and that the old one is
gone, or a resolution that kept both passes every check you wrote.

**Cheap belt-and-braces before taking the board's copy of `ward-admissions-seed.ts`:** compare its
blob id against the known-good `f56fe635671e4325d0b3f70891d35e3a497cf389` at `3ca0bb676`. One command,
no test run, and it closes the window in which a mutated seed could be committed and taken wholesale.
That branch has already had one commit go wrong through a `||` fallback that succeeded unexpectedly,
and one false `RESTORED` verdict.

**If it goes red, the first hypothesis is an incomplete assertion, not a broken seed.** Reported by
its author: written first as `beds − occupied === empty`, it failed on four units, each off by
exactly one blocked bed. The fixture was right and the assertion was incomplete. That has now been
the correct direction twice.

---

## 4. The list

Items to do **at** the fold, on the merged tree, by whoever can see both sides.

1. **The per-unit board link** in `ward-role-switcher.tsx`, beside the existing ward link. The board
   chat added the rail entry; it could not add this because the file is Phase 8's. Neither branch has
   touched it since the merge base, so it is uncontested.
2. **The route count**, only after 1 — the board screen made reachable, then the number moved with the
   new route named in the comment the way the existing ten are. Never the number alone.
3. **The `exampleOnly` assertion as a set, not a count.** It currently asserts exactly two nav entries
   are `exampleOnly`; the board makes three, and raising the count weakens it. Asserting the set of
   ids makes a fourth a deliberate act.
4. **Union-key `WARD_NAV_ICONS`.** Typed `Record<string, LucideIcon>`, so a missing icon is caught by
   a test rather than the compiler. Its sibling `WARD_VIEW_ICONS` is `Record<WardMode, LucideIcon>`
   and is compiler-guarded. **This is an improvement, not a hole** — `tests/ward-nav.test.ts` does
   catch it, and an earlier claim that nothing did was wrong.
5. **Data work, tiers 1 and 2 only, and only on the owner's word to this session.** See §5.

Carried, not owned by the fold:

6. **The network diagram has no `@media print` block** and prints zero unit nodes in both modes.
   Pre-existing, not a fold regression — recorded in the issue inbox before the fold precisely so it
   is not later attributed to the merge.

### Still owed after the fold — deliberately not done in it

**The per-unit board link.** `ward-nav.ts` links ONE seeded example of the ward board; every other
ward's board is reachable only by typing its address. The obvious home is a second group in
`ward-role-switcher.tsx` mirroring the existing "Ward" group — but that adds a second full list of 23
units to a menu that already carries one, and the better design may be a link on each ward's own
screen ("open this ward's board") rather than doubling the switcher.

That is a product judgement about a screen, not a mechanical fix, and **this project's entire
screen-defect history was found by rendering and looking** — never by a static test. So it is left
undone rather than guessed at, with both candidate shapes recorded. It needs someone to look at the
menu at three widths and decide, which is the owner's kind of call.

---

## 5. The data work, and its boundary

The owner has asked that everything liable to change — wards, distances, options, place names, bed
numbers — be easy to edit, so real figures can be dropped in later and real-world changes (a new
hospital, more beds) can be absorbed.

Measured, it is three jobs of very different size:

1. **Cheap and safe.** Place names, pick-lists, distances. One obvious place each.
2. **Moderate, and the real irritant.** Bed counts. Changing one unit's `beds` from 20 to 26 leaves
   `empty`, `allocatable`, `held`, `blocked` and both halves of `sexMix` wrong or arbitrary, plus the
   occupant lines in the seed — seven edits, two files, every one silent if missed. Keep the figures
   **authored**; add a check that fails loudly and says in plain words what else to change.
3. **Expensive, and a design decision.** Deriving occupancy from occupants. **Not authorised.**

**Why tier 3 is not a tidy-up.** `sexMix` is not fixture data: `ward-flow-reducer.ts:653` writes it as
the demo runs. A seed-derived `sexMix` would be right at load and wrong the moment anyone moves. To
derive it honestly you must derive from the **live** admissions, which merges the units model and the
admissions model into one — and eight source files read `sexMix` today.

**The trap inside tier 3, and it lands in a file being resolved.**
`ward-admissions-seed.ts`'s own header says it deliberately does **not** read `sexMix` back and top
itself up, "because a fixture that derived itself from the number it is checked against could never
disagree with it, and the check would be a check that cannot fail". So the obvious way to make the
seed easy to edit is the precise thing it was written to refuse — and it would remove a guard while
making the suite greener, in the same file whose wrong-but-green resolution is already this fold's
sharpest hazard.

**Shape versus budget.** The owner has approved a shape, not a budget. "One obvious spot each"
describes the desired end state; nobody has measured the work. If the coupling map shows tier 1 is
materially larger than that phrase implies, that is a new conversation.

---

## 6. Running the suite

- **Discover the suite from disk — 62 files — never a hand-picked list.** A hand-picked subset has
  shipped a red test on this programme twice.
- **Quote the `Tests N passed (N)` line, never the exit code.** Results are memoised; use
  `GATE_RECEIPTS=refresh` when fresh evidence is the point.
- **A refusal citing capacity, or exit 75, means BLOCKED — retry.** It is not a failure. The
  registration script now reports `no-result`/`blocked` distinctly from `failing`, which is exactly
  the distinction needed under lock contention.
- Run the ward suite on **both branches before merging** and again after. A red that predates the
  merge looks caused by it unless somebody establishes otherwise first — which is how
  `ward-nav.test.ts` was found already red on the board branch.

---

## 7. Two things not to misread afterwards

**`git merge-tree` is structurally blind to a working tree.** It compares committed tips, so a clean
answer describes a branch in which any uncommitted edit does not exist — and nothing in its output
says so. This produced a confident all-clear about four shared nav files whose edits were uncommitted
while Phase 8 had already committed to all four. **Re-run it only against committed tips, with both
working trees confirmed clean.** A clean `merge-tree` over a dirty tree is not a clean merge.

**The coincidence is a coincidence, not a safeguard.** Through the wait, the files needing
restructuring were unavailable to both sessions for unrelated reasons — contested on one side,
unauthorised on the other. Nothing went wrong while we waited. That is not evidence the process was
sound, and after the merge the alignment disappears: the owner's word becomes the only gate.

---

## 8. What "add a hospital" actually costs — the coupling map

Produced by the ward board session, read from source with **no test run**; its negative results came
from a delegated sweep rather than line-by-line verification. Two items below were re-verified here
before being written down, and say so.

### The one that loses data silently

**`HealthService` has no runtime array.** `ward-model.ts:9` declares it as a bare type union —
**verified here**, and it is the only multi-value union in that file without a companion array, while
`COHORTS`, `SEXES`, `URGENCY_LEVELS`, `SEX_DESIGNATIONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`,
`BED_RELEASE_STATES` and `BED_RELEASE_WAITING_ON` all have one. Three hand-written copies of the five
services exist — the union, `wardServiceOrder` (`ward-derivations.ts:88`) and `columnServices`
(`ward-management-network.tsx:46`) — and no test checks any for completeness.

**Add a hospital in a sixth service and it compiles clean while that service vanishes from the network
map, the flow diagram and the ED screen's unit table.** `ward-model.ts`'s own `COHORTS` comment
records this having already happened once with `Cohort`. This is the single silent-data-loss hole in
the feature, and it sits exactly where the owner asked us to look.

### Adding is not additive

`ward-movements.ts:682` assigns EDs by `eds[index % eds.length]`, and `:580` does the same for
accepted units. **Adding an ED or a unit permutes existing demand** rather than appending to it.

### Assertions that will go red on a bed edit

`ward-capacity-reconciliation.test.ts:27` (23 units) · `ward-model.test.ts:108` (8 origin EDs) and
`:68` (Peel has 0 units) · `ward-morning-rollup.test.ts:579` (5 services) ·
`ward-flow-provider.dom.test.tsx:48,51` (48 movements, 23 units) · `ward-scenarios.test.ts:36,40`
(>300 eligible pairs, **exactly 2** stranded).

The last is the nasty one: both numbers are emergent from every unit's allocatable, sexMix, cohort,
security and designation, so **any** bed edit anywhere can flip them — and the failure message talks
about stranded patients rather than about beds. Convert it to a property first; the weaker assertions
it needs already exist at `:47` and `:53`.

### `Unit.held` — a dead-data candidate, not a deletion

Every read of held is `capacity.held`, the value **derived** by `unitCapacity()`. Nothing reads the
authored `unit.held`; it is declared once and authored 23 times. That is 23 numbers the owner would
be asked to maintain that change nothing on any screen — directly contrary to what he asked for.
**But** `AGENTS.md` is explicit that "nothing imports it" is necessary and nowhere near sufficient,
and `npm run check:dead-code-candidate` exists for precisely this. Post-fold, through that gate.

### Two name leaks in a file being merged

`ward-nav.ts:83` and `:90` hardcode `"Ward — RPH Adult Secure"` and `"Ward board — RPH Adult Secure"`
as label strings. Rename the unit in the seed and the nav label silently lies; nothing checks it.
Line 90 was added today — the same class of defect the owner has just asked to be eliminated,
introduced in the session that was told about it. Disclosed by its author unprompted.

### The convention is enforced but undocumented

`tests/ward-flow-single-source.test.ts` walks the AST of every file under `src/` and restricts reads
of `allUnits`/`unitById` to three named files — real, mechanical enforcement. Two caveats: it names
the **functions**, not the module, and `board/ward-board.tsx:18` imports `wardSites` directly to work
around exactly that, saying so in its own comment. And the sentence "network facts live in five seed
files" appears nowhere in `docs/` or `src/`: the convention lives in code and in nobody's
documentation, and it is nine files, not five.

### The seed insight, and its limit

Proposed: derive the row **count** from `beds − empty − blocked`, keep row **content** hand-authored.
The seed's guard argument covers **which** occupants — sexes, regions, stay lengths — and the sexes
would still be hand-chosen and still compared against a hand-authored `sexMix`, so
`ward-admissions-seed.test.ts:207` can still fail. The guard survives. Genuinely new reasoning: the
file's comment does not address the count/content distinction either way.

**Its limit, which the proposal does not state.** Deriving the count makes a wrong count _detectable_;
it does not create the six missing occupants when `beds` goes 20 → 26. It is a better tier-2 check,
not a way to skip authoring rows.

### Docs already stale — the proof this is not hypothetical

`docs/ward-flow-context.md:231`, `docs/codebase-index.md:384` and `docs/ward-flow-phase-handoff.md:36`
all say 22 units; the code has 23 since `bty-youth` landed in Phase 7. `ward-scenarios.test.ts:25`
still says "all 22 units" with a distribution measured before that unit existed.

### Recommended order, when authorised

1. `Unit.held` through the dead-code gate. 2. Give `HealthService` a runtime array and derive both
   service lists from it — **the one that prevents silent loss**. 3. Write the editing guide, since the
   convention is enforced by an AST test and explained nowhere. 4. A read-only `check:ward-data` with
   plain-English messages. 5. Loosen the fragile counts to properties.

**Explicitly not recommended yet:** moving sites and units to JSON. The capacity figures carry
`NOW_ANCHOR` offsets, `ward-sites.ts` is the most-imported file in the feature, and its doc comments
are load-bearing in a way JSON cannot hold.

---

## 9. The fragile assertions — handed to this session, not yet authorised to it

Six assertions pin numbers or identities the system **derives** rather than anything a person
authored. They go red on any bed-number change anywhere in the network, and they fail with a message
about stranded patients or priority ordering rather than about beds.

```
tests/ward-scenarios.test.ts:36    > 300 eligible movement/unit pairs
tests/ward-scenarios.test.ts:40    EXACTLY 2 movements with nowhere eligible
tests/ward-escalation.test.ts:41   the exact id set ["WF-009","WF-308"] on the standard night
tests/ward-escalation.test.ts:49   the exact nine-id set on the scarce night
tests/ward-priority.test.ts:270    the exact top-five priority order
tests/ward-handover.test.ts:99     ["WF-009"] as the only placement-gone-wrong
```

**Why it is worth doing before the real numbers arrive.** The owner is going to supply real bed
numbers for all 23 wards. If these are still pinned when he does, his first attempt produces a wall
of alarms about the wrong subject — exactly the experience the whole request exists to prevent.

**But it carries no deadline, deliberately.** One was attached and then withdrawn by the session that
attached it. A deadline on work that is neither authorised nor yet possible is pressure with nowhere
to go, and the first thing it costs is the two cautions below — which is a fair description of how
good advice becomes bad work. **If the real numbers arrive first, he hits some confusing failures and
they get fixed then.** That is annoying, and far cheaper than six assertions loosened in a hurry.

**Why it is not simply "loosen them".** Two cautions, both from the session that found them, both
worth more than the task:

- **A check you believe is redundant is a hypothesis too.** Mutate each one and watch the loosened
  version still catch what the original caught, before trusting it.
- **Four of the six pin an exact ID SET**, which catches "the **wrong** patient got stranded". A bare
  count does not. Loosening those to counts loses real coverage — they may need a _different_
  property, not a weaker one. And because these numbers are emergent, they are the closest thing the
  suite has to an end-to-end witness that the network still behaves; removing them outright would be
  a genuine loss.

For `ward-scenarios.test.ts` the weaker assertions already exist at `:47` and `:53`, so a property is
available without inventing one.

**Status: not authorised to this session.** Every one of these files exists on Phase 8's branch, so
the work cannot happen before the fold in any case. The owner's approval for it was relayed by
another session; this session acts on his word to it, not on a relay. Both constraints point the same
way, which is a coincidence and not a safeguard (see §7).

**The shape the replacement has to take**, converged on by two sessions after the first suggestion
was found weaker than what it replaced:

- **Relational, not absolute.** e.g. the scarce night's stranded set strictly **contains** the
  standard night's. Survives a bed edit; still fails if the wrong thing moves.
- **Re-derived through the production path.** e.g. every stranded movement has no eligible unit
  **under the same eligibility function the app uses**. This is the stronger of the two, because it
  re-derives the claim rather than restating a measured answer — it still catches the wrong person
  being stranded, and a bed edit moves the answer and the assertion together.

---

## 10. Live hazard at the time of writing

**`src/components/ward-management/ward-admissions-seed.ts` is MUTATED on disk in the ward board
worktree** (`D:/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231`). Verified here by blob
id, not relayed:

```
working copy   313a720864778b60fe32f570845b79b39c754c79
committed      f56fe635671e4325d0b3f70891d35e3a497cf389   (at 3ca0bb676)
```

It is deliberate — line 180's `isConfirmed ?` forced to `false ?`, to prove the new witness assertion
actually bites. **It is one of the four conflicted files.**

**Recovery, if that session ends before restoring it:** the file is **tracked and committed**, so an
ordinary `git restore` of that path returns it, and it does not depend on any scratchpad copy
surviving. The standing warning that a checkout cannot undo a mutation applies to **untracked** files;
this one is tracked, so the ordinary path works. Confirm afterwards with `git hash-object` against
`f56fe635…` regardless — the entire point of the exercise is not to believe a restore happened because
a command exited 0.

**Do not merge while this is outstanding.** Not because `merge-tree` would be wrong — it reads
committed tips and is unaffected — but because condition 4 requires a clean tree on both sides, and a
mutated file inside the merge set is precisely the state that condition exists to exclude.

**The lesson underneath, which outlives the hazard.** The witness test held four assertions in one
case, and Vitest short-circuits at the first failure — so one mutation could only ever exercise the
third, while the case as a whole reddened and looked thoroughly verified. **An assertion sitting
behind a sibling in the same case cannot be individually proven.** Found inside a test whose entire
purpose was to be a reliable witness. Split such a case into one assertion per case, or accept that
only the first reachable failure is ever demonstrated.

---

## 11. The pre-merge record (condition 3)

Written **before** the merge, so undoing it is one command.

```
phase8 (merge target)  claude/ward-flow-phases-6-7-design  9cd9acf096ba0144b8baf1692ddf98ee8c598b8e
board  (merge source)  claude/ward-flow-ward-board         f341d5db7ce5b3ccb24f7118bb0944ec11d0d199
merge base                                                 15bdddda1e122d9ba49ef081b8e2f7010ee5f5d7
```

**Undo, if the merge must be abandoned after it lands:** hard-reset
`claude/ward-flow-phases-6-7-design` back to `9cd9acf096ba0144b8baf1692ddf98ee8c598b8e`. Nothing is
pushed, so that is the whole of it.

**Verified at these exact tips, not earlier and not from a note:**

- Phase 8: **0** tracked modifications (checked with `--untracked-files=no`, which proves the working
  tree matches `HEAD` for every tracked file — so no mutation is left applied anywhere). 37 untracked,
  all `.tmp-*` scratch, **none under `src/` or `tests/`** — checked, not assumed.
- Board: **0** tracked modifications, **0** untracked.
- `merge-tree` at these two tips: the same **four** conflicts, no fifth.
- Backup `2026-08-29T080448Z` — 967 files, 576M, verified bundles, naming **both** tips above plus
  `main`. A backup of the thing about to change, per the clarification to condition 2.

**Conditions 1, 2, 3 and 4 are met.** 5, 6 and 7 are performed during and after the merge.

**Blocked on one physical thing, not a procedural one:** the merge target branch is checked out in
the Phase 8 worktree, and git will not allow a second checkout of it. That session has been asked to
stand down explicitly — in words, not by going quiet.
