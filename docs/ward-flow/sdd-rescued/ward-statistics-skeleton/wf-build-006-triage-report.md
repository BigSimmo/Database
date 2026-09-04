# WF-build-006 mutation triage report

Working directory: D:/Worktrees/Database/ward-builder-community-route (branch `claude/ward-builder-community-route`).
Baseline HEAD: `0221c3f7c357ceafe2634847efa07559feb16c78`. Tree confirmed clean at start.

Suite discovered: `ls tests/ward-*.test.ts tests/ward-*.test.tsx` → **148 files** (well above the 100-file refusal floor). Full suite run after every mutation: `npx vitest run tests/ward-*.test.ts tests/ward-*.test.tsx` — all 148 files, no narrowing.

---

## Finding 1.6 — `ward-statistics-derivations.test.ts` · "finds seeded movement declines..."

**Test named:** `it("finds seeded movement declines, so the withheld-not-absent claim describes a real world")`, assertion `expect(decline.unitId.length).toBeGreaterThan(0)`.

**Production edit (first attempt, exactly as the finding names it):** renamed `id: "rph-adult-secure"` → `id: "rph-adult-secure-renamed"` in `src/components/ward-management/ward-sites.ts` (single occurrence, line 55), leaving the decline in `ward-movements.ts` pointed at the old id.

**Result of first attempt:** 32 test files went red (118 tests), none of them `ward-statistics-derivations.test.ts`. But the failures were not about the decline-names-a-real-unit property — this unit id is referenced pervasively by admissions, bed layouts, and DOM fixtures throughout the seed, so the rename broke many unrelated properties (e.g. `ward-admissions-seed.test.ts` → "names only units that exist in the network", which checks `wardAdmissions`, not `movement.declines`). This mutation was too blunt to isolate the specific property in question, so it was reverted (hash verified restored: `da22acb71a4a160a53e084fc2a2e824a5c6cdccc8b5f92f6ecdd353e8cfb364f`) and redone more surgically.

**Production edit (isolated retry):** in `src/components/ward-management/ward-movements.ts` line 296, changed the decline itself: `{ unitId: "rph-adult-secure", ... }` → `{ unitId: "rph-adult-secure-nonexistent", ... }`. `ward-sites.ts` untouched, so only this one decline record points at a unit that doesn't exist.

**Full list of test files that went red (4 of 148):**

- `tests/ward-escalation.test.ts` — `escalationBoard > on the standard night, exactly WF-009 and WF-308 have nowhere eligible`:
  `expected [ 'WF-308' ] to deeply equal [ 'WF-009', 'WF-308' ]` — WF-009 dropped out of the "nowhere eligible" set because the eligibility gate no longer resolves that decline against a real unit.
- `tests/ward-scenarios.test.ts` — `the standard night leaves most open movements real choice, but already strands two`:
  `strandedMovements` moved from `2` to `1` and `eligiblePairs` from `340` to `341`.
- `tests/ward-patient-page.dom.test.tsx` — `lists each decline's unit, fixed reason label, and time — never a raw snake_case reason code`:
  `Unable to find an element with the text: ... unitById("rph-adult-secure")?.name ... · No bed available` — the rendered decline name went missing.
- `tests/ward-escalation.dom.test.tsx` — `shows the real fixture's non-empty sections as tables...`:
  `expected 'Nowhere eligibleMovement...' to contain 'WF-009'` — WF-009 disappeared from the rendered escalation board.

`ward-statistics-derivations.test.ts` stayed green throughout — confirmed 0 matches for that filename in the failure output.

**Classification: MIS-ATTRIBUTED.** The named test's `.length > 0` check is exactly as toothless as the finding says — it does not verify the decline names a _real_ unit. But the underlying property (declines must resolve to real units) is genuinely guarded, just by other files: the clinical eligibility computation in `ward-escalation.ts`/scenario derivation (pinned by `ward-escalation.test.ts` and `ward-scenarios.test.ts`) and the rendered decline name lookup (pinned by `ward-patient-page.dom.test.tsx` and `ward-escalation.dom.test.tsx`). Nothing is actually at risk in production; the remedy is renaming/reframing the 1.6 assertion honestly (or deleting it) rather than adding new coverage — the real guard already lives in those four files.

