# Prose audit — the Ward Flow STATISTICS surface

**Date:** 2026-09-01. **Scope:** every file under `src/components/ward-management/statistics/`
(11 files) plus the five route pages under `src/app/mockups/ward-flow/statistics/`. Community
files were deliberately not read for findings.

**Result: 7 findings. Three are RENDERED to the screen; four are comment-only.**

Every counter-evidence line below was opened and read on disk. Nothing here is inferred from a
filename, a variable name, or another comment.

---

## 1. RENDERED — the overview page tells the reader it cannot be reached from the hub. It can.

**File / symbol:** `src/components/ward-management/statistics/statistics-overview-screen.tsx`,
`StatisticsOverviewScreen`, the `ward-statistics-overview-not-built-body` paragraph (line 60).

**Claim, verbatim (rendered inside `<p className={styles.notBuilt}>`):**

> There is no way in from the statistics home page yet — the index that will link here is separate
> work.

**Why it is false.** The index exists and links here. `statistics-screen.tsx` (the statistics home
page) renders:

```tsx
<nav className={styles.index} aria-labelledby="ward-statistics-index-heading" data-testid="ward-statistics-index">
  …
  {STATISTICS_SECTIONS.map((section) => (
    <li key={section.id} className={styles.indexItem}>
      <Link href={section.href} …>
```

and `STATISTICS_SECTIONS[0]` in `statistics-sections.ts` is

```ts
{ id: "overview", label: "Across all services", …, href: STATISTICS_OVERVIEW_HREF }
```

with `export const STATISTICS_OVERVIEW_HREF = "/mockups/ward-flow/statistics/overview";`. The hub
therefore renders a `<Link>` straight to this page. `statistics-screen.tsx`'s own doc comment says
so in the past tense — _"Before that index existed the section pages were reachable only by knowing
their addresses"_ — which is the same fix, recorded on the other side of it.

**Defect class:** 2 — a fixed defect described as present. The sentence was true when the page
shipped; the hub index landed afterwards and nothing made this sentence red.

**Rendered or comment:** **RENDERED**, and it is the worst kind of rendered falsehood on this
surface: a reader on this page is being told the navigation they just used does not exist.

