# Task report — the claims register

**Status: complete and green.** Commit `f21ba35aa` (single commit, base `2245e0ecf`).

## What was built

Two new files, both inside the writable scope:

- `src/components/ward-management/statistics/statistics-claims-register.ts` — the register.
- `tests/ward-statistics-claims.test.ts` — the test that resolves every citation against the real
  file on disk.

Nothing else was written. `ward-model.ts`, `ward-admissions.ts`, `ward-flow-reducer.ts`,
`ward-statistics.ts`, `ward-nav.ts` and every existing test are unchanged in the commit; the two
files temporarily mutated for the failure proofs were restored and hash-verified (below).

## The shape

```ts
type ModelClaim = {
  id: string; // <surface>/<place on it>/<what is claimed>
  renderedIn: string; // the file that MAKES the claim
  rendered: string; // a locator into that file — pinned exactly once
  claim: string; // one line, in the register's own words
  sourceFile: string; // the file the evidence lives in
  evidence: string; // an exact substring of it — pinned exactly once
};
```

The test asserts, for every entry: `sourceFile` exists, `evidence` appears in it **exactly once**,
`renderedIn` is a registered surface, and `rendered` appears in it exactly once. Zero occurrences and
two occurrences are **different failures with different messages** — "its evidence is gone" versus
"its evidence is ambiguous" — because they call for different fixes.

Whitespace is the only thing normalised, on both sides, so a Prettier re-wrap of a JSX paragraph is
not a false red. Nothing else is: no case folding, no punctuation stripping, no near-matching.

Every failure leads with the claim id and the claim in words; the fragment is quoted last and
truncated. All broken citations in a run are reported together rather than the first only, because a
model change usually falsifies several claims at once (mutation 1 below reds three).

### Numbers

- **74 claims pinned**, across nine surfaces: the statistics home page, the four section screens,
  the section frame, the disclaimers module, `statistics-derivations.ts`'s doc comments, and
  `community-index.tsx`.
- **12 claims recorded as unpinnable** in `UNEVIDENCED_CLAIMS`, each with the reason.
- Evidence is drawn from `ward-model.ts`, `ward-admissions.ts`, `ward-flow-reducer.ts`,
  `ward-statistics.ts`, `ward-sites.ts`, `ward-teams.ts`, `ward/ward-screen.tsx`,
  `referrals/referral-destination-options.ts`, `community/community-derivations.ts`,
  `community/community-screen.tsx`, `statistics-sections.ts`, and — for two cross-screen claims —
  `statistics-screen.tsx` itself.

### The one design decision the brief asked me to name

**The register cites the screen; the screen does not render from the register.**

The alternative was to hold each sentence here and have the screens render it. I did not, because
the sentences are JSX carrying `<code>`, `<strong>`, HTML entity escapes and in two cases a
conditional branch. Pulling them in would either flatten them into strings the DOM tests could no
longer pin, or turn this into a component module instead of a readable list.

No claim is stated twice as a result. `claim` is a one-line summary in the register's own words —
deliberately _not_ the page's sentence — and `rendered` is a short locator copied from the screen,
which is itself asserted to appear there exactly once. So the locator cannot drift out of agreement
silently either, and **both ends are checked**: the screen still says it, and the source still
supports it.

Three entries citing one piece of evidence (the `ReferralAddressing` body) is deliberate, not a
restatement — those three screens all state the same fact and should all go red together. What the
test forbids is the same claim recorded twice against the same paragraph.

### Whole-record citations

Five claims are of the form "this record holds X and nothing else", which no single-line citation
can witness. Those cite the **entire type body** as one substring: `ReferralAddressing`,
`EmergencyDepartment`, `Decline`, `CommunityTeam`, and the `psychiatric_ward` destination arm. Any
field added, removed or renamed on those records reds every claim standing on them at once. That is
the correct blast radius, and it is what mutation 1 demonstrates.

## Proof that it fails

Both mutations were applied with the register already committed, so nothing could be lost.

### Mutation 1 — the exact defect shape of 2026-09-01

Added `declinedUnitId?: string;` to `ReferralAddressing` in `ward-model.ts` (a second unit field
appearing on the record).

**Red, naming three claims:**

```
AssertionError: 3 claim(s) no longer rest on the source they cite:

CLAIM statistics-screen/declines/addressing-has-one-unit-field
  says: `ReferralAddressing` carries exactly one field that can name a unit: `acceptedUnitId`.
  made in: src/components/ward-management/statistics/statistics-screen.tsx
  ITS EVIDENCE IS GONE. src/components/ward-management/ward-model.ts no longer contains the source
  this claim was written from. …
CLAIM statistics-overview-screen/precedent/addressing-has-one-unit-field  …
CLAIM statistics-compare-screen/declines/addressing-has-one-unit-field  …
```

**And nothing else caught it.** With the mutation in place, the other nine suites ran
`175 passed | 1 expected fail` — green. `tsc` also passes, since the added field is optional.

Restored; `sha256 5adac215011a4d795d31261457eb0f19f81cee6e81b84839078003efcf888970` matches the
pre-mutation hash, and `git status` reports the file unmodified.

### Mutation 2 — the ambiguity failure, which is a different red

