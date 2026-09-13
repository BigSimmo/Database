# Plan — one emergency department's own hub

**Ward Builder Three, 2026-09-04.** Planning only; no repository edits, no branch. Everything below
is read from `codex/task-ward-flow-live-state-20260831` with `git show`. I did not enter
`D:/Worktrees/Database/ward-lead`.

---

## ⚠️ Finding 0, before anything else: this screen is already built

The brief lists the primitives as committed and reads as a greenfield build. It is not.

| Already on the branch                             |                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ed/ed-screen.tsx` | **2,317 lines**, six `<section>`s                                                                                                                                     |
| `src/components/ward-management/ed/ed.module.css` | its own module, own local token block                                                                                                                                 |
| `src/app/mockups/ward-flow/ed/[edId]/page.tsx`    | the live route                                                                                                                                                        |
| six test files                                    | `ward-ed-screen`, `ward-ed-psychiatry-hub`, `ward-ed-answered-cap`, `ward-ed-transport-booking`, `ward-ed-withdraw-referral`, `ward-ed-referral-is-not-a-bed-request` |

Its six sections today: **Psychiatry inbox · Recently answered · Psychiatry outbox · Raise a
referral · This department's patients · Statewide capacity (read-only)**.

**So this is a REDESIGN against the prototype, not a build.** Every task below modifies. ⚠️ **Six
test files pin current behaviour, including two owner rulings (7 and 8, 2026-09-01) and the FD-18
purpose correction. A task that deletes a section deletes their subject.** Whether the prototype
replaces those six sections or is layered over them is **open — see Left open (4)**, and it is the
single largest scoping question in this plan.

---

## What the hub shows that the ED home does not

Asked directly. Measured from both files.

1. **Every waiting patient, not the worst three.** Home shows 3 of RPH's 9 and says so ("The
   remaining six are on the department's own hub").
2. **The per-patient ward ledger** — which wards were asked, in the order asked, each with its
   outcome and decline reason. Home carries only a count ("Declined by 3 wards"). 🔴 **This is the
   unruled surface. See below.**
3. **A detained marker on each individual row.** Home gives only a departmental count.
4. **The origin suburb per referral** (Highgate, Northbridge, East Perth…).
5. **"Placed out today"** — four named people, times, destination, and whether a ward declined
   first. **Home has no equivalent at all.** It is the only backward-looking panel on either screen.
6. **The department's own facts** — site, site code — and the explicit statement that _no bed count
   or census is held for this department_.
7. **Actions.** Refer a patient from this department, transport, this department's recent history.
   Home is navigation only.
8. **The stuck banner names individual patients.** Home's equivalent names departments.

**What is the HOME's and must not be duplicated here:** the eight-department denominator, the
health-service grouping, the department picker, the "worst department right now" hero, and the
cross-department comparison. The hub knows about exactly one department; its only outward link is
the existing "All emergency departments" item.

---

## 🔴 Decision 1 — the two screens count DIFFERENT POPULATIONS and both call it "waiting for a psychiatric bed"

**I did not go looking for this. Six figures for the same department on the same stated day
disagree, and the reason underneath them is not arithmetic.**

| For Royal Perth ED, Friday 4 September      | ED home                    | ED hub                       |
| ------------------------------------------- | -------------------------- | ---------------------------- |
| Waiting                                     | **9**                      | **9** ✅                     |
| Longest wait                                | **1d 6h**                  | **3d 6h**                    |
| Detained                                    | **6 of 9**                 | **5 of 9**                   |
| Nobody now looking / declined by every ward | **3**                      | **2**                        |
| Row identifiers                             | **WF-231, WF-244, WF-249** | **RF-076, RF-134, RF-088 …** |
| Past the 24-hour access target              | **2 of 9**                 | **not mentioned anywhere**   |

**The hub is internally consistent** — nine rows, five carrying a detained marker, two carrying the
stuck state, exactly as its own totals claim. **The home is the side that disagrees with it.**

⚠️ **And the identifier prefixes give the cause away.** The home says its count is _"counted from
**movements** currently open in an emergency department"_. The hub says _"each row is one
**referral** raised from this department"_. **Those are two different sets.** A patient physically
in the department with no referral raised yet is a movement with no referral; a referral raised from
the department for someone already moved is a referral with no open movement. They agree at 9 only
because two invented fixtures happened to.

**This is the statistics screen's conflation again, spread across two screens instead of within
one** — and it is worse here, because the reader crosses from home to hub by clicking, and expects
the second page to be the first page's detail.

**⚠️ NOT MINE TO RESOLVE, AND I AM NOT RESOLVING IT.** Which population "waiting here for a
psychiatric bed" names is a product question that binds both screens, and the ED home is being built
right now by somebody else. **Ward Lead: this needs one answer given to both builders, before either
freezes a fixture.** What this plan does is refuse to make it worse: **every task below states its
population in the panel's own words, and Task 2's test asserts that wording**, so whichever way it
lands, the screen cannot silently mean the other thing.

---

## 🔴 Decision 2 — the screen is planned so the unruled ED-visibility question does not block it

`ward-referral-visibility.ts` says so in its own header, and I quote it rather than paraphrase:

> **What is STILL NOT decided here.** Whether the same rule binds an EMERGENCY DEPARTMENT — whether
> an ED may see that a ward was also asked — is not in either ruling and is not taken by this
> module. No ED-scoped projection exists, because no ED-facing rule has been given. It is a product
> decision, not an implementer's, and adding one on the pattern below would be deciding it.

**The design CAN be planned without the answer, so I am not stopping.** It decomposes cleanly:

- **Layer A — what this department is holding.** Who is here, how long, detained or not, the purpose
  of each referral, this department's own arm state, and the access-target measure. **None of it
  needs another destination's data.** This is the whole screen except the ledger.
- **Layer B — what has been tried elsewhere.** Exactly the ward ledger, the stuck banner, the
  "nobody now looking" tile and chip, and the first item in the decision rail.

**Layer B becomes ONE component rendered into named slots, built LAST, behind the ruling.** Tasks 1–3
build Layer A and ship a complete, honest screen without it.

⚠️ **This is the same ISOLATION technique I used for the sensitive fields on the patient record, and
it is deliberately NOT the same reasoning.** I am reusing _"make it one removable unit"_. I am
**not** reading the community ruling across — an ED holds the patient physically while a bed is
found, which is a different relationship from receiving a referral, and "community is ward-like"
settling the pattern is exactly the inference the brief warns against.

### ⚠️ The trap I nearly walked into, recorded because the next planner will meet it

**My first instinct was to plan `edScopedReferral()` with no `destinations` field, matching
`WardScopedReferral` and `CommunityScopedReferral` — "the conservative shape, harmless either way".**
It is not harmless. **Building that projection IS ruling "no",** in the module whose own header says
adding one on that pattern would be deciding it. The conservative-looking option was the deciding
one. **No task below creates an ED projection of any kind.**

### Every place the answer bites, and what each one does under either ruling

| #   | Surface                                                | If ED **may** see | If ED **may not**                                                                                                                                                                            |
| --- | ------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | **The ward ledger** under each waiting row             | Built as drawn    | **Does not exist.** The waiting list loses its "what has been tried" column entirely                                                                                                         |
| b   | **The stuck banner** — "every ward asked has declined" | Built as drawn    | Cannot be computed at all; the loudest element on the page goes                                                                                                                              |
| c   | **"Nobody now looking" totals tile** and the row chip  | Built as drawn    | Both go with (b)                                                                                                                                                                             |
| d   | **"Needs a decision" rail, item 1**                    | Built as drawn    | Item goes; the rail keeps items 2 and 3                                                                                                                                                      |
| e   | **"Placed out today" → "1 ward declined first"**       | Built as drawn    | The phrase goes; the row stays                                                                                                                                                               |
| f   | **"Placed out today" → "Moved to RPH Adult Secure"**   | Built as drawn    | ⚠️ **STAYS EITHER WAY.** This is a `Movement`, not a referral arm — where the patient physically went, which the sending department must know to hand over. Do not remove it with the others |

⚠️ **(f) is the one somebody will over-correct.** A ruling about referral visibility is not a ruling
about where a patient physically is.

### ⚠️ (g) and (h) — the two the owner needs BEFORE ruling, because they are already shipped

**(g) The built inbox row already discloses that a ward was also asked.** Line 1084 of `ed-screen.tsx`
renders `referralPersonFacts(referral).join(" · ")`. That helper returns `[ageBand, sex, homeRegion]`
when the referral carries a ward arm and `[ageBand, homeRegion]` when it does not — its own comment
says sex "appears only for a ward referral, because it is HELD only there". **So an ED reader can
already tell, from whether a sex appears in that line, that a ward was also asked.**

**Stated at its true strength, not louder:** this is **one bit** — _that_, never _which ward_, never
the outcome, never how many. It is structurally the same inference FD-23 explicitly **permits** a
ward to make from its own arm reading `cancelled`, and calls "the owner's intent rather than a leak".
**I am not calling it a defect.** ⚠️ **But it means a ruling of "no" is a change to behaviour that
already ships, not merely a decision not to build the ledger** — and the owner should know that
before ruling, because it is the difference between declining a feature and ordering a fix.

**(h) The ED path has no projection at all, and takes the raw record.** `EdAddressedReferral`
(`ward-referrals.ts`) is `{ readonly referral: Referral; addressing; destination }` — **the whole
referral, `destinations` included** — and `ed-screen.tsx` pulls `referrals` straight off
`useWardFlow()`. FD-23's architecture is _projection, not a flag_, for a stated reason: _"Data that
reaches a component can be revealed later by a styling change, a new column or a debug panel."_
**Today the full destination list reaches this component whatever the screen chooses to render.**

⚠️ **Reported, NOT resolved. Narrowing `EdAddressedReferral` is as much a ruling as widening it**,
and it feeds two selectors this screen depends on. No task below touches it.

---

## Global Constraints

Everything in `2026-09-04-ward-flow-design-foundation.md` applies unchanged and is not restated. The
ones that will actually bite here:

- ⚠️ **`--ward-space-N` is N PIXELS.** Not a scale step.
- ⚠️ **The surfaces are `--ward-ground`, `--ward-canvas`, `--ward-chrome`, `--ward-subtle`.** No
  `--ward-panel`, no `--ward-sunken`. The prototype's own `--panel`/`--sunken` are prototype-local
  and must not travel.
- ⚠️ **`--ward-border-subtle` does not exist in `src/`.** It renders at full text contrast through a
  `currentColor` fallback — a token named _subtle_ painting as loudly as body text. Do not reach for it.
- ⚠️ **`ed.module.css` declares its OWN `--ed-space-*` block, in rem** (`--ed-space-4: 0.25rem`,
  `--ed-space-16: 1rem`). **This looks like a competing scale and is not** — those are the same
  pixel values `--ward-space-N` gives, written in rem. Fold them toward the ward tokens if a task
  touches them; do not "correct" the numbers.
- ⚠️ **`ed.module.css:25` paints `background: var(--surface)` on `.screen`, over the shell's ground.**
  **This plan assumes the ED-home builder has already removed it.** If it has not landed when a task
  starts, do not remove it here as a side effect and do not paint `--ward-ground` from this module —
  two painters and the token stops being one decision. Build, and note it.
- ⚠️ **`wardPlaceFor` takes TWO arguments — `wardPlaceFor(pathname, units)`** — and `units` must be
  the provider's live `useWardFlow().units`, never the frozen `allUnits()` fixture, or the header
  names the wrong place under an active scenario. An unresolvable `edId` returns `undefined`, and
  **the only honest rendering of `undefined` is nothing** — never "—", never a neighbouring department.
- ⚠️ **A `*.test.tsx` file matches NO vitest glob and silently never runs.** DOM tests are
  `*.dom.test.tsx`. **Never `toHaveClass(styles.x)`** — it cannot fail here.
- **Every guard ships with a mutation naming its expected message.** A guard is accepted because
  somebody watched it go red for the right reason, never because it passed.
- **Never `git add -A`; never `git stash`** — the stack is shared across 180 worktrees. Read the
  committed state with `git show HEAD:<path>`.
- **No invented figures.** Every number renders from state. The prototype's numbers appear only as
  fixture values.

---

## Task 1: The department identity block and the model-limit note

**Files** — Modify: `ed-screen.tsx` (the masthead at ~1013–1034), `ed.module.css`. Test:
`tests/ward-ed-hub-identity.dom.test.tsx`.

**Interfaces** — consumes `edById`, `siteByCode`, `.wardTokens`, `ward-panel`, `ward-shared`.
Produces no new export.

- [ ] **Step 1 — the failing tests**
  - `states that this department holds no bed count or census of its own`, asserting the sentence,
    not the panel's presence.
  - `an unresolvable department id renders the not-found heading and names no department`. ⚠️ Assert
    that **no** real department name appears — a test that only checks the heading passes while a
    neighbour's name is printed beneath it.
  - `renders the site code from the site record, not from the department name`.
- [ ] **Step 2 — implement.** Tokens only.
- [ ] **Step 3 — MUTATION**
  - Make the unknown-id path fall back to the first department → the not-found test fails **on the
    no-other-name assertion**, and the report must say which of the two assertions went red. If the
    heading assertion is the one that fires, the second assertion is not doing the work.
  - Delete the model-limit sentence → its own test fails by name.

## Task 2: The waiting list — Layer A only, with its population stated

**Files** — Modify: `ed-screen.tsx`, `ed.module.css`. Test:
`tests/ward-ed-hub-waiting.dom.test.tsx`.

**Interfaces** — consumes `edReferralsFor`, `referralClocks`, `referralPurposeLabel`,
`ED_ACCESS_TARGET_MINUTES`, `ward-chip`, `ward-figure`. **⚠️ Renders NOTHING from
`referral.destinations` beyond this department's own arm.**

- [ ] **Step 1 — the failing tests**
  - `the panel states in words which population it counts` — 🔴 the Decision 1 guard. Assert the
    sentence naming referrals-raised-here or movements-open-here, **whichever Ward Lead rules**, and
    that it appears in the panel header region, not only in a footnote.
  - `each row states its purpose in words` (the FD-18 requirement: every referral is declinable, so
    purpose is the only thing telling the flows apart).
  - `detained status is worded, never colour alone`.
  - `rows are ordered longest wait first`.
  - `a row shows no ward name and no decline reason` — 🔴 **the Layer A boundary, asserted
    positively.** This test is what keeps the unruled surface out until it is ruled in.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION, and the third one is the point**
  - Reverse the sort → the ordering test fails by name.
  - Remove the purpose label → its test fails by name.
  - ⚠️ **Render one ward name from `referral.destinations` into a row** → **the Layer A boundary test
    must go red.** If it stays green, the boundary is decoration and Layer B can arrive by accident.
    Report the message.

## Task 3: "Placed out today"

**Files** — Modify: `ed-screen.tsx`, `ed.module.css`. Test:
`tests/ward-ed-hub-placed-out.dom.test.tsx`.

**Interfaces** — consumes movements and `unitById`-free live `units`, `ward-panel`, `ward-shared`.

- [ ] **Step 1 — the failing tests**
  - `a movement into a ward bed names the ward it went to` — ⚠️ **this is surface (f) and it is
    correct under either ruling.** The test comment must say so, or a later reader removes it while
    tidying Layer B away.
  - `a referral on to another emergency department is counted as placed out, and says why`.
  - `an unresolved accepted unit states that it is unresolved and names no unit`.
  - `no "a ward declined first" phrase appears` — the Layer B boundary again, here.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Point `acceptedUnitId` at an id no unit holds → the unresolved test fails by name, and **no
    unit name is printed**.
  - Add the declined-first phrase → the boundary test goes red.

## Task 4 — 🔴 BLOCKED ON THE RULING. Do not start.

**The ward ledger, the stuck banner, the "nobody now looking" tile and chip, and decision-rail item
1**, as one component — `src/components/ward-management/ed/ed-other-destinations.tsx` — exporting
named slots the layout renders into position. **Removal stays a one-file edit.**

⚠️ **Not to be started, drafted, or scaffolded before the owner rules.** A scaffold with the slots
already cut is the ruling made in advance by a different route.

**And the wording carries the same weight as the code:** the prototype's own privacy note —
_"The ward ledger above is not shown to ward staff"_ — asserts a boundary this screen would be
standing on. **If the ruling is "no", that note must not survive as decoration**, because a
sentence describing a protection nobody implements is worse than silence.

---

## Figures

**No figure in this plan is invented.** Every one is quoted from a prototype or read from source, and
each is stated with where it came from. `ED_ACCESS_TARGET_MINUTES = 1440` is read from
`ward-model.ts`, where its own comment records that it is counted **up from `openedAt`, never a
deadline** — which is why the ED home's _"the department's own access measure, not a legal deadline"_
is worth keeping verbatim if the hub adopts it.

## Left open

1. 🔴 **The ED visibility ruling.** Blocks Task 4 only. **With (g) and (h) above put to the owner at
   the same time** — one is already-shipped behaviour, the other is an architecture gap, and a
   ruling made without either is a ruling made on a false picture of the current state.
2. 🔴 **Which population both ED screens count** (Decision 1). Blocks nothing, but it must reach
   both builders before either freezes a fixture.
3. **Whether the hub carries the 24-hour access target at all.** The home makes it central for this
   exact department and says two patients have passed it; **the hub does not mention it anywhere**,
   while the model holds the constant. A design call.
4. **Whether this redesign replaces the existing six sections or layers over them.** Six test files
   pin them, including two owner rulings and the FD-18 correction. **The largest scoping question
   here, and not one a task should answer by accident.**
5. **Whether the ED hub keeps its own `<h1>`** once the shell shows the place — inherited from the
   navigation-shell plan's open question, and live here because `wardPlaceFor` _can_ resolve this
   route to a department name, unlike the ED home.