**Does the conclusion survive?** **No — it falls with the reason.** There is no corrected version of
this sentence; the state it describes no longer obtains. The fix is a deletion. The surrounding
sentences (_"This is a skeleton: the route, the account of what belongs here, and the disclaimer that
has to travel with it"_) are still true and should stay.

**Extra weight.** `statistics-claims-register.ts` lists
`"src/components/ward-management/statistics/statistics-overview-screen.tsx"` in
`REGISTERED_SURFACES` — i.e. the register asserts it has swept this file — and carries no entry
covering this sentence. This is precisely exclusion class 6 in the register's own doc comment
("Prose anywhere else") landing on a file the register claims to cover.

---

## 2. RENDERED — the ward page says every instant on `Admission` is about the bed or the discharge plan. The model says one of them is about the person.

**File / symbol:** `statistics-ward-screen.tsx`, `StatisticsWardScreen`, the
`ward-statistics-ward-blocked-figure` paragraph.

**Claim, verbatim (rendered):**

> The record carries several instants and every one of them is about the bed or about the discharge
> plan; none is the moment somebody joined the waitlist.

**Why it is false.** `Admission` carries seven instants: `pulledAt`, `arrivedAt`,
`awayAtEmergencyDepartmentSince`, `expectedDischargeAt`, `dischargeDateSetAt`,
`dischargeConfirmedAt`, `leftAt`. The third is neither about the bed nor about the discharge plan,
and `ward-admissions.ts` says so in terms, in bold, on the field itself:

```
/**
 * When this person left the ward for an emergency department, or `null` while they are on it.
 *
 * **THE BED STAYS OCCUPIED AND THIS FIELD MUST NEVER CHANGE THAT.** …
 *
 * **It is a fact about the PERSON, which is why it is a field and not a state.** `AdmissionState`
 * is `waitlisted | pulled | occupied | left` and every member is about the BED. …
 */
awayAtEmergencyDepartmentSince: Instant | null;
```

(`src/components/ward-management/ward-admissions.ts`, the `Admission` type, lines 352–375.) The
model draws exactly the bed/person distinction this sentence flattens, and puts this field on the
person side.

**Defect class:** 5 — an unearned absolute ("every one of them"), on the same paragraph whose own
comment history records the five-instants-when-there-are-seven defect.

**Rendered or comment:** **RENDERED.**

**Does the conclusion survive?** **Yes, on a corrected reason.** The load-bearing half —
_"none is the moment somebody joined the waitlist"_ — is true of all seven and is separately recorded
as an absence in `statistics-claims-register.ts`
(`statistics-ward-screen/blocked/no-instant-marks-entry-to-waitlisted`). The fix is to drop the
"every one of them is about…" characterisation, not the paragraph. Note the page deliberately refuses
to enumerate the fields; the repair must not reintroduce an enumeration.

---

## 3. RENDERED — an unearned quantifier about how many wards each counted movement was put to.

**File / symbol:** `statistics-screen.tsx`, the
`ward-statistics-refused-so-far-why-so-far` note.

**Claim, verbatim (rendered):**

> And a movement can be live at only {PARALLEL_REFERRAL_CAP} wards at once, so **most of what is
> counted here has been put to that many out of the whole network** and the rest have never been
> asked.

**Why it is unsupportable.** The counted population is defined by `handoverSnapshot`
(`ward-derivations.ts`) as:

```ts
const declinedByAll = open
  .filter((movement) => !escalatedIds.has(movement.id))
  .filter((movement) => movement.referredUnitIds.length === 0 && movement.declines.length > 0);
```

— i.e. _at least one_ decline and nothing pending. A movement with a single decline satisfies it.
Nothing in `refusedAndNothingPending` or `handoverSnapshot` measures how many wards a counted
movement was put to, so the page cannot know that "most" of them reached the cap. The cap being 3
(`export const PARALLEL_REFERRAL_CAP = 3;`, `ward-model.ts`) bounds the figure from above; it
establishes nothing about the mode. The same soft claim is repeated in `statistics-derivations.ts`
("has usually been put to three wards out of a network of many").

This is also the shape the claims register bans elsewhere: exclusion class 3, _"Claims about the SEED
FIXTURE — and this register no longer carries any."_ A quantifier over today's data, typed rather
than rendered, is exactly that class.

**Defect class:** 5 — an unearned quantifier.

**Rendered or comment:** **RENDERED.**

**Does the conclusion survive?** **Yes.** The point of the paragraph — that this is not a count of
patients nobody would take, because the cap means only a few wards have been asked — stands on the
cap alone. Rewrite as "so a movement counted here has been put to at most that many wards out of the
whole network, and the rest have never been asked."

---

## 4. Comment — "every one of the eighteen ward modules declares `.governanceBanner`, `.prototypeBadge` and `.notice` on its own root". Six do.

**Files / symbols:** `statistics-disclaimers.tsx`, module doc comment (line 37); and the matching
sentence in `statistics-section-frame.tsx`, module doc comment (line 34): _"exactly as the other
seventeen ward modules keep theirs."_

**Claim, verbatim:**

> …every one of the eighteen ward modules declares `.governanceBanner`, `.prototypeBadge` and
> `.notice` on its own root, and two of them borrowing a nineteenth module's styling would be the
> only exception in the directory.

**Why it is false.** Measured across `src/components/ward-management/**/*.module.css` on
2026-09-01 (28 CSS modules in the tree):

- `.governanceBanner` is declared in **19** modules.
- `.prototypeBadge` is declared in **21** modules.
- `.notice` is declared in **7**: `community/community.module.css`,
  `out-of-area/out-of-area.module.css`, `statistics/statistics.module.css`,
  `statistics/statistics-sections.module.css`, `ward/ward.module.css`,
  `ward-demo-controls.module.css`, `ward-management-modes.module.css`.
- Modules declaring **all three**: **6**.

`handover/handover.module.css`, `referrals/referrals.module.css`, `ed/ed.module.css`,
`morning/morning.module.css`, `search/search.module.css`, `wards/ward-index.module.css`,
`tracker/live-tracker.module.css`, `officer/officer.module.css`, `escalation/escalation.module.css`,
`discharges/discharges.module.css`, `patients/person.module.css`, `coordinator/coordinator.module.css`
and `community/community-index.module.css` all declare `.governanceBanner` and `.prototypeBadge` and
carry **no `.notice` rule at all** (`grep -n "notice" handover/handover.module.css` returns nothing;
the only hits anywhere near it are two prose uses of the word inside `ed/ed.module.css` comments).

The two files also disagree with each other about the population size — eighteen against seventeen —
which is the two-copies-of-one-fact failure both comments were written to argue against.

**Defect class:** 1 (a count that moved) compounded with 5 (an unearned "every one of").

**Rendered or comment:** Comment only. A developer reads this, not a clinician.

**Does the conclusion survive?** **Yes, on a corrected reason.** The argument — keep the markup and
the styling local to each module and share only the wording — stands on `.governanceBanner` and
`.prototypeBadge`, which really are declared per-module across ~19 modules. `.notice` should come out
of the list, and the numeral should come out of both sentences: a count typed into a comment is the
thing that went stale here, exactly as `statistics-sections.ts` warns in its own header
(_"a count written into a constant is a count that stops being true silently"_).

---

## 5. Comment — the statistics home route forbids three props. The screen takes four.

**File / symbol:** `src/app/mockups/ward-flow/statistics/page.tsx`, `WardStatisticsPage` doc comment.

**Claim, verbatim:**

> ⚠️ **It must never pass `admissions`, `referrals` or `bedReleases`.** `StatisticsScreen` accepts
> all three as optional overrides so a test can render populations the seed cannot produce, and all
> three fall back to `useWardFlow()`.

**Why it is false.** `StatisticsScreen` takes **four** optional props:

```tsx
export function StatisticsScreen({
  admissions,
  referrals,
  bedReleases,
  movements,
}: {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
} = {}) {
```

(`statistics-screen.tsx`). `movements` is not decorative: `sourceMovements = movements ?? liveMovements`
feeds both `refusedAndNothingPending(...)` and `declinesByReason(...)`, i.e. three of the numbers the
page renders. `statistics-screen.tsx`'s own doc comment already says "The four optional props exist
only so a test can render populations the seed cannot produce", so the two files disagree.

The three sibling route pages are correct: `compare/page.tsx` names both of `StatisticsCompareScreen`'s
props, `ward/[unitId]/page.tsx` names `units`, and `ed/[edId]/page.tsx` has no override to name.

**Defect class:** 1 — a count that moved, plus a guard whose stated scope is narrower than the hole it
is guarding.

**Rendered or comment:** Comment only — but it is a _prohibition_, and a prohibition that omits one of
the four things it is meant to forbid is the one comment class where being incomplete is the same as
being wrong. The harm it describes ("a route that passed any of them would pin the page to a fixture
and quietly override live state") applies to `movements` identically.

**Does the conclusion survive?** **Yes.** Add `movements` to the list and change "all three" to "all
four".

---

## 6. Comment — the claims register's opening sentence claims a completeness its own body denies.

**File / symbol:** `statistics-claims-register.ts`, module doc comment, lines 1–3.

**Claim, verbatim:**

> THE CLAIMS REGISTER — **every statement** the statistics and community screens make about the data
> model, paired with the line of real source that makes it true.

**Why it is unsupportable.** The same file exports `UNEVIDENCED_CLAIMS`, a list of statements these
screens make about the data model that are explicitly **not** paired with any line of source — eleven
of them, each carrying a `reason` field saying why no citation is possible. Its own exclusion class 2
states the general case:

> **Any claim of ABSENCE.** A substring can only witness something that exists. … none of these has a
> line to cite, because the fact is that no line is there.

and exclusion class 6 adds that prose outside `REGISTERED_SURFACES` is not swept at all. Finding 1
above is a live instance of a statement inside a registered surface that the register does not carry.

**Defect class:** 5 — an unearned absolute, in the strongest position in the file (the first line, the
one a reader takes as the module's contract). This is the file whose entire subject is that overstated
guarantees are worse than absent ones; its own header does it.

**Rendered or comment:** Comment only.

**Does the conclusion survive?** **Yes, on a corrected reason.** The mechanism is real and the sixty
lines below the title describe it honestly. The title line should say what the body says: _"every
statement … either paired with the line of real source that makes it true, or listed in
`UNEVIDENCED_CLAIMS` with the reason it cannot be."_

---

## 7. Comment — "NO CONTROLS. The only interactive element here is the link back to the hub."

**File / symbol:** `statistics-section-frame.tsx`, `StatisticsSectionFrame` doc comment.

**Claim, verbatim:**

> ⚠️ **NO CONTROLS.** The only interactive element here is the link back to the hub, which
> navigates. There is no filter, no date picker, no export and no refresh…

**Why it is false.** The frame's first child is `<ClinicalRail />`
(`ward-management-navigation.tsx`), which renders, among other things:

```tsx
<button
  type="button"
  onClick={() => setMenuOpen(true)}
  className={sidebarStyles.menuButton}
  aria-label="Open Ward Flow menu"
  aria-expanded={menuOpen}
>
```

plus a `WardIconRail` with an `onExpand` handler, a `WardSidebarNav` with an `onCollapse` handler, a
`Sheet`, and a set of navigation `<Link>`s. Several real controls render inside this component; one
of them (`setCollapsed`) mutates persisted UI state.

**Defect class:** 5 — an unearned absolute in a scope the sentence does not name.

**Rendered or comment:** Comment only.

**Does the conclusion survive?** **Yes.** The substantive point — that nothing on a section page
looks as though it would change a figure — is true, and the following sentence already carries it.
Scope the first sentence to the frame's own content ("the only control this frame adds is the link
back to the hub"), which is what it means and not what it says.

---

# What was checked hardest and found TRUE

Recorded so this audit is distinguishable from one that did not run. Each of these was read at the
declaration, not inferred.

- **The declines-per-ward refusal, rendered on the home page and restated on three other screens.**
  `ReferralAddressing`'s only unit field is `acceptedUnitId?: string;` (whole type body read in
  `ward-model.ts`); the `psychiatric_ward` destination arm carries `sex`, `secureBedNeeded`,
  `involuntaryBedNeeded` and no unit; the reducer writes `acceptedUnitId: unit.id` only on the
  acceptance path; `export type Decline = { unitId: string; at: Instant; reason: DeclineReason; };`
  does name a unit. The asymmetry the page describes is exactly the asymmetry in the model.
- **The bed-readiness absence.** `SET_BED_PREPARATION` (reducer, case at line 1630) carries a unit
  guard and a `BED_PREPARATION_NOTES` membership check, has **no** state guard, and writes
  `confirmedAt: event.now`. `FLAG_BED_RELEASE`, `CONFIRM_BED_RELEASE`, `BLOCK_BED_RELEASE`,
  `CLEAR_BED_RELEASE_BLOCK` and `RELEASE_BED` each write `confirmedAt: event.now` too, so the shared
  field really is overwritten by every act. `ward-screen.tsx` offers the control only over
  `dischargedBedReleases`. The "should, rather than is" hedge on the page is earned.
- **The "so far" figure and its floor.** `case "DECLINE"` removes the unit from `referredUnitIds`,
  appends to `declines`, and sets `stage: "destination_review"`, which is a member of
  `REFERRABLE_MOVEMENT_STAGES = ["placement_requested", "destination_review"]`. `handoverSnapshot`
  builds `escalated` first and excludes those ids from `declinedByAll`, so `count` is genuinely a
  floor. `RECORD_ESCALATION` checks only `movement.closure`, so escalation really is unvalidated.
  `isOpen` reads `closure` and `stage` and no clock, so the "`now` is not part of the answer" claim
  holds.
- **Null-versus-zero.** `DECLINE_REASONS` has exactly **7** members, so the "seven rows" comment is
  current; `declinesByReason` maps the vocabulary with no filter, so the row count equals
  `vocabularySize` by construction; every count field is typed `number` and every average
  `number | null`. `averageWaitlistWaitMinutes: null` is returned literally by `wardStatistics`.
  `emptyBedMinutes` now returns `gap < 0 ? null : gap` — the clamp really has gone, so
  `statistics-derivations.ts`'s "the two modules agree" is true of the two instants it is about.
  No place was found conflating a null average with a zero.
- **The 2026-09-01 departure-destination additions.** `LeavingDestination` now has **8** members
  (`died-on-the-ward`, `transferred-to-custody`, `did-not-return` added). No file on the statistics
  surface states a count of departure destinations, so the stale-count defect that hit the community
  screens has no foothold here.
- **The access disclaimer.** _"There is no role check on this route"_ is true: the only gate above
  these routes is `DeveloperAreaGate` in `src/app/mockups/ward-flow/layout.tsx`, which contains no
  role logic, and the sentence correctly scopes itself to "anyone who can reach the Ward Flow
  mockups". Both disclaimer sentences are pinned **whole** in `tests/ward-statistics.dom.test.tsx`
  and `tests/ward-statistics-sections.dom.test.tsx`, as claimed.
- **`ward-statistics.ts` has no consumer in `src`.** Verified independently of the comment: no file
  under `src` imports `@/components/ward-management/ward-statistics`, and
  `tests/ward-statistics-sections.test.ts` really does walk `src` for that import
  (`it("finds no module under src importing ward-statistics")`). The five figures the ward page names
  as already derived are all present on `WardStatistics`.
- **ED-screen record claims.** `export type EmergencyDepartment = { id: string; siteCode: string;
name: string; };` — three fields, no more. `originEdId: string;` is required and its own doc reads
  _"Where the patient physically is."_ `raisedAt: Instant;` is required, `triagedAt?: Instant;` is
  optional, and nothing in the model orders them. `did_not_proceed` is a real `Movement.closure`
  outcome. No `offered` field exists anywhere in `ward-model.ts` or `ward-admissions.ts`.

# Residual risk

The one thing this audit cannot close is the register's own exclusion class 1: a claim that is
correctly cited and still does not _follow_ from its evidence. I read every citation constant in
`statistics-claims-register.ts` and spot-checked roughly a third of the 90 `MODEL_CLAIMS` entries
against the real declarations; I did not re-derive all 90. The claims I did not individually re-check
are concentrated in the community-index block, which is out of scope by instruction.
