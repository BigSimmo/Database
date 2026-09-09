# Task report — the owner's four figures. Three delivered, one held.

**Status: complete and green.** Commit range `aeff0635b..321fa124b`, six commits, on
`claude/ward-builder-community-route`.

---

## Gate

Discovered set, echoed rather than typed (12 files, refusal on empty discovery was armed and
did not fire):

```
tests/ward-community-hub.dom.test.tsx tests/ward-community-hub.test.ts
tests/ward-community-index.dom.test.tsx tests/ward-community-index.test.ts
tests/ward-community-referral-survives.test.ts tests/ward-statistics.dom.test.tsx
tests/ward-statistics.test.ts tests/ward-statistics-claims.test.ts
tests/ward-statistics-derivations.test.ts tests/ward-statistics-incoherent-gap.test.ts
tests/ward-statistics-sections.dom.test.tsx tests/ward-statistics-sections.test.ts
```

- `npx tsc -p tsconfig.typecheck.json --noEmit` — exit 0, zero error lines.
- `npx vitest run <discovered>` — **224 RAN**, 223 passed, 1 expected fail (the `it.fails` nav
  tripwire, untouched). Exit 0.

The brief predicted 195 ran at base. The base commit `aeff0635b` actually carries **200**, and it
was **not green**: two claims in the register were already broken by the merge (see "What the brief
got wrong", items 1 and 2). 224 − 200 = 24 tests added by this task.

---

## The three figures, as shipped

### Figure 1 — built

- **Heading:** `Referrals where every ward asked so far has refused`
- **Lead sentence:** "Each one is a movement — somebody waiting in an emergency department for a
  bed — with at least one ward's refusal on record and no ward currently deciding."
- **testid:** `ward-statistics-refused-so-far` (carries "so far"; never says "every … refused")

Reuses `handoverSnapshot`'s `declined_by_all` classification rather than re-deriving the condition.
That reuse costs something and the page discloses it: the shared derivation classifies escalation
FIRST, so an escalated movement meeting the same condition is filtered out. The count is therefore a
**floor**, and `escalatedCount` is rendered beside it saying so.

`PARALLEL_REFERRAL_CAP` is rendered from the model, not typed, so the numeral cannot go stale.

### Figure 2 — rendered as an absence, no proxy, no formula

- **Heading:** `Empty beds that were not offered`
- **Lead sentence:** "Nothing in this prototype records an offer, so this figure cannot be produced
  at all — and no number on this page is standing in for it."
- **testid:** `ward-statistics-not-offered`

The block is pinned by a test asserting it contains **no digit anywhere** — not a prose assertion.
A stand-in added later fails that whatever wording is put around it.

### Figure 3 — HELD, not built

`Movement.blocker`'s `hasActiveBlocker` is case-sensitive against a writer that accepts free prose,
so `"none — resolved"` in lower case still scores as blocked. A blocked-discharge count built on it
reads high and looks right, which is the failure mode this screen exists to avoid. The repair is in
flight on the integration line. Nothing about figure 3 was written; its groundwork
(`BedRelease.blocker`, `BED_RELEASE_BLOCKERS`, generate-from-vocabulary) stands untouched for the
next task.

### Figure 4 — built, all seven rows

- **Heading:** `Declines by reason`
- **Lead sentence:** "All the refusals wards have recorded in this prototype, counted against the
  reason the ward gave. This names no ward — the figure above says why a per-ward number is withheld
  — and it counts wards approached through the coordinator's matching, not referrals refused at the
  front door."
- **testid:** `ward-statistics-declines-by-reason`

Rows are `DECLINE_REASONS.map(...)` with **no filter of any kind**, so the row set is the member
list by construction. Every member gets a row including the ones at nought. No label map: the
member is displayed as the model spells it, because `DECLINE_REASON_LABELS` is keyed by
`ReferralDeclineReason` — the other vocabulary — and a new map here would be a second copy of the
list. No distribution over `REFERRAL_DECLINE_REASONS` appears anywhere; the front-door boundary is
stated in the one durable sentence and nothing more specific.

---

## The figure 2 derivation, under its own name, for the owner

The page does not print this and must not. It is here because the decision to add a field is the
owner's, and this is the informed half of it.

**`unitCapacity`'s derived "held"** — `src/components/ward-management/ward-derivations.ts:321-322`:

```ts
const available = Math.min(unit.allocatable.value, unit.empty.value);
const held = Math.max(unit.empty.value - available, 0);
```

equivalently `held = empty.value − min(allocatable.value, empty.value)`.

**What it IS**, stated positively: **a ward-side readiness gap.** It is the portion of a ward's
physically-empty capacity that the ward has not yet confirmed it can allocate — beds that are empty
but which the ward has not said it can staff or use. It is a true and useful figure about one ward's
own readiness at one moment, aggregated over every bed that ward has.

**Its inputs**, both aggregate counts on `Unit`
(`src/components/ward-management/ward-model.ts:220,222`):

- `empty: CapacityFigure` — "Physically empty beds, per the feed."
- `allocatable: CapacityFigure` — "Beds the ward says it can actually allocate."

**Why it cannot answer the question as asked.** Neither input names a bed and neither names a
request, so the output cannot either. There is no `offered` field anywhere in the model — no
instant, no boolean, nothing recording that a ward offered a bed or withheld one from a particular
person. `Unit.held` exists as a field but is authored and read by nothing; every "held" figure any
screen shows is this derivation.

**What would be needed:** a record per bed, or per offer. That is a model change, not a change to
this page. The day it lands, `statistics-claims-register.ts`'s
`statistics-screen/not-offered/nothing-anywhere-records-an-offer` entry says the absence block
should be replaced by the figure the owner asked for.

---

## Claims register

Twelve new `MODEL_CLAIMS` entries and two new `UNEVIDENCED_CLAIMS` entries. Every citation was
checked for exactly-once uniqueness before it was written, and none is comment-only.

Four are whole-literal citations, chosen because the claims are membership claims and no
single-line citation can witness one: `DECLINE_REASONS` whole, `REFERRAL_DECLINE_REASONS` whole
(the "different list" claim is only witnessed by pinning both), the two `Unit` capacity counts with
the doc comment between them (pinning adjacency, so a per-bed field arriving between them breaks
it), and the `held` arithmetic (a citation of the `Unit.held` FIELD would not do — nothing reads it,
so it can change freely without the derived figure moving).

**The entry that matters most is unevidenced, deliberately:**
`statistics-screen/refused-so-far/no-exhaustion-marker-exists-on-a-movement`. The heading is true
today because of something the model LACKS, and an absence has no line to cite — putting it in
`MODEL_CLAIMS` would mean inventing a citation that cannot fail. Its `reason` field carries the
consequence in terms: **if a closure or exhaustion marker is ever added to `Movement`, this
figure's heading must change from "so far" to "every"**, its count becomes a strict subset of what
it counts today, and the note explaining the qualifier must be rewritten. Nothing else in the
repository will say so.

---

## Adversarial check

Two mutations, both caught, both files restored and verified byte-identical by SHA-256:

1. Reinstating a `.filter(count > 0)` on the decline tally → **6 tests red** across the derivation
   and DOM suites.
2. Dropping "so far" from the figure 1 heading → **1 test red**, the phrasing test.

---

## What the brief got wrong

1. **"195 ran at base, 194 passed, 1 expected fail."** The base `aeff0635b` runs **200**, and one
   was **failing** — `tests/ward-statistics-claims.test.ts`, two claims. The brief's numbers were
   measured on a pre-merge tree.

2. **A live falsehood the merge introduced, which the register caught rather than a reader.**
   `ward-statistics.ts` **no longer clamps** a negative pull-to-arrival gap — the owner's ruling
   against clamping has been applied there and it now returns `null`. Three of our comments (in
   `statistics-derivations.ts`, twice, and in `tests/ward-statistics-derivations.test.ts`) still
   described a "deliberate divergence" from a clamp that no longer exists. The arithmetic on our
   side never moved; the false statement was one page's remark about another file, and only the
   claims register noticed. Fixed in `b4736d3e4`.

3. **The `"left"` → `"departed"` rename has LANDED**, and three comments still said it was "being
   renamed". Same commit. `ADMISSION_STATES` is now
   `["waitlisted", "pulled", "occupied", "departed"]`.

4. **Reducer line numbers in the brief are stale after the merge.** `case "DECLINE"` is at `:961`,
   not `:826`. Cited by name in the register, never by line.

5. **`declinedByAll` is not an exported derivation.** It is computed inline inside
   `handoverSnapshot` and cannot be called on its own. Reusing it therefore means calling
   `handoverSnapshot(movements, units, now)` and counting the classification — which drags in a
   `units` list and a `now` neither of which affects the answer, and inherits the escalation-first
   exclusion. Both are documented and the clock-independence is pinned by a test at two instants a
   century apart. The alternative — a second copy of the condition — was worse.

6. **The stale comment reported for information:** `ward-model.ts:939-940` says `Decline` has "an
   optional `note`"; `ward-model.ts:256-271` says "THERE IS NO `note` FIELD, and its absence is the
   point", and the type has none. Two comments contradict each other about the type figure 4 depends
   on. Another chat's file; reported, not touched.

---

## Concurrency note

Another agent was writing `statistics-claims-register.ts` in this worktree during this task. It
added a required `falsifiedBy: FalsifyingEdit` field to `ModelClaim`, which broke `tsc` with 85
identical errors — every entry in the register, not only mine — for several minutes mid-task. It
finished and the gate is green. Nothing of theirs was staged or committed by me; only files written
here were staged, by name. Their work on `statistics-claims-register.ts` and
`tests/ward-statistics-claims.test.ts` is still uncommitted in the working tree and is theirs to
commit.
