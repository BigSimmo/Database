# Bed-figure wording census — 2026-09-04

## ⚠️ THREE OF THIS DOCUMENT'S OPEN QUESTIONS WERE RULED ON 2026-09-04. READ THIS FIRST.

**The questions below were put to the owner and answered. The findings stand; the questions do not.**

| what this document asks                                                         | the ruling                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| §2 — seven words for `min(allocatable, empty)`                                  | **"Ready", everywhere.** One word.                                                    |
| §1.1 — should the cluster header sum raw `allocatable`, or what the cards show? | **It means what its cards mean.** The header's ARITHMETIC changes, not only its word. |
| the ward index — any figures at all?                                            | **Names only**, and settle the word before the layout.                                |

⚠️ **§1.1 IS NOT A WORDING FIX AND MUST NOT BE DONE AS ONE.** Renaming the header's word without
changing its arithmetic leaves two different numbers under one label — **worse than two labels for
one number, because a reader can at least notice the second.** Arithmetic first, wording second.

⚠️ **AND RENAME BY THE ARITHMETIC, NEVER BY THE WORD.** Several sites say "available" or "free"
about a DIFFERENT quantity — raw `allocatable`, or raw `empty`. Relabelling one of those "Ready"
puts one number's name on another number, which is the exact defect this ruling exists to end.
§2's table below groups by WORD and is therefore the wrong instrument for the rename; a
site-by-site classification by computed expression is being made separately.

**§1.2 (one gate name, two pass conditions) is CLOSED and was never a defect** — the divergence is
deliberate, and the guard that makes the looser gate safe is `PATIENT_ARRIVED` in the reducer,
three events downstream. Comments at both gate sites now point at it.

**§1.3 (two "excluded" counts) is REACHABLE, established after this document was written** — by
nothing more than the app being open more than a day after a discharge. The defect is on
`discharge-board`, which counts a COMPLETED discharge into a footer reading "expected beyond
tonight". `capacityBreakdown` is correct. Not yet repaired.

---

## Coverage, first, because a list without it reads as complete

|                                                             |                                       |
| ----------------------------------------------------------- | ------------------------------------- |
| `.tsx` under `src/components/ward-management/`              | **54**                                |
| **Examined**                                                | **53**                                |
| Never opened — escalated to the owner                       | 1 — `escalation/escalation-board.tsx` |
| Unexamined                                                  | **0**                                 |
| Design prototypes under `docs/ward-flow/design/prototypes/` | 10 of 10                              |

Method: five extraction passes (Sonnet), each required to strip comments before concluding a file
"says" anything, to use two controls of deliberately different shapes, and to name any file it could
not read. **Every finding below that is called verified, the coordinator read in the source.**

⚠️ **MEASURED AT `ee6fdb183`, AND ONE ROW IS ALREADY SUPERSEDED BY UNFOLDED WORK.** A census is a
photograph. `12476d02c` on Ward Builder Three's branch — **not folded at the time of writing, and
still absent from both this branch and the master line, checked** — renames `ward-screen.tsx`'s hero
wording:

    :787   "free bed{s} on this ward right now"   ->  "ready bed{s} on this ward right now"
    :799   "{unit.beds} beds · {available} free"  ->  "{unit.beds} beds · {available} ready"

and adds `tests/ward-screen-capacity-wording.dom.test.tsx` to hold it. **When that folds, the `"free"`
row in §2 collapses into the `"Ready"` row and the count of distinct renderings drops from seven to
six.** The reason for the change is itself a §2 finding: the hero called `min(allocatable, empty)`
"free" while the breakdown on the same screen called it "Ready" and showed "Held" beside it —
`held = empty − available`, the empty beds the figure excludes. **So "free beds" understated the
ward's empty beds whenever `held > 0`.**

**The board-versus-mockup row is untouched by it**, and the owner's question about the product's
actual term is deliberately left open rather than answered by an implementer.

⚠️ **This is a census of RENDERED WORDS.** An internal variable name is not in scope, however
suggestively it collides — see "Rejected" below, where one was nearly filed as a conflict.

---

## 1. Same word, different derivation — the list that can hurt somebody

### 1.1 🔴 `"ready"` means two different arithmetics on one screen, and the header is the sum of the cards

`ward-management-network.tsx`, verified in source:

    line 1023  cluster header   units.filter(service).reduce((s, u) => s + u.allocatable.value, 0) + " ready"
    line  324  per-unit card    `${capacity.available} ready`   where capacity.available = min(allocatable, empty)

**The header sums a different quantity than the cards beneath it show, under an identical word.** A
ward that has confirmed 3 allocatable with only 1 bed empty contributes **1** to its own card and
**3** to the header above it. Nothing on screen distinguishes them.

This is arithmetic, not phrasing, and it is on a network overview a coordinator reads to decide
where to look first.

