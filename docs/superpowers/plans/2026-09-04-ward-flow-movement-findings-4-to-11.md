# Plan — movement workspace findings 4–11

**Ward Builder Three, 2026-09-04.** Planning only; no repository edits, no branch. Read from
`codex/task-ward-flow-live-state-20260831` with `git show`. I did not enter
`D:/Worktrees/Database/ward-lead`.

**Findings 1–3 are out of scope and being built now by another agent in that worktree. Nothing below
touches them** — but four of them collide with that work, and the ordering section says how.

Every finding below was re-verified in source, not taken from the review.

---

## 🔴 Ordering — read before dispatching anything

**All eight land in ONE file, `ward-management-console.tsx` (680 lines), which another agent is
rewriting right now.**

### Everything here lands AFTER findings 1–3

Finding 1 (a closed movement renders as live) rewrites the summary card, the Readiness list and the
Transport panel — **the same JSX as findings 4, 5, 7 and 11.** Dispatching any of these first
guarantees a conflict, and the conflict is in the direction that loses the closure work.

### Then finding 11 FIRST of mine, because it moves the region the others edit

| Finding                   | Region it edits                                                      | Inside 11's restructure?  |
| ------------------------- | -------------------------------------------------------------------- | ------------------------- |
| **11** tabs               | the `<nav>` (287–305) **and** all three conditional panels (396–435) | — it _is_ the restructure |
| **4** transport claims    | the Transport panel (418–425)                                        | ✅ **yes**                |
| **5** "Not yet requested" | the Transport panel **and** the Readiness list (~383)                | ✅ **partly**             |
| **8** timeline            | `movementTimeline` + the Timeline panel (426–435)                    | ✅ **yes**                |
| **6** tier sentence       | the summary card (~253)                                              | ❌ no                     |
| **7** expired pull        | Readiness list / Movement facts                                      | ❌ no                     |
| **9** Alternatives        | "Why this match" (352–360)                                           | ❌ no                     |
| **10** Response           | Movement facts `<dl>` (322–325)                                      | ❌ no                     |

**So: 1–3 → 11 → then 4, 5, 8 in any order → 6, 7, 9, 10 at any point.** 11 must be **first or last
of the four that share its region, never in the middle**; first is better, because 4, 5 and 8 then
apply to the structure they will live in rather than being rewritten by it.

⚠️ **6, 7, 9 and 10 are independent of 11 and of each other** and can be dispatched in parallel with
it — different regions of the same file, so they still need sequencing against each other by
whoever holds the file, but not by content.

---

## ⚠️ Ruling R-2026-09-04-C is ALREADY BUILT. Do not build it again.

The ruling approved the third transport state. **It exists:** `MovementTransportNeed`
(`ward-model.ts:475`), `Movement.transportNeed?` (`:613`), `transportNeedState()`
(`ward-derivations.ts:356`) and `tests/ward-movement-transport-need.test.ts`.

**So findings 4 and 5 are not model work at all — they are the workspace failing to CALL what
already exists.** Its doc comment already forbids the collapse this workspace performs:

> `"not_recorded"` is the DEFAULT and is not a soft `"not_needed"`: nobody has answered… so a caller
> cannot write `movement.transportNeed?.needed ?? false` and silently turn an unanswered question
> into a stated "no".

⚠️ **And it forbids the shortcut a builder will reach for:** _"IT IS NOT DERIVED FROM
`Movement.transport`, AND MUST NOT BE. A booked job proves need; the absence of one proves nothing
at all."_

---

## Global Constraints

Everything in `2026-09-04-ward-flow-design-foundation.md` applies unchanged. The ones that bite:

- ⚠️ **DOM tests are `*.dom.test.tsx`** — a `*.test.tsx` matches no vitest glob and silently never
  runs. **Never `toHaveClass(styles.x)`.**
- **Every guard ships with a mutation naming its expected message.**
- **Every count derived from source with an anti-vacuity floor** that fails naming the number found.
- ⚠️ **Every absence gets its OWN sentence.** Three facts never share one string — the defect class
  behind findings 5 and 8 both.
