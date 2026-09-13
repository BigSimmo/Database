# Audit: is the claims-register falsifiability mechanism theatre anywhere?

File audited: `src/components/ward-management/statistics/statistics-claims-register.ts`
Method: read the whole file (1977 lines) plus loaded it with `tsx` and ran it against the real
source files on disk — for every `MODEL_CLAIMS` entry, mechanically checked that `evidence`
occurs in `sourceFile` exactly once, that `falsifiedBy.find` occurs exactly once, that applying
`find → replaceWith` in memory actually makes `evidence` absent, and located the exact byte
position of every `evidence` match in the _unnormalised_ source to classify it as comment,
string literal, or executable/type code. No file under `src/`, `tests/`, `scripts/` or `docs/`
was modified. Nothing in the test suite was run.

## Counts

Counted by array length, not by any comment or prior claim:

- `MODEL_CLAIMS.length` = **85**
- `UNEVIDENCED_CLAIMS.length` = **13**

## Summary table

| entries in code |     entries in comments | entries in string literals |               tautological edits |   duplicate-evidence groups | evidence not found / found >1× |
| --------------: | ----------------------: | -------------------------: | -------------------------------: | --------------------------: | -----------------------------: |
|              82 | 1 (boundary, see below) |                          2 | 0 clear-cut / 2 weak (see below) | 11 groups, 27 entries total |                              0 |

Mechanically, **every** entry's `evidence` was found exactly once in its `sourceFile`, every
`falsifiedBy.find` was found exactly once, and applying every falsifying edit in memory did make
`evidence` go absent, and every `rendered` locator was found exactly once in its `renderedIn`
file. The mechanism is sound at the "does the plumbing work" level for all 85 entries — the
defects below are all at the level of "does the plumbing point at the right thing," which is
exactly what the register's own §5 says a mechanical check cannot see.

## 1. Comment-pinned evidence

**One boundary case, not a clean miss.**

`statistics-compare-screen/attributability/admissions-always-carry-a-unit` (sourceFile
`ward-admissions.ts`) cites:

```
"begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string;"
```

The first ~90 characters of this string sit inside the doc comment above the field
(`ward-admissions.ts:264-265`); the string only becomes code at `*/ unitId: string;`. The match
_starts_ inside a `/** ... */` block comment. On the letter of "does the evidence land inside a
comment," this is the entry the audit was told to expect.

