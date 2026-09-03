# Task — repair the claims register: the guard first, then the twelve citations

**Read `register-unfalsifiable-findings.md` in this directory first and in full.** It holds all
twelve findings, each with a concrete falsifying edit, plus the design for the replacement guard and
the two test defects. This brief is the ordering and the constraints; that file is the content.

## Why this task exists

The register checks that every statement the statistics and community screens make about the data
model is still supported by the code. **An audit judged all 74 citations against one test — "if this
claim became false, would the cited bytes change?" — and twelve fail it.** They are unguarded while
appearing guarded, which is worse than being unguarded, because the register's coverage number
counts them.

**The worst is the register asserting in prose that one of its own citations has a property it does
not have.** That is the register's own defect, one level up.

## ⚠️ ORDER MATTERS: GUARD FIRST, CITATIONS SECOND

With the new guard in place, **each of the twelve repairs proves itself as it is written** rather
than needing a separate review afterwards. Do not reverse this.

## Part 1 — the falsifying-edit guard

Every claim gains a recorded **falsifying edit**: a description of a change to `sourceFile` that
would make the claim false. The test applies it **in memory** and asserts the evidence substring is
then **ABSENT**.

```
for each claim:
  read sourceFile
  apply the recorded falsifying edit, IN MEMORY
  assert the evidence substring is now ABSENT
```

**No file is written, no suite runs, no build happens.** The existing check is already a substring
test over file contents, so this is a string transformation plus a second `includes()` — 74 of them
cost microseconds. That is why it is worth doing here and would not be worth doing against a real
test suite.

**Design the edit's representation yourself** — a find/replace pair, an insertion with an anchor,
whatever is simplest to write correctly 74 times. Say in your report what you chose and why.

**Keep `isEntirelyComment` as a cheap fast-fail with a clearer message**, but it stops being
load-bearing. **Do NOT ship my proposed tightening** (also testing for `*` continuations or a
trailing `*/`) — it was rejected as a better heuristic about characters when characters are not the
property, and it still misses a slice cut from the middle of a single-line comment.

**If you keep a comment check at all, the exact form is available**: locate the citation's match
index in the file and test whether it falls inside a `/* … */` or `//`-to-newline span. No
heuristic, no evasion, and it needs nothing the register does not already do.

**State the residual in the module's own doc comment**, honestly: an author can record a WEAK
falsifying edit that breaks the citation for a reason unrelated to the claim. That hole does not
close mechanically. It is much narrower than what exists now, because it requires deliberately
writing a misleading edit rather than merely picking a convenient string.

## Part 2 — the two test defects

- **Assert every `REGISTERED_SURFACES` entry has at least one claim.** `statistics-disclaimers.tsx`
  is listed as swept and pins nothing. A sweep and a failure to sweep are indistinguishable.
- **⚠️ PIN THE EXACT CLAIM COUNT. Do not floor it.** `>= 40` against 74 means **34 claims can be
  deleted in silence — and deletion is exactly how a red gets resolved by somebody who wants a green
  suite.** Pin it the way `ADMISSION_STATES.length` is pinned at 4.

## Part 3 — the twelve citations

Repair each, in the findings file's order. For every one, the new citation must be **bytes that
change when the claim becomes false** — and with Part 1 in place, the test proves that rather than
you asserting it.

**Two claims are ABSENCE claims that have been given citations anyway** (the ED-verbal-request one
and the missing-region one). By the register's own exclusion class 2 those belong in
`UNEVIDENCED_CLAIMS` with the reason. **Moving a claim there is a correct repair, not a retreat** — a
claim recorded as unguarded is worth more than one guarded by something that cannot fail.

**One entry may simply be deleted:** `the-missing-region-field-is-enforcement` contributes nothing
its sibling does not already catch, and reads as a second guard where there is one.

## Constraints

- **Files:** `src/components/ward-management/statistics/statistics-claims-register.ts` and
  `tests/ward-statistics-claims.test.ts` only. Everything else is READ ONLY — you will need to read
  `ward-model.ts`, `ward-statistics.ts`, `ward-admissions.ts`, `ward-sites.ts` and
  `referral-destination-options.ts` to find correct citations, and you must not write to any of them.
- **Do not weaken any existing assertion to make this fit.**
- **Do not reduce the claim count to make the pin easier.** If a claim is removed it is because it is
  an absence claim moving to `UNEVIDENCED_CLAIMS` or a duplicate, and your report says which.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list, refuse an empty discovery, and **report the RAN count, not the passed
count** — a run that dies at startup reports "0 failed", indistinguishable from a pass.

## Prove the guard fires

Pick two claims. Record a falsifying edit that does NOT break the citation — the exact shape of the
twelve — and show the test going red naming the claim. Then fix it and show green. **A guard
demonstrated only against inputs it passes is a predicate that catches nothing**, and that is the
mistake this register already made once.