- **State is worded as well as coloured.** **Tokens only, no raw hex.** `--ward-space-N` is N pixels;
  **`--ward-border-subtle` does not exist.**
- **Never `git add -A`; never `git stash`.** **No invented figures.**

---

## Task A — Finding 11: make the tabs real, and give the Legal tab something to be

**Files** — Modify: `ward-management-console.tsx` (287–305, 396–435, and the Overview grid at
306–395), `ward-management.module.css`. Test: `tests/ward-workspace-tabs.dom.test.tsx`.

**What is wrong, verified:** the nav uses `aria-pressed`, not `role="tab"`. **The Overview grid at
306–395 renders unconditionally** — it is not inside any `activeSection` check — so the other three
panels _append below it_ rather than replacing it, and selecting "Overview" while active does
nothing at all. The **Legal & forms** panel renders `patient.legalStatus` and
`legalFormReadinessLine(...)`, **both already in the Readiness list 28 lines above**, and nothing
else.

- [ ] **Step 1 — the failing tests**
  - `selecting a section replaces the previous one` — assert a marker unique to Overview is **absent**
    when Transport is selected. ⚠️ **Assert the absence, not the presence of Transport** — the bug is
    that both render, so a presence-only test passes today.
  - `the tab list is a tab list` — `role="tablist"`, `role="tab"`, `aria-selected`, and each panel
    `role="tabpanel"` labelled by its tab.
  - `the Legal tab shows something the Overview does not` — 🔴 assert `destinationNoLongerLawful`'s
    sentence, the mid-flight _"this patient's status now requires an authorised destination and their
    accepted ward is not one"_ exception, which is **on no tab today**.
  - `no line appears on both the Legal tab and the Readiness list`.
- [ ] **Step 2 — implement.** Overview becomes a conditional panel like the other three.
- [ ] **Step 3 — MUTATION**
  - Make the Overview grid unconditional again → **the replaces-the-previous test goes red.** If it
    stays green it is asserting presence, not exclusivity.
  - Restore the duplicated legal lines → the no-duplicate test names the repeated line.

## Task B — Finding 4: the Transport tab's four false claims

**Files** — Modify: `ward-management-console.tsx` (the Transport panel). Test:
`tests/ward-workspace-transport-tab.dom.test.tsx`.

**Verified.** The sentence _"Provider, ETA, risk documentation and legal-form readiness are visible
here"_ is wrong four times: **provider** is dropped by `transportStatusLabel` at every leg past
`accepted` (`ward-derivations.ts:369-372` return bare `"En route"`, `"Collected"`, `"Arrived"`,
`"Cancelled"`); **ETA** exists nowhere in the model; **risk documentation** does not exist and the
nearest field, `escortRequired`, is rendered on no tab; **legal-form readiness** is on the Legal tab.

🔴 **The fix is to render the things, not to soften the sentence.** Deleting the claim leaves a
secure involuntary patient's escort requirement invisible, which is the harm the review observed on
WF-006.

- [ ] **Step 1 — the failing tests**
  - `the provider is named at every transport leg` — 🔴 **derive the legs from `TransportLeg`**
    (`ward-derivations.ts:375`), do not hand-list five. **Anti-vacuity floor: fewer than 5 legs
    asserted FAILS, naming the count.**
  - `escortRequired true renders an escort requirement in words`.
  - `escortRequired false renders that no escort is required` — ⚠️ **a separate assertion, because
    `false` and "not recorded" must not share a rendering.**
  - `the panel claims nothing it does not render` — assert the words "ETA" and "risk documentation"
    are **absent**.
  - ⚠️ `a form code is shown without implying the form was checked` — ruling C's own separate note:
    `formRequired` is an unvalidated bare string.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Return to `transportStatusLabel` for the panel's provider line → the every-leg test fails,
    naming the first leg that drops it.
  - Set `escortRequired: false` on a movement rendering "no escort required", then delete the field
    → **the two assertions must fail separately.** If one covers both, `false` and unrecorded are
    sharing a sentence.

