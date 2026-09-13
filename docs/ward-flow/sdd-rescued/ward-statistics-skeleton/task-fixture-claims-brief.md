# Task — remove the two prose claims about the fixture

**Owner-approved, 2026-09-01.** Two sentences on shipped pages state facts about the invented data
rather than about what the page can work out. Both are true today. Both will become false silently
when the data changes, and nothing will go red.

This is the fifth and sixth member of a class `statistics-derivations.ts` already records as having
**falsified itself silently four times on one paragraph**. The claims register cannot hold them:
a fixture count has no line to cite, and pinning one to a data file would go red on every seed edit
and teach a reader to ignore the red.

## The two

1. **`community-index.tsx`** — states "sixty-five team pages" in prose. `tests/ward-community-index.test.ts`
   deliberately declines to pin that number, and its fixture-size pin lives in the fixture's own
   test for exactly this reason.
2. **`statistics-ed-screen.tsx`** — states "most seeded referrals carry no `triagedAt`".

## What to do

**Remove the fixture assertion from each sentence. Do NOT delete the paragraph.** In both cases the
surrounding point is sound and load-bearing; only the clause asserting a property of today's data
comes out.

Replace it with what the page can establish, in the page's own voice. The rule the rest of this
screen already follows: **describe what the derivation can and cannot establish, never what the seed
happens to contain.** Where a quantity is genuinely needed, RENDER it from live state rather than
writing it — the referral-join figures on the home page are the pattern.

**A count that is rendered is fine. A count that is typed is the defect.** If a sentence reads
better with the number, render the number.

## Constraints

- **Files:** `src/components/ward-management/community/community-index.tsx`,
  `src/components/ward-management/statistics/statistics-ed-screen.tsx`, and their existing tests
  under `tests/ward-community-index*` and `tests/ward-statistics*`. Nothing else.
- **Do not touch** the seed, `ward-model.ts`, `ward-nav.ts`, `tests/ward-nav.test.ts` or
  `tests/ward-landmarks.test.ts` — other chats own all of them.
- **Update the claims register if either sentence is registered.**
  `statistics-claims-register.ts` holds 74 pinned claims and 12 in `UNEVIDENCED_CLAIMS`; both of
  these are recorded there as unpinnable. If your rewrite makes a claim that CAN be cited, move it
  from `UNEVIDENCED_CLAIMS` into `MODEL_CLAIMS` with its evidence. If it removes a claim entirely,
  delete its entry. **The register must not describe a sentence that no longer exists** — that would
  be the register itself carrying a stale claim, which is the one failure it cannot survive.
- Design tokens only. No numeral typed into prose.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list and **refuse to run on an empty discovery** — `$(ls … 2>/dev/null)` with no
matches silently runs the whole suite and reports it as your proof.

187 tests pass at base plus one expected fail (the `it.fails` nav tripwire — leave it alone). Add an
assertion for each rewritten sentence proving the fixture claim cannot return: assert the paragraph
contains **no typed numeral** where that is the intent.