Revert verified: `sha256sum src/components/ward-management/ward-movements.ts` = `f9986204c166dc927bacb23b6f807950934e1dc39b663d71b60d20302054909c`, matches pre-mutation hash.

---

## Finding 5.3 — `ward-statistics-sections.test.ts` · "finds no module under src importing ward-statistics"

**Test named:** `it("finds no module under src importing ward-statistics")` — scans `src` for the literal substrings `ward-management/ward-statistics"` / `ward-management/ward-statistics'` and asserts zero matches.

**Production edit (exactly as the finding names it):** in `src/components/ward-management/ward-sidebar-content.tsx` (a real sibling in the same directory, confirmed already using relative imports for `./ward-nav`, `./ward-nav-icons`, etc.), added:

```ts
import { wardStatistics } from "./ward-statistics";
```

and, inside `WardSidebarFooter` (rendered by both the desktop sidebar panel and the phone drawer), added a genuinely rendered figure:

```tsx
<span data-testid="mutation-1-6-ward-figure">{wardStatistics("mutation-probe-unit", [], 0).readyToLeaveCannot}</span>
```

**Full list of test files that went red:** none. `npx vitest run tests/ward-*.test.ts tests/ward-*.test.tsx` → **148 files passed, 2138 tests passed**, identical totals to the clean baseline. `ward-statistics-sections.test.ts`'s "finds no module under src importing ward-statistics" assertion stayed green.

**Classification: GENUINELY UNGUARDED.** The relative-import form is real (confirmed live at `ward-nav-icons.ts:27`, `ward-sidebar-content.tsx:8`), the scan only matches the alias/deep-path string form, and no other test in the 148-file suite noticed a real, rendering consumer appear. The sentence `statistics-ward-screen.tsx` puts in front of the reader — that `wardStatistics` has no consumer in the app — is now false on screen, and nothing anywhere went red. Remedy: broaden the scan to also match the relative form (e.g. `from "./ward-statistics"` / `from "../ward-statistics"`), and add a positive control (a probe import that the scan must catch) so an empty result is trustworthy rather than indistinguishable from a broken probe — the reader's own control run against `ward-referrals` (5 files) versus `ward-statistics` (0, in both import forms) already demonstrates this gap.

Revert verified: `sha256sum src/components/ward-management/ward-sidebar-content.tsx` = `f000d497d1ca64352b55d28693ef8fdc7db16bb45f1cd2b0fd5ad1780aa0bc7f`, matches pre-mutation hash.

---

## Finding 7.7 — `ward-statistics.test.ts` · eight assertions that cannot fail because the assertion above already decided the value

**Test named:** three clusters in `ward-statistics.test.ts` — (a) lines 66-72, a `toBeNull()` trio followed by two `not.toBe(0)` checks; (b) lines 119-123, `expect(...).toBe(30)` followed by three `not.toBe(1030/500/1000)` checks; (c) lines 158-161, `expect(...).toBe(4)` followed by two `not.toBe(6/2)` checks.

