# Task — make a false claim about the model FAIL, instead of being found by reading

## The problem this exists to solve

The Ward Flow statistics screens state facts about the data model in user-facing prose: that a
field is a boolean, that a record carries no unit, that nothing marks an instant, that a type keeps
five instants. **Five of those statements were FALSE and every one passed the entire test suite.**
Three more were true but overstated. They were found by a human-directed audit, not by a gate.

The pattern, now seen five times in one day: **the arithmetic is right and the explanation is
wrong.** Nothing in a test suite can read an explanation.

**What makes this worse than an ordinary comment rot:** these sentences are the page's whole
safety property. It refuses to show figures it cannot support and explains why — so a reader has
no way to check the explanation and every reason to trust it. A false explanation is worse than a
missing figure.

## What to build

A **claims register**: one module recording every claim the statistics screens make about the
model, each paired with the source evidence that makes it true — and a test that re-checks the
evidence still says what was cited.

```ts
// shape only — design the real one to fit
type ModelClaim = {
  /** Where the claim renders, so a reader can find it. */
  id: string;
  /** The claim in one line, in the words the page uses. */
  claim: string;
  /** The file the evidence lives in. */
  sourceFile: string;
  /** An exact substring that must still appear in that file for the claim to hold. */
  evidence: string;
};
```

The test asserts, for every entry: `sourceFile` exists, and `evidence` appears in it **exactly
once**. Not "contains" across the repo — in that named file, once. A claim whose evidence has
moved, been renamed, or become ambiguous goes red **naming the claim**, not the string.

## Why this catches what a suite could not

The five real defects decayed in ways this shape sees:

- _"`ReferralAddressing` carries no unit at all"_ — evidence would have been the type body. The
  moment `acceptedUnitId?: string` was there, the cited evidence would not have matched.
- _"nothing marks the moment preparation started"_ — evidence would be the reducer case. It writes
  `confirmedAt: event.now`, so the citation fails.
- _"the record keeps [five instants]"_ — evidence is the instant fields on `Admission`. Seven
  exist.

It does NOT catch a claim that is wrong the day it is written and whose evidence is cited
correspondingly wrongly. **Say so in the module's doc comment.** A guard that overstates its own
reach is the same defect one level up, and this project has already shipped that once today.

## Hard requirements

1. **Every claim currently rendered on the four statistics screens plus the home page gets an
   entry.** Sweep the prose; do not sample. If a sentence names a type, a field, an event or a
   file, it is a claim.
2. **The evidence must be a substring of the REAL source file**, read at test time. Never a copy
   pasted into the register — a copy cannot go stale, which is the entire point.
3. **Exactly-once matching.** A substring appearing twice means the citation no longer identifies
   a unique fact; treat that as a failure with its own message.
4. **The register lives beside the screens** (`src/components/ward-management/statistics/`), and
   its test in `tests/ward-statistics-claims.test.ts`.
5. **Do not weaken any existing test to make this fit**, and do not restate a claim in two places
   — if the register holds the claim, the screen renders from it or the screen is what the
   register cites. Say which you chose and why.
6. **Files outside `src/components/ward-management/statistics/**` and `tests/ward-statistics*` are
   READ ONLY.** Other chats own them.

## Prove it can fail

Pick two entries. Mutate the cited source file so the evidence no longer matches — restore it
afterwards with a matching hash — and show the test going red and naming the claim. A register
whose test has never been seen to fail is a list, not a guard.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
```

Derive the file list from disk. Every existing test must still pass.