**Two candidate repairs, and choosing between them is a design decision, not a cleanup:**

1. **Make the header sum the cards** — `min(allocatable, empty)` per unit, then total. The header
   then means "beds you could fill in this service right now".
2. **Make the header say something else** — keep the raw total and label it what it is
   ("confirmed allocatable"), so the two numbers stop competing for one word.

Which is right depends on what a coordinator is meant to learn from a cluster header, and that is
the same question already with the owner about `"free"` versus `"you can fill today"`. **It should be
one answer, not three.** Not repaired here.

### 1.2 One gate name, two pass conditions

`ward-eligibility.ts`, verified in source:

    line 201  eligibility()          gate "allocatable_bed"  pass: unit.allocatable.value > 0
              detail: `${unit.allocatable.value} allocatable`
    line 396  referralEligibility()  gate "allocatable_bed"  pass: availableNow > 0
              detail: `${availableNow} available now (${allocatable} allocatable, ${empty} empty)`

**A ward with `allocatable = 3` and `empty = 0` PASSES the movement path's gate and FAILS the
referral path's.** The rendered words are honest in each case — "allocatable" for raw allocatable,
"available now" for the minimum — so this is not a wording drift. **It is a shared name inviting the
assumption that two different tests are one test.** Whether the difference is deliberate is a
question for whoever owns the eligibility model.

### 1.3 `"excluded"` counts two different populations, in rendered copy

    discharge-board.tsx footer   "{n} release{s} excluded — expected beyond tonight."
    morning-page.tsx             "{n} bed{s} excluded from the figures above — expected beyond tonight."

Verified in source: `groupDischarges` increments its count **before** testing `state === "discharged"`
and `continue`s; `capacityBreakdown` `continue`s past discharged **first**. So a discharged release
banded beyond-today is counted by one surface and not the other, and the nouns differ too
("release" / "bed").

⚠️ **Not established: whether a discharged release can carry a beyond-today band in practice.** The
difference is structural; its reachability was not measured. Stated as a difference, not a defect.

---

## 2. Different words, same derivation

**Seven renderings of `min(allocatable, empty)` — the beds a coordinator can actually fill:**

| words                                              | where                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `"you can fill today"`                             | ward-board headline                                                                |
| `"Available now"`                                  | ward-board triage bar, network tooltip, modes headline cards, morning-page         |
| `"free"`                                           | ward-screen — `"{n} beds · {m} free"`                                              |
| `"Ready"` / `"ready"`                              | ward-screen chip, network print label, network aria-label, flow-diagram, shortlist |
| `"Now"`                                            | ward-management-modes row chips                                                    |
| `"{n} available now ({n} allocatable, {n} empty)"` | referral path gate detail                                                          |
| `"no bed free"`                                    | referral-intake, as the absence of the same quantity                               |

⚠️ **`ward-board.tsx` disagrees with itself two sections apart** — headline `"you can fill today"`,
triage bar `"Available now"`, same value. **Drift inside a single file is the strongest evidence that
this is a vocabulary problem rather than a discipline problem.**

---

## 3. How the words attach to the number — this kills the obvious fix

| class              | rows  | meaning                                                                                                        |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------- |
| **DERIVED**        | **1** | the words change with the value — `constraintSentence()`, "None will take a man" vs "Only 2 will take a woman" |
| **WRITTEN BESIDE** | ~6    | a hardcoded label in a separate node: `<dt>Available now</dt><dd>{n}</dd>`                                     |
| **MIXED**          | ~34   | number interpolated beside a hardcoded noun: `` `${n} free beds` ``                                            |

⚠️ **The recommendation to "share the sentence as well as the figure" is WITHDRAWN, and recorded as
withdrawn so nobody finds it later without the reason.** A shared phrase helper reaches **one row in
about forty**. The dominant shape is a number interpolated next to a hardcoded noun, where the figure
stays correct forever and the word quietly stops matching what was computed. **A helper cannot fix
that, because it cannot know which of the seven meanings a given screen intends.**

**This is a vocabulary problem, not a plumbing one.**

---

## 4. The clean finding, and it is the best news here

**Five statistics screens render no bed figure at all and say so in prose** — _"Beds, occupancy and
availability … are not repeated here."_ **No test enforces it.** `ward-index.tsx` was independently
confirmed to render no digit of any kind.

**So the restraint the ward index is under is already the settled practice on six neighbouring
screens, arrived at by people rather than by a guard.** That is evidence the restraint is sound
whatever its provenance — and evidence that it does not need a test to hold.

---

## 5. Withdrawn and rejected — recorded, because an unrecorded retraction gets re-found