**Production edit:** in `src/components/ward-management/ward-statistics.ts`, `emptyBedMinutes()` was changed to compute the gap as `leftAt - arrivedAt` (length-of-stay, the "arrivedAt -> leftAt" swap the test's own comment names as a plausible bug) instead of `arrivedAt - pulledAt`, whenever `leftAt` is present. Against cluster (b)'s fixture this produces the exact wrong value the test's own comment predicts (500, "arrivedAt -> leftAt").

**Full list of test files that went red:**

- `tests/ward-statistics.test.ts` — `measures pull to arrival, and none of the other three plausible swaps`:
  `AssertionError: expected 500 to be 30` at **line 119**, the anchor `toBe(30)` — the decisive message. Vitest reported no failure from lines 121-123 at all; they were never reached, because the test function terminates at the first thrown `expect` failure.
- `tests/ward-statistics-incoherent-gap.test.ts` — 3 tests (collateral, same `emptyBedMinutes` function): `AssertionError: expected 940 to be 60` and two others — a distinct, unrelated file whose own assertions caught the same production change for a different reason (the incoherent-gap exclusion), not evidence for or against 7.7's claim.

**Classification: CONFIRMED AS FILED (decorative, not a coverage gap) — this does not fit MIS-ATTRIBUTED/GENUINELY UNGUARDED/PARTIALLY GUARDED, and it is not "NOT A FINDING" either, since nothing here fails to reproduce. The finding's own "no falsifying change exists" claim reproduces empirically.** The mutation directly demonstrates the mechanism the finding describes: when the anchor equality (line 119) goes red, it is the _only_ assertion Vitest reports for that test — lines 121-123 never execute and therefore could never have caught anything the anchor did not already catch first. This is not a coverage gap (nothing is unguarded — the anchor equality pins the exact right value, and any wrong value that would violate the trailing `not.toBe` checks is, by construction, also not equal to the pinned value, so it always trips the anchor first). The finding is correctly classified by its own author: the eight tail assertions are decorative, not protective, and the risk is purely a reader crediting the file with diagnostic precision ("says exactly which wrong clock pairing produced it") it cannot deliver, since only the first failure of a test ever surfaces. No fix is a new test; the fix is removing the false diagnostic claim from the comments or restructuring the checks (e.g. as a single object comparison with descriptive sub-fields) if per-cause diagnosis is actually wanted.

Revert verified: `sha256sum src/components/ward-management/ward-statistics.ts` = `347ff3a9eee2c908cdecb1e41748452328f70fc338d26b57ce6e2d5103615759`, matches pre-mutation hash.

---

## Finding 8.3 — `ward-statistics-claims.test.ts` · a citation may witness itself

**Test named:** `it("finds every claim's evidence in its source file, exactly once")` in `ward-statistics-claims.test.ts` — reads `claim.sourceFile` from disk, collapses whitespace, and asserts `claim.evidence` occurs exactly once in it.

**Production edit, trial 1 (exactly as the finding names it):** for claim `statistics-ward-screen/computed/long-stays-are-derived` (evidence: the `longStays = liveAdmissions.filter(...)` line in `ward-statistics.ts`), (a) hardcoded `const longStays = 0;` in `src/components/ward-management/ward-statistics.ts` (matching the claim's own `falsifiedBy.change`: "returned as a fixed zero"), and (b) re-pointed that claim's `sourceFile` in `statistics-claims-register.ts` from `WARD_STATISTICS` to a new constant naming the register's own file (`statistics-claims-register.ts`), leaving `evidence` untouched — confirmed by script to occur exactly once in the register's own collapsed source.

**Result trial 1:** `ward-statistics-claims.test.ts` stayed fully green (confirmed 0 matches for that filename in the failure output) — exactly as the finding predicts: the register reports green regardless of the real state of `ward-statistics.ts`. **One other file did go red**: `tests/ward-statistics.test.ts` — `counts exactly the admissions whose stayBand is over-3-months...`: `AssertionError: expected +0 to be 1` at the direct `expect(statistics.longStays).toBe(1)` behavioral assertion. This claim happened to have independent runtime coverage.

**Production edit, trial 2 (different claim, to check whether trial 1's outside catch was general or a coincidence of picking a computed-value claim):** for claim `community-index/enumeration/a-team-name-is-what-a-referral-stores` ("A team's name is exactly the string a referral stores, never composed or prettified"), (a) changed `src/components/ward-management/community/community-derivations.ts`'s `COMMUNITY_TEAM_PAGES` map from `name` to `name: name.toUpperCase()` (the exact composing/prettifying falsification the claim's own `falsifiedBy` predicts), and (b) re-pointed that claim's `sourceFile` to the register itself, evidence untouched.

**Result trial 2:** `ward-statistics-claims.test.ts` again stayed fully green throughout. Two OTHER tests in `tests/ward-community-hub.test.ts` went red:

- `has a page for exactly the teams a referral can name, and no others`: `AssertionError: expected [ 'ALBANY', 'ALMA STREET', …(63) ] to deeply equal [ 'Albany', 'Alma Street', …(63) ]` — this compares `COMMUNITY_TEAM_PAGES.map((team) => team.name)` against the untouched `communityTeamOptions()`, so it directly caught the case change.
- `puts AD-LEFT-01 on Inner City Clinic's page, and on no other team's`: `AssertionError: the seeded community link is gone. ... expected [] to deeply equal [ 'Inner City Clinic' ]` — a downstream lookup-by-exact-name broke as collateral.

**Classification: MIS-ATTRIBUTED, with an important caveat.** In both clean, isolated reproductions, the specific mechanism the finding targets — the citation-exactness check — is exactly as broken as claimed: it reports green regardless of the real state of the cited production fact once `sourceFile` is re-pointed at the register's own file, because the register necessarily contains its own evidence string as a literal. This confirms the vulnerability is real and the finding's central claim ("nothing forbids it pointing at the claims register itself") is correct. However, in both trials tested, an **unrelated, coincidental behavioral test** (not the documentation-integrity mechanism) caught the underlying regression anyway — `ward-statistics.test.ts` for a computed count, `ward-community-hub.test.ts` for a rendered name. The finding's own text ("no other check would notice") does not hold for either claim actually tested. **This caveat matters:** both claims tested happen to describe values with independent runtime assertions elsewhere. The register also carries many purely prose/comment/absence claims (about 86 total) with no obvious computed counterpart to accidentally guard them; this triage did not test one of those, so whether "MIS-ATTRIBUTED" holds for the whole register or only for computed-value claims like the two tested here is not established — a claim describing an absence or a pure convention is plausibly still genuinely unguarded once self-citation is possible. Remedy either way: forbid `sourceFile` equal to the register's own path (a one-line guard), which closes the hole for every claim regardless of whether an accidental behavioral test exists for it.

Revert verified: `sha256sum src/components/ward-management/community/community-derivations.ts` = `7d1df42bc503791bb08acbd3e0a6092c87d9a734c8196678aaf4980906376995`; `sha256sum src/components/ward-management/statistics/statistics-claims-register.ts` = `9e68186cd221dc68a454d2b00fe65a23f38fdc2f4db6295265b3b36cb85d8f96`. Both match pre-mutation hashes. `src/components/ward-management/ward-statistics.ts` was also reverted mid-trial-1 and independently verified there.

---

## Finding 9.7 — `ward-community-hub.test.ts` · three assertions where production computes the expectation

**Test named:** `it("has a page for exactly the teams a referral can name, and no others")` — `expect(COMMUNITY_TEAM_PAGES.map((team) => team.name)).toEqual([...communityTeamOptions()]);` plus `expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(1);` (floor only).

**Production edit, trial 1 (as the finding's falsifier names it, "cap at twenty" variant):** in `src/components/ward-management/referrals/referral-destination-options.ts`, `communityTeamOptions()` was capped with `.slice(0, 3)`, dropping the option list from 65 teams to 3 (`COMMUNITY_TEAM_PAGES` is built by `.map()`-ing directly over this same function's output, so both sides of the comparison shift together by construction).

**Production edit, trial 2 (the finding's other named variant, more surgical — "discard clinic spellings seen only once"):** reverted trial 1, then changed `communityTeamOptions()` to filter out any clinic spelling whose winning count is 1, dropping the list from 65 to 43 teams — closer to the finding's literal wording and less disruptive to unrelated source text, run as a check on whether trial 1's collateral catches were a property of the mutation's shape rather than of the size-loss itself.

**Full list of test files that went red — identical in both trials:**

- `tests/ward-statistics-claims.test.ts` — `finds every claim's evidence in its source file, exactly once`: `ITS EVIDENCE IS GONE` for claim `community-index/enumeration/the-vocabulary-comes-from-one-source-document`, which cites `communityTeamOptions()`'s entire function body verbatim as evidence for an unrelated claim ("the team vocabulary is read out of ... one source document"). Any edit to that function's body — regardless of whether it changes team count at all — breaks this citation; it is not testing team-count completeness.
- `tests/ward-nav.test.ts` — `every dynamic Ward Flow route names every instance it serves, or records exactly how many it orphans`: `expected [ Array(1) ] to deeply equal []` — the dynamic-route reachable-instance count for `/mockups/ward-flow/community/[teamId]` no longer matches its recorded `WARD_DYNAMIC_ROUTE_ORPHANS` entry. This is an orphan-count bookkeeping check, not a check that the real team list is complete; it trips on any count change, expected or not.
- `tests/ward-community-hub.test.ts` — `puts AD-LEFT-01 on Inner City Clinic's page, and on no other team's`: `expected [] to deeply equal [ 'Inner City Clinic' ]` — a single hard-coded seed fixture happens to reference the team "Inner City Clinic" by name, which was among the teams dropped in both trials. This catch is contingent on that one seeded name surviving or not; a different cap boundary or different discarded spellings could easily leave it intact.

**None of the three catches are a systematic guard for "does the community hub show every real team."** The named assertion (`toEqual([...communityTeamOptions()])`) is genuinely self-referential exactly as the finding says: `COMMUNITY_TEAM_PAGES` is derived directly from `communityTeamOptions()`, so any change to the option-builder's OWN output moves both sides of the comparison together and cannot be caught by this test — confirmed identically across a drastic (`.slice(0,3)`) and a surgical (drop-singletons) mutation. The `toBeGreaterThan(1)` floor is exactly as toothless as described — both 3 and 43 satisfy it.

**Classification: GENUINELY UNGUARDED.** The specific named assertions cannot fail under the finding's falsifier (confirmed twice). The three collateral failures observed are incidental artifacts of the mutation's mechanics (an unrelated citation spanning the whole function body; an orphan-count bookkeeping check; one hard-coded seed fixture's team choice) rather than a real, general guard against the described risk — a differently-shaped change to the same function (e.g. one that preserved the citation's cited text, avoided the specific seeded team, and didn't change the reachable-instance count) would plausibly pass all 148 files while still silently losing most of the ~65 real teams. Remedy is a new test: an independent check on `COMMUNITY_TEAM_PAGES.length` against a real, non-trivial floor derived from something other than `communityTeamOptions()` itself (or a hand-counted minimum from the source catchment data), plus an id-uniqueness/coverage check that does not simply recompute the same function twice.

Revert verified: `sha256sum src/components/ward-management/referrals/referral-destination-options.ts` = `df41b0541401738fc6fb7b701c6a248382032bf0235de6bbdba8b2fdcfa0086a`, matches pre-mutation hash (confirmed after both trials).

---

## Finding 13.4 — `ward-community-index.test.ts` · the declared size hole is confirmed open

**Test named:** none directly — the finding is about an _absence_. The file's own header (lines 26-34) states outright: "WHAT THIS FILE DELIBERATELY DOES NOT PIN: the number of teams ... **The fixture-size pin belongs in the fixture's own suite** (`tests/ward-community-hub.test.ts` ...) ... **the exact-size pin is not in it yet** — recorded here so the gap is visible rather than assumed closed." This is a self-documented gap, and finding 13.4 verifies the delegate (`ward-community-hub.test.ts`) does not actually carry the pin it was delegated to.

**Production edit:** reused the same two mutations run for finding 9.7 (same underlying function, `communityTeamOptions()` in `src/components/ward-management/referrals/referral-destination-options.ts`) — trial 1 capped the team list to 3 (65 → 3) with `.slice(0, 3)`, trial 2 discarded singleton spellings (65 → 43) — since both findings depend on the identical production mechanism and both mutations were already run and reverted with verified hashes as part of finding 9.7's investigation above.

**Full list of test files that went red:** identical to finding 9.7's list in both trials — `tests/ward-statistics-claims.test.ts`, `tests/ward-nav.test.ts`, `tests/ward-community-hub.test.ts` (all three for reasons unrelated to team-list size, detailed under finding 9.7 above). **`tests/ward-community-index.test.ts` stayed green in both trials** — confirmed 0 matches for that filename in either run's failure output, out of 148 files run each time.

**Classification: CONFIRMED AS FILED — effectively GENUINELY UNGUARDED (real risk, nothing catches it), but distinguished from a normal finding because the gap is self-disclosed rather than hidden behind a misleadingly green test. This is not "NOT A FINDING": the finding does not fail to reproduce, it reproduces exactly as described.** This finding does not describe a test that wrongly appears to guard something; it describes, and the mutation confirms, a genuinely open, self-documented gap. The file's own header already states the size pin does not exist anywhere and explains why (division of labour with `ward-community-hub.test.ts`, so a fixture change and an index bug fail distinguishably). The mutation adds nothing beyond what the header already discloses, except empirical confirmation that the claim is true: with the team list silently cut from 65 to 3 (or to 43), `ward-community-index.test.ts` stays fully green (as its header says it will, deliberately), and `ward-community-hub.test.ts`'s only nominal size check — `toBeGreaterThan(1)` (see finding 9.7) — also stays green in both cases. No exact-size pin exists anywhere in the 148-file suite. This is real, acknowledged verification debt rather than a false sense of security — the header does not claim coverage it lacks — but the underlying risk (62 teams disappearing unnoticed) is exactly as open as finding 13.4 says.

Revert: no separate revert needed — both mutations for this finding were the same edits already reverted and hash-verified under finding 9.7 (`sha256sum src/components/ward-management/referrals/referral-destination-options.ts` = `df41b0541401738fc6fb7b701c6a248382032bf0235de6bbdba8b2fdcfa0086a`, confirmed after both trials).

---

## Finding 13.3 — `ward-community-index.test.ts` · a pin that does not test its subject

**Test named:** `it("the field the notice now describes really does exist, so this pin cannot outlive its subject")` — `expect([...FOLLOW_UP_STATES].sort()).toEqual(["arranged", "not_arranged"]);`, whose comment claims "If `followUp` is ever removed from the model, this import stops resolving and the wording above must be revisited."

**Production edit (exactly as the finding names it):** in `src/components/ward-management/ward-admissions.ts`, deleted the field declaration `followUp: FollowUpRecord | null;` from the `Admission` type, and deleted its corresponding entry `followUp: true,` from `ADMISSION_FIELD_PRESENCE`. `FOLLOW_UP_STATES` (a separate, independent named export in the same file) was untouched.

**Full list of test files that went red:** `tests/ward-admission-model.test.ts` (2 tests):

- `declares exactly the permitted field set at runtime`: `AssertionError: expected [ 'arrivedAt', …(18) ] to deeply equal [ 'arrivedAt', …(19) ]` — a diff showing `"followUp"` missing from the runtime field list.
- `holds no name, date of birth, record number, address, free text, or diagnosis beyond the one authorised block`: `AssertionError: expected [ 'id', 'unitId', 'referralId', …(16) ] to have a length of 20 but got 19`.

`tests/ward-community-index.test.ts` stayed green throughout — confirmed 0 matches for that filename in the failure output. The named pin's `FOLLOW_UP_STATES` import kept resolving exactly as the finding predicted, because it is an independent export from the field it was assumed to be coupled to.

**Classification: MIS-ATTRIBUTED.** The pin's own comment claim is false, exactly as the finding says — `FOLLOW_UP_STATES` and `Admission.followUp` are independent exports of the same module, so deleting the field does not touch the import. But the underlying risk (the `followUp` field silently disappearing from the model) is genuinely, reliably guarded — just by a different, general mechanism: `tests/ward-admission-model.test.ts`'s structural privacy allowlist, which enumerates every `Admission` field at runtime and compares it against a fixed, hand-maintained list (`ALLOWED_ADMISSION_FIELDS`). That check is not a coincidental one-off (unlike the collateral catches under finding 9.7) — it is specifically designed to catch any field silently added to or removed from `Admission`, and would catch this exact class of change regardless of which field were removed. Remedy: honest rename — the comment should point at the real guard (`tests/ward-admission-model.test.ts`'s field-presence check) rather than claiming an import-resolution mechanism that does not exist for this pin.

Revert verified: `sha256sum src/components/ward-management/ward-admissions.ts` = `85bd076575a46073384420d5e65e722ae648cb3d8fb865f08356b4838028e120`, matches pre-mutation hash.