In effect it is not dangerous, though: the `falsifiedBy` edit (`unitId: string;` →
`unitId: string | null;`) targets exactly the trailing code token, not the comment prose, and
that token is what actually determines whether the claim ("`Admission.unitId` is a required
string") is true. A real retype to nullable would still delete the cited substring and go red.
What the comment-crossing citation buys instead is _fragility in the wrong direction_: a
harmless reword of that one sentence in the doc comment (e.g. "begins a fresh one" for "begins a
new one") would break the pin for a reason unconnected to the claim — a false red, not a false
green. `unitId: string;` alone is already unique in the file (verified: it appears once), so the
reach into the comment was not needed for uniqueness and should be trimmed to just the code
token. Not urgent, but it is needless fragility riding on the more dangerous-looking shape.

No other entry's evidence starts or ends inside a comment. This means the specific "explanation
changed, comment kept saying the old thing, pin stayed green" failure mode that motivated this
register (the ReferralAddressing/BedRelease/WARD_DESTINATION_ARM defects from 2026-09-01) does
not currently recur anywhere in the 85 entries.

## 2. Falsifying edits that change nothing real

Ten entries have `falsifiedBy.find === evidence` and `falsifiedBy.replaceWith === ""` — the
shape the brief specifically asked about (delete the very string you then assert is absent):

1. `statistics-screen/refused-so-far/the-cap-on-parallel-referrals-exists`
2. `statistics-screen/pull-to-arrival/the-bed-was-given-away-instant`
3. `statistics-screen/pull-to-arrival/the-arrival-instant`
4. `statistics-section-frame/back-link/the-hub-route-is-named-once`
5. `statistics-compare-screen/double-count/the-parallel-referral-cap-exists`
6. `statistics-ed-screen/attributable/a-movement-records-its-stage`
7. `statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-unit-guard`
8. `statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-note-guard`
9. `community-index/link/the-href-builder-lives-in-the-team-screen`
10. `community-index/link/the-team-screen-is-a-client-module`

**Eight of these are plausible, not tautological.** #1/#2/#3/#5/#6/#9 all pin a bare _existence_
claim ("a constant/field named X exists," "the record keeps this instant," "the record exports
this function") — for an existence claim, deleting the declaration is not a degenerate edit, it
is close to the _only_ edit that could falsify it, and it corresponds to a real change a
developer could make. #4 and #10 explicitly say in their own `change` text that the edit only
covers the "exists" half and name the untested half in the same sentence (a second hard-coded
route copy for #4; a directive moved rather than deleted for #10) — that is the register's
documented "state the residual" pattern working as intended, not concealment.

**Two are genuinely weak, and not for the reason the shape suggests.** #7 and #8 both cite an
error-message string literal passed to `reject(state, event, "…")` inside `SET_BED_PREPARATION`
(`ward-flow-reducer.ts:1640-1646` and `:1657-1658`) as evidence that a _guard_ exists, then
falsify it by deleting the message text. But the message is not the guard — the guard is the
`if` condition around it (`event.actingUnitId !== release.unitId`, and the
`BED_PREPARATION_NOTES` membership check). A guard that was neutered by changing the condition
(e.g. made permanently false, or the check inverted so it always passes) while the `reject(...)`
call and its string were left in place as dead code would leave this evidence fully present and
the test green, while the claim "refuses an event whose acting unit is not the release's unit"
would be false. Unlike #4/#10, the `change` text for #7/#8 does not flag this gap — it states
flatly "the guard is removed," which overstates what the edit tests. This is the closest thing
in the register to the brief's "proves nothing about the claim" concern, though it is one step
more subtle than a pure tautology: it pins the guard's _symptom_ (its message) rather than its
_mechanism_ (its condition).

## 3. `find` appearing more than once in its source file

**None.** Checked all 85; every `falsifiedBy.find` occurs exactly once in its `sourceFile`.

## 4. Duplicate evidence strings across entries

Eleven groups (27 entries) share an identical (whitespace-normalised) evidence string within the
same `sourceFile`. Every group was checked against `renderedIn` and `rendered`: in every case the
sharing entries point at _different_ screens or _different_ paragraphs on the same screen, each
with its own distinct `rendered` locator, so each entry independently confirms that its own page
still carries the claim — this is the module's documented "three screens state the same fact, so
they share the citation and go red together" design (see its own comment at line 354), not
uninstructed duplication. No pure free-rider (identical evidence _and_ identical `rendered`
locator) was found. Full list, for completeness:

- `preparing-is-a-boolean` (statistics-screen + statistics-derivations)
- `addressing-has-one-unit-field` (statistics-screen + statistics-overview-screen + statistics-compare-screen)
- `ward-destination-records-bed-criteria` (statistics-screen + statistics-compare-screen)
- `accepted-unit-id-is-written-on-acceptance` (statistics-screen + statistics-compare-screen)
- `movement-declines-name-a-unit` / `a-decline-carries-one-reason-and-no-free-text` (both on statistics-screen, different paragraphs, different falsifying edits) / `movement-declines-name-a-unit` (statistics-overview-screen)
- `movement-carries-a-decline-list` (statistics-screen) / `a-movement-records-every-ward-decline` (statistics-ed-screen)
- `a-movement-is-inside-an-emergency-department` (statistics-screen + statistics-overview-screen) / `origin-ed-id-is-required` (statistics-ed-screen)
- `referred-unit-ids-holds-the-wards-still-deciding` (statistics-screen) / `referred-unit-ids-is-a-list` (statistics-compare-screen)
- `the-cap-on-parallel-referrals-exists` (statistics-screen) / `the-parallel-referral-cap-exists` (statistics-compare-screen)
- `referral-id-is-nullable` (statistics-screen + statistics-derivations)
- `referrals-carry-a-raised-instant` (statistics-screen + statistics-derivations) / `the-nearest-equivalent-measures-from-referral-raised-at` (statistics-ward-screen) / `raised-at-is-required` (statistics-ed-screen)
- `a-site-code-may-resolve-to-nothing` (statistics-compare-screen + statistics-ward-screen)

## 5. `UNEVIDENCED_CLAIMS` (13 entries)

Spot-checked the highest-risk ones directly against source rather than trusting the stated
reason:

- **`no-exhaustion-marker-exists-on-a-movement`** — checked. `Movement` does carry a
  `closure?: MovementClosure` field, which could look like a candidate the claim missed, but
  `MovementClosure` is `{ at, outcome: "arrived" | "did_not_proceed", reason }` — a terminal
  outcome, not an "every ward has declined, network exhausted" marker. Claim holds; genuinely
  un-evidencable by a presence-only substring test.
- **`nothing-anywhere-records-an-offer`** — checked (`grep -i offer` on `ward-model.ts`): the
  only hit is the prose comment at line 694; no field. Claim holds.
- **`no-instant-marks-entry-to-waitlisted`** — checked every `Instant` field on `Admission`:
  `pulledAt`, `arrivedAt`, `awayAtEmergencyDepartmentSince`, `expectedDischargeAt`,
  `dischargeDateSetAt`, `dischargeConfirmedAt`, `leftAt`. None marks entry to `waitlisted`. Claim
  holds.
- **`nothing-in-the-model-enforces-it`** (bed-readiness) — checked the full
  `SET_BED_PREPARATION` case: two guards (acting unit, note membership), no check of
  `release.state`. Claim holds.
- **`the-list-keeps-the-recorded-order`** — checked: no `.sort(` call anywhere in
  `statistics-compare-screen.tsx`. Claim holds; correctly deferred to the DOM test named in its
  `reason`.
- **`ward-statistics-has-no-consumer-in-the-app`** and
  **`nothing-links-to-this-index-yet`** — both name a specific guarding test
  (`tests/ward-statistics-sections.test.ts`, `tests/ward-community-index.dom.test.tsx`); both
  files exist.

The remaining six (`there-is-no-role-check-on-this-route`, `every-instant-is-invented`,
`a-matching-id-is-not-the-same-wait`, `triage-can-precede-the-referral`,
`ed-requests-arrive-verbally`, `did-not-proceed-usually-means-admission-was-not-needed`) are, by
their own nature, either whole-repository absence claims, provenance claims about how the fixture
was authored, or clinical/interpretive readings — none of these has a candidate field or line
that could serve as positive evidence; I did not find any of the 13 to be a claim that evidence
actually exists for but was simply not looked for. All 13 are genuinely un-evidencable by this
mechanism, and none looked to me like a claim quietly being sheltered from a check it could
actually pass.

## Bottom line

The register is not theatre in the way the brief specifically worried about (a claim pinned to
prose that can drift out of sync with behaviour while staying green). The one comment-crossing
citation is safe in effect because its falsifying edit targets the code tail, not the prose. The
one real weak spot is the pair of `SET_BED_PREPARATION` guard entries, which pin an error
message rather than the conditional that actually implements the guard, and whose `change` text
overstates what the edit tests without flagging that gap the way several neighbouring entries do.