## Task C — Finding 5: "Not yet requested" is three situations in one string

**Files** — Modify: `ward-management-console.tsx` (**two places** — the Readiness list ~383 and the
Transport panel). Test: `tests/ward-workspace-transport-need.dom.test.tsx`.

**Verified.** `transportStatusLabel(undefined)` returns `"Not yet requested"` — **an assertion that a
booking is outstanding** — and the workspace calls it with no reference to `transportNeed` at all.
The review observed it beside _"Current blocker: Escort provider organising secure transport"_ on
WF-004: **the screen contradicting itself on one page.**

**Four renderings, four sentences, from `transportNeedState(movement)` × `movement.transport`:**

| Need state     | Transport job | The line says                                           |
| -------------- | ------------- | ------------------------------------------------------- |
| `not_recorded` | none          | **"Whether transport is needed has not been recorded"** |
| `not_needed`   | none          | **"No transport needed"**                               |
| `needed`       | none          | **"Transport needed, not yet requested"**               |
| any            | present       | the job's own leg (Task B's rendering)                  |

⚠️ **`"Not yet requested"` survives only in the third row**, where it is true. Today it is an
unearned claim on **all 50 movements** and becomes an outright falsehood the moment anything records
`needed: false`.

- [ ] **Step 1 — the failing tests** — one per row, four separate assertions, **and the same four on
      the Readiness list as on the Transport panel**, because it is rendered twice and fixing one is
      the likely half-fix.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Write `movement.transportNeed?.needed ?? false` — **the exact collapse the model's doc comment
    names** → the `not_recorded` row fails by name.
  - Derive need from `movement.transport !== undefined` → the `needed`-with-no-job row fails.
  - Fix the Transport panel only, leaving the Readiness list → the Readiness copies of all four fail.

## Task D — Finding 6: the sort-key sentence belongs nowhere on one patient's page

⚠️ **HALF OF THIS IS ALREADY GONE.** The agent building findings 1–3 is removing _"Tier N leads"_
from the summary card, because it sits directly under the eligibility verdict it contradicts.
**Do not restore it, and do not re-report it as outstanding.**

**My half — where, if anywhere, the sentence goes: NOWHERE. Delete it; do not relocate it.**

**The reasoning, so nobody puts it back:** _"Tier 3 leads"_ is a compression of a statement about
**the queue's sort key** — a fact about how this patient ranks against **other patients**. The
review's own nulls section names that class as the defect: _"Facts about other patients on one
patient's page."_ Worse, it is contradicted twice on the same page — the urgent-flag panel says
_"This patient leads the queue ahead of every urgency tier, including tier 1"_, and on a closed
movement it sits beside _"it is not in the queue at all."_

**The true thing is already said, in the right place, in full sentences: the urgent-flag panel.**
Relocating a three-word compression of it elsewhere adds a second, weaker copy of one fact — the
two-answers problem this project keeps ruling against.

**Files** — Test only: `tests/ward-workspace-no-queue-position.dom.test.tsx`.

- [ ] **Step 1** — `no queue-position or sort-key claim appears on a single patient's page`, asserted
      over the rendered text for the phrase shape, on **a tier-1, a tier-3, an urgent-flagged and a
      closed movement**. ⚠️ **Four fixtures, because the string only contradicts itself on some of
      them** — a one-fixture test passes on the tier-1 case forever.
- [ ] **Step 2 — MUTATION.** Reinstate `<small>Tier {patient.urgency} leads</small>` → the test fails
      **naming the fixture**. This test exists precisely to catch a restoration.

## Task E — Finding 7: an expired bed pull is never stated

**Files** — Modify: `ward-management-console.tsx` (Readiness list). Test:
`tests/ward-workspace-expired-pull.dom.test.tsx`.