**WITHDRAWN — the referral intake probe.** Reported as a screen saying `"N of M units accept this
referral right now"` while computing for a fabricated patient. **Measured: `referralEligibility()`
reads exactly one referral field — `ageBand` × 6, nothing else — and the probe passes the real one.**
Every invented field is inert. Nine gates, not twelve; no distance gate exists on that path. **The
figure is accurate.**

**What survives is a FRAGILITY, not a falsehood:** the intake and match sentences are byte-identical
and computed differently, and they agree only because the single field that matters is passed
through. **Add one gate reading another referral field and the intake sentence silently becomes false
while the match sentence stays true.** A catcher would assert that the set of referral fields
`referralEligibility` reads is exactly `{ageBand}`.

**REJECTED — `excludedBeyondToday` as a name collision.** Two functions share the identifier across
different but appropriate scopes, and **the name is never rendered.** A variable name does not belong
in a census of clinician-facing copy.

⚠️ **Both were checked at the CONSUMER, not the producer.** The withdrawn one was escalated on a read
of where a value is _constructed_, without checking whether anything _reads_ it. **"These inputs look
invented" is a claim about construction; only the consumer decides whether it is a defect.**

---

## 6. The prototypes cannot settle any of this

`mockup-ward-home.html` states in visible copy that its figures are _"calculated once … read here
rather than recalculated"_. **Every figure in it is a hand-typed literal**, with a footnote saying
they are _meant_ to mirror `unitCapacity()`. Nothing on the page computes anything.

**So the artefact makes a claim about its own mechanism that its own contents falsify**, and it
cannot be cited as evidence about drift in either direction. The prototypes also drift among
themselves — `"1 free of 20 beds"`, `"1 free bed on this ward right now"`, `"20 beds · 1 free"`,
`"1 free"` — which looks like evidence of a real problem and is four people typing.

---

## 7. The merged Capacity screen renders a bare `0` in three Ready cells — logged 2026-09-05, deliberately NOT fixed

**Found by Ward Builder Four while re-pointing the tests that MERGE 02 stranded, and recorded here
rather than repaired in passing on Ward Lead's instruction: a wording change to a clinical figure
does not ride along inside a test-re-pointing commit.**

### What was observed, by rendering rather than by reading the source

`CapacityScreen` (`capacity/capacity-screen.tsx`, blob `51263c10`) renders the network table's Ready
cell as `{row.ready}` with no zero branch. Against the seeded fixture at `NOW_ANCHOR`, **three of its
rows render the figure `"0"`**:

    fsh-older-adult      figure "0"
    gry-older-adult      figure "0"
    kun-adult-open       figure "0"

⚠️ **That list is a RENDER, not a grep.** A temporary probe was appended to
`ward-capacity-screen.dom.test.tsx`, the screen was rendered, the Ready cell was read with the "still
being made ready" note stripped out, and the file was restored — source hash `a951bc77` before and
after. **An earlier draft of this finding said "a ward" and named only `fsh-older-adult`, because
that is the one unit the old test happened to name.** It is three. A count taken from the test that
reports a thing is a count of what somebody once wrote down, not of what is on the screen.

### Why it is a finding rather than a preference

**The same screen already obeys the opposite rule in two other places**, so this is an internal
inconsistency and not a house style:

- `freeing === undefined` renders the words **"Not tracked here"**, and `capacity-derivations.ts`
  carries a long comment on exactly why a `0` there would be "a fabricated fact in the direction that
  causes harm".
- When the whole network has no ready bed, the panel states it in words: **"No ward in the network
  reports a ready bed right now."**

**And the board this screen replaced obeyed it for this very cell.**
`ward-capacity-view.dom.test.tsx` pins _'shows "none" rather than the digit "0" for a unit with zero
available beds'_, with a both-directions check that the digit must not survive beside the word — so a
fix that merely added "none" next to the `0` still failed. That test now renders
`<WardModeWorkspace mode="capacity" />` and stands over a screen no coordinator can open, which is
how the rule came to lapse without anything going red.

### ⚠️ The honest counter-argument, recorded so the next chat is not led by this entry

**A zero here is not the same kind of zero as `freeing`.** `freeing === undefined` means _nobody told
us_; `ready === 0` means _the ward told us, and the answer is none_. A known zero is a fact, and
"never render a digit" is not self-evidently right for a fact. **The design rule as quoted in the old
test covers both** — _"a number that could be zero **or unknown** is rendered as a stated absence in
words, never as `0`, a dash or a blank"_ — but whoever acts on this should decide against the rule's
intent rather than treat this entry as having settled it.

**What is NOT in doubt is that the three cells and the two neighbouring behaviours disagree with each
other on one screen.** That much is observed.

### If it is fixed, the trap to avoid

The word must **replace** the digit, not sit beside it. `bedStateFigureText` in the stranded test
asserted `readyText).not.toMatch(/0/)` for exactly that reason. Anything weaker passes on a cell
reading `"0 none"`.