Added a plausible early return to `wardStatistics()` in `ward-statistics.ts` that also sets
`averageWaitlistWaitMinutes: null`. Nothing was renamed and nothing was deleted; the citation simply
stopped identifying one line.

```
AssertionError: 1 claim(s) no longer rest on the source they cite:

CLAIM statistics-ward-screen/blocked/waitlist-wait-is-always-null
  says: `WardStatistics.averageWaitlistWaitMinutes` is returned as a literal null on every path.
  made in: src/components/ward-management/statistics/statistics-ward-screen.tsx
  ITS EVIDENCE IS AMBIGUOUS. src/components/ward-management/ward-statistics.ts now contains this
  fragment 2 times, so it no longer identifies one fact …
```

Restored; `sha256 488ee19fa9234250500211b9fbf0a39cd7b0f0926298eb36e275543bfe2bb7eb` matches, tree
clean.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit          → exit 0
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx \
                    tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

The discovered list was echoed and counted before running, and the command refuses on an empty
discovery rather than letting an unmatched glob run the whole suite as "proof":

```
DISCOVERED (10): tests/ward-community-hub.dom.test.tsx tests/ward-community-hub.test.ts
tests/ward-community-index.dom.test.tsx tests/ward-community-index.test.ts
tests/ward-statistics.dom.test.tsx tests/ward-statistics.test.ts
tests/ward-statistics-claims.test.ts tests/ward-statistics-derivations.test.ts
tests/ward-statistics-sections.dom.test.tsx tests/ward-statistics-sections.test.ts

 Test Files  10 passed (10)
      Tests  187 passed | 1 expected fail (188)
```

The one expected fail is the pre-existing `it.fails` nav tripwire in
`tests/ward-community-index.dom.test.tsx`. `tests/ward-nav.test.ts` and
`tests/ward-landmarks.test.ts` were not run and not touched — another chat owns them.

No existing test was weakened. The register's own 12 tests are additive.

---

## The honest part: which of the seven would this have caught?

**Of the four named in the brief, on the day they were written: none.** That is the uncomfortable
answer and it is the true one.

| False claim                                                    | Caught when written? | Why                                                                                                                                                                            |
| -------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "`ReferralAddressing` carries no unit at all"                  | **No**               | A claim of absence. `acceptedUnitId` was already on the record, so any citation written that day would have been green beside a false sentence.                                |
| "nothing marks the moment preparation started"                 | **No**               | Same shape. `SET_BED_PREPARATION` already stamped `confirmedAt`; the citation would have been written against a reducer that already contradicted the prose.                   |
| "the record keeps [five instants]"                             | **No**               | An enumeration written against a record that already had seven. Citing five field lines individually: all five match. Citing the whole body: the body already had seven in it. |
| "follow-up is not recorded anywhere… there is no field for it" | **No**               | A claim of absence about a field that exists. Nothing in this mechanism scans for a field the prose denies exists — a substring can only witness what is there.                |

The remaining three of the seven are not enumerated in my brief, so I have not assessed them and am
not guessing.

**What it does catch, proven above:** the moment any of those four facts _changes_, every claim
resting on it goes red at once and names itself. Mutation 1 is precisely the "carries no unit"
defect arriving a second time, and it reds three screens together while the other 175 tests stay
green.

**What it does that is real but not a gate:** it makes writing a claim require opening the record
and copying its body. Copying the `ReferralAddressing` body means reading the line
`acceptedUnitId?: string;`, which is exactly where the first defect was visible. That is pressure on
the author, not detection, and I am not claiming it as a catch.

**Where the gap is now written down rather than hidden:** the twelve `UNEVIDENCED_CLAIMS` entries.
Four of them are the same shape as the four defects above — "nothing in the reducer stops a caller
flagging a bed nobody has left", "no instant on `Admission` marks entry to `waitlisted`", "there is
no role check on this route", "the unit list is not sorted". Naming them is all this mechanism can
do about them, and the register's doc comment says so in those terms rather than apologising.

### Two live risks the sweep surfaced and could not close

1. **`community-index.tsx` states a hard count in prose** — "that dynamic route serves sixty-five
   team pages", in the module doc comment. It is a count of derived fixture data. It cannot be a
   substring, and `tests/ward-community-index.test.ts` records a deliberate decision _not_ to pin
   the number (a drop to sixty-four should not break the suite). So the number can go wrong silently.
   Recorded as `community-index/reachability/the-route-serves-sixty-five-team-pages`.
2. **`statistics-ed-screen.tsx` states a fixture fact on the page** — "most seeded referrals carry
   no `triagedAt`". `statistics-derivations.ts` documents four earlier fixture claims on one
   paragraph that each falsified themselves silently; this is a fifth, on a rendered page rather
   than in a comment. Recorded as
   `statistics-ed-screen/attributable/most-seeded-referrals-carry-no-triaged-at`.

Both are owner/author decisions about the prose, not something this task should have edited.

### Scope note

The sweep covered rendered prose on the nine surfaces plus doc comments in
`statistics-derivations.ts` and `community-index.tsx`. Doc comments on the _screen_ components were
read but only partially registered — several of them make model claims (for example the ED screen's
"a `Unit` carries cohort, security, authorisation and capacity") that are not yet entries. That is a
known, bounded gap, and adding them is additive work against the same mechanism.