**Verified.** The workspace reads `pullExpiresAt` **nowhere**. `ward-derivations.ts:744` already
holds the condition — `stage === "pulled" && pullExpiresAt !== undefined && pullExpiresAt < now` —
and the coordinator's inbox raises _"Bed pull expired"_ from it. **WF-004 carries
`pullExpiresAt: NOW_ANCHOR - 10`, so it is expired on every page load, permanently.**

- [ ] **Step 1 — the failing tests**
  - `a pull past its expiry says so` — **reuse the derivation at `:744`, never a second inequality
    here.** Two spellings of one rule is how this screen and the inbox come to disagree.
  - `a pull inside its window says when it expires`.
  - `a pulled movement with no pullExpiresAt says the expiry is not recorded` — ⚠️ **its own
    sentence.** This is not hypothetical: **7 of the 50 movements are at `pulled`, and none carries
    an `admissionId`** — the fixture repair is a separate task, and until it lands this branch is
    the common case.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Flip the comparison to `>` → the expired test fails.
  - Hand-write the inequality instead of calling the derivation → **a second test asserting the
    workspace and the inbox agree on the same movement** fails. Without that test the duplication is
    invisible.

## Task F — Finding 8: the timeline is not the audit

**Files** — Modify: `ward-derivations.ts` (`movementTimeline`, 1179–1203). Test:
`tests/ward-movement-timeline.test.ts` (pure).

**Verified.** It emits opened, `statusChanges`, `declines`, four transport stamps, closure. Its
decline line is `` `Declined by referral: ${decline.reason.replace(/_/g, " ")}` `` — **naming no
unit and phrasing it as though the referral declined** — while `declineReasonLabels` sits unused in
the same module.

**Of the ten omissions the review names, SEVEN are emittable today and THREE are not** — checked
field by field, because planning an event with no source is the failure this project keeps hitting:

| Emittable now        | Source                                         |
| -------------------- | ---------------------------------------------- |
| escalation           | `escalation?: { at, triedUnitIds, contact }`   |
| examination          | `examination?: { at, outcome }`                |
| urgency changes      | `urgencyChanges: UrgencyChange[]`              |
| released bed pulls   | `unwinds`, kind `pull_released`                |
| cancelled transports | `unwinds`, kind `transport_cancelled`          |
| withdrawn referrals  | `withdrawnReferrals: { unitId, at, reason }[]` |
| the acceptance       | `acceptedAt?`                                  |

| 🔴 NOT emittable         | Why                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **the bed pull**         | no timestamp exists — only `pullExpiresAt`. ⚠️ **Do NOT reconstruct it as `pullExpiresAt − 60`**; it is exact today and breaks silently when the window changes. **It arrives free once `stageChanges` lands** (the step-track plan, Task 4) |
| **transport requested**  | `TransportJob` has `acceptedAt`/`enRouteAt`/`collectedAt`/`arrivedAt`/`cancelledAt` and **no `requestedAt`**                                                                                                                                 |
| **every blocker record** | `blocker` is a single current `string` with no history and no timestamp                                                                                                                                                                      |

**Plan the seven. Name the three as unsourceable in the panel's own footer** — _"Bed pulls,
transport requests and blocker changes are not recorded with a time and cannot appear here"_ —
rather than leaving the reader to assume the timeline is complete. ⚠️ **A timeline silently missing
event kinds is indistinguishable from a patient to whom those things never happened**, which is the
absence-with-two-causes shape again.

- [ ] **Step 1 — the failing tests**
  - `every recorded event kind reaches the timeline` — 🔴 **derive the kinds from the `Movement`
    type's own array/optional fields, do not hand-list seven.** **Anti-vacuity floor: fewer than 7
    FAILS, naming the count found.**
  - `a decline names the unit that declined` and `a decline uses declineReasonLabels` — **two
    assertions**; the review found both wrong and one fix would hide the other.
  - `the panel states which event kinds cannot be recorded`.
  - `WF-009 shows its escalation and its examination` — the review's observed case: five declines
    and nothing else.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Drop `unwinds` from the emitter → the derived-kinds test names `unwinds`.
  - Restore `reason.replace(/_/g, " ")` → the labels test fails while the names-the-unit test still
    passes. ⚠️ **If both fail together they are one assertion wearing two names.**

