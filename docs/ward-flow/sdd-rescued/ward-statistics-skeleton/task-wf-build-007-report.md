# WF-BUILD-007 — widen the withdrawal-reason privacy guard to sites/EDs

## Status

Done. Latent gap only — no live leak found or created. `WITHDRAWAL_REASONS` remains a
closed two-member union with zero string interpolation, so no real code path can produce a
reason naming a site, site code, or ED today. This closes the tripwire for a future edit
(templated or free-text reason) that reintroduces one.

## Commit

`64b4c1388` — `tests/ward-withdrawal-reason-privacy.test.ts` only. No production code touched.
`tests/ward-screen-fd23-leaks.dom.test.tsx` left untouched, as instructed — same `allUnits()`-only
blind spot exists there (line ~214), ownership unresolved with another chat.

## Gate

- `npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.
- `npx vitest run` on the discovered list (14 `ward-referral*` + 1 `ward-withdrawal*`, 15 files):
  `Test Files 15 passed (15)` / `Tests 310 passed (310)`.
- Target file alone, verbose: `Test Files 1 passed (1)` / `Tests 13 passed (13)` — RAN 13, PASSED 13.

## Coverage now

Forbidden-name set is derived, never hand-listed: 23 units + 17 site names + 17 site codes +
8 ED names = **65 terms**, checked against both `WITHDRAWAL_REASONS` codes and their labels.
Every count is pinned exactly (`toBe`, not a floor); the two- and three-level loops use
`expect.soft()` inside with the array length asserted immediately before, per
`docs/ward-flow/traps/an-aborting-loop-hides-its-own-arity.md`.

## The four mandatory proofs (verbatim outputs — all passed)

1. `fires on a synthetic reason naming a real site name` — synthetic
   `"Withdrawn — a bed was confirmed at Royal Perth Hospital."` → `namesRealPlace(...) === true`. PASS.
2. `fires on a synthetic reason naming a real site code` — synthetic
   `"Withdrawn — bed confirmed at site RPH."` → `namesRealPlace(...) === true`. PASS.
3. `fires on a synthetic reason naming a real emergency department` — synthetic
   `"Withdrawn — the patient was redirected to Royal Perth Hospital Emergency Department."` →
   `namesRealPlace(...) === true`. PASS.
4. `stays silent on the real WITHDRAWAL_REASONS labels — the control` — both real labels checked
   against all 65 names, `namesRealPlace(...) === false` for every combination (130 soft checks). PASS.

## Short names

Word-boundary regex (`\b…\b`), case-sensitive, not `.includes()`. Several site codes (`ARM`,
`BUN`, `GER`) are ordinary English fragments, so a bare substring search would flag "warmly",
"bunch", "danger". The detector throws if handed a forbidden name under 3 characters, rather
than silently matching it — today's shortest real entry is a 3-letter code, so a shorter one
later fails loudly instead of joining the sweep unexamined.