## Task G — Finding 9: "Alternatives" shows three, unmarked, including wards that already refused

**Files** — Modify: `ward-management-console.tsx` (352–360). Test:
`tests/ward-workspace-alternatives.dom.test.tsx`.

**Verified.** `eligibleCandidatesAmong(movement, units, now, limit = 3)` filters to the movement's
own cohort, sorts eligible-first, and **slices to 3**. The screen states no truncation.

⚠️ **The denominator is NOT 16 in general** — it is the count of units in that movement's cohort:
**16 Adult, 6 Older adult, 1 Youth**. The review's "three of sixteen" is right for an Adult patient
and wrong for the other two. **Render the real denominator; never hardcode a number.**

- [ ] **Step 1 — the failing tests**
  - `the list says how many of how many it is showing` — assert **16** for an Adult movement and
    **6** for an Older adult one. ⚠️ **Two cohorts, because one fixture lets a hardcoded 16 pass.**
  - `a unit that already declined this movement is marked as such in the heading region` — it is
    already labelled per row (_"Already declined this movement"_), but under a heading calling them
    **alternatives** on a page whose escalation panel says every secure unit was tried.
  - `an empty candidate list renders an empty state` — latent today; a Youth movement with its one
    unit as the destination reaches it.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Hardcode 16 → the Older-adult assertion fails naming the expected 6.
  - Return `[]` from the derivation → the empty-state test fails rather than rendering a bare heading.

## Task H — Finding 10: "Response" is not the unit's response

**Files** — Modify: `ward-management-console.tsx` (322–325). Test:
`tests/ward-workspace-response-label.dom.test.tsx`.

**Verified.** `<dt>Response</dt><dd>{patient.blocker}</dd>` sits directly beneath
`<dt>Referral</dt><dd>{destination.name}</dd>`. **On WF-004 that reads "Referral: BTY Adult Secure /
Response: Escort provider organising secure transport"** — a coordinator concludes Bentley said it.
`blocker` is free prose about what is holding the movement up; the unit's answer is `declines` /
`acceptedUnitId`.

- [ ] **Step 1 — the failing tests**
  - `the blocker is not labelled as a response` — assert the label beside `blocker` is **not**
    "Response". ⚠️ **Assert the pairing, not the absence of the word** — "Response" may legitimately
    label the real answer.
  - `the receiving unit's answer comes from declines or acceptedUnitId` — a movement whose
    destination declined shows that decline; one accepted shows the acceptance.
  - `a unit that has neither declined nor accepted says it has not answered` — its own sentence,
    never blank.
- [ ] **Step 2 — implement.** `blocker` keeps a label naming what it is (the Readiness list already
      calls it **"Current blocker"** — reuse that wording, do not invent a third).
- [ ] **Step 3 — MUTATION**
  - Point the Response row back at `patient.blocker` → the pairing test fails.
  - Render the not-answered case as an empty string → its own test fails.

---

## What I could not settle, and am handing back

1. ⚠️ **Finding 4 asks the Transport tab to show "risk documentation", and no such thing exists.**
   `escortRequired: boolean` is the nearest field and is a different, narrower fact. **I have planned
   the escort requirement — which is real, and was the observed harm — and NOT invented a risk-
   documentation surface.** Whether one is wanted is a product question.
2. **Finding 8's three unsourceable event kinds** (bed pull, transport requested, blocker changes).
   The first is solved by `stageChanges`; the other two need model fields nobody has ruled on.
3. **Finding 9's empty state is unreachable today except for a Youth movement.** I have planned it
   anyway, because latent-not-reachable is how the review itself described it — but a test that can
   only be reached through the one Youth unit is fragile if that unit is ever renamed.
