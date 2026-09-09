# Recon: site/ED name coverage gap in `tests/ward-withdrawal-reason-privacy.test.ts`

## 1. The gap, confirmed as stated

Read `tests/ward-withdrawal-reason-privacy.test.ts` in full (211 lines). Every assertion that
checks for a leaked name checks only against `allUnits()`:

- Line 53: `const units = allUnits();`
- Lines 56–66: iterates `for (const unit of units)` and asserts `reason` / `withdrawalReasonLabels[reason]`
  `.not.toContain(unit.name)`.
- Line 182: `const accepting = allUnits().find(...)`; line 188 asserts `entry.reason` `.not.toContain(accepting.name)`.
- Line 195: `const units = allUnits();`; lines 199–201 assert `entry.reason` `.not.toContain(unit.name)` for every unit.

`allUnits` is imported once (line 8, `from "@/components/ward-management/ward-sites"`) and used four
times, exactly as stated. `grep -c "allUnits" tests/ward-withdrawal-reason-privacy.test.ts` → 4.
`grep -in "site\|emergencyDepartment\|\bED\b" tests/ward-withdrawal-reason-privacy.test.ts` → zero
hits outside prose/comments — no assertion touches a site or ED name. **Confirmed exactly as
stated: nothing in this file checks a site name, site code, or ED name.**

`allUnits(): Unit[]` (`src/components/ward-management/ward-sites.ts:640`) is
`wardSites.flatMap((site) => site.units)` — units only, verified by reading the function body, not
inferred from its name.

## 2. The registers a fix must import

All three live in `src/components/ward-management/ward-sites.ts`, so importing all of them adds no
new module and cannot create a circular import (`ward-sites.ts` itself only imports types from
`ward-model.ts`).

| Register                                                                  | Import                                                            | Type                        | Count (from data)                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- | ------------------------------------------------ |
| Units                                                                     | `allUnits()` — already used                                       | `Unit[]`                    | 23 (counted `beds: [0-9]` occurrences)           |
| Sites (name + code)                                                       | `wardSites` — exported `const`, no wrapper function exists        | `Site[]`                    | 17 (counted `code: "..."` lines)                 |
| Emergency departments                                                     | `allEmergencyDepartments()`                                       | `EmergencyDepartment[]`     | 8 (counted `emergencyDepartment: {` occurrences) |
| Unit ids                                                                  | derivable from `allUnits().map(u => u.id)` — no separate register | —                           | same 23                                          |
| Site codes                                                                | `wardSites.map(s => s.code)`, or per-unit `siteCode` field        | —                           | same 17                                          |
| Community teams (discharge destination names, not referral-relevant here) | `COMMUNITY_TEAMS` (`ward-teams.ts`)                               | `Record<HomeRegion,string>` | 10                                               |

All are stable public exports already relied on elsewhere in the app (`ward-board.tsx`,
`morning-page.tsx`, `referral-intake.tsx`, and ~15 test files import `wardSites` directly; nothing
imports an internal). 17 + 23 + 8 = 48, cross-checked against a direct count of every `name: "..."`
literal in `ward-sites.ts` (= 48) — confirms no register was missed and none double-counted.

**Precedent already exists**: `tests/ward-screen-fd23-leaks.dom.test.tsx` (a different, render-level
guard) already derives its forbidden set from both `allUnits()` and `wardSites` (iterating
`for (const site of wardSites)`, asserting `.not.toContain(site.name)`) — but it has the _same_ gap
for EDs, and its own withdrawal-reason assertion (line 214) checks only `allUnits()`, not sites or
EDs. So the blind spot is not unique to the file this brief names; it repeats at the render layer
too, using an identical pattern.

## 3. What a withdrawal reason contains

`WITHDRAWAL_REASONS` (`ward-change-reasons.ts`) is a fixed 2-member union with **no interpolation
anywhere**:

```
export const WITHDRAWAL_REASONS = ["another_unit_accepted", "referrer_withdrew"] as const;
```

```
export const withdrawalReasonLabels: Record<WithdrawalReason, string> = {
  another_unit_accepted: "Withdrawn — another unit accepted this patient.",
  referrer_withdrew: "Withdrawn — the referrer no longer needs this bed.",
};
```

Both labels are literal strings, not template strings — no `${}` anywhere in this file. **A leak
through this exact field is not reachable today by any code path**: the type is a closed union and
neither fixed label names a place.

## 4. Live or latent leak — checked programmatically, not by eye

Extracted every `name: "..."` literal from `ward-sites.ts` (48, matching the count above) and
checked both fixed labels and both fixed codes for containment in either direction: zero matches.
Positive control: the same extraction correctly finds `"Royal Perth Hospital"` in the list, so the
search itself is not silently vacuous.

**The gap is latent, not live.** Today's fixture and today's code cannot produce a withdrawal
reason naming a site, ED, or unit — the type system already forecloses it, independent of this
test. The risk is a _future_ edit: a third `WithdrawalReason` member (the file's own history shows
one was added 2026-09-01, `referrer_withdrew`) or a label change that reintroduces interpolation,
landing green because nothing checks site/ED names.

## 5. Cost of a derived guard

- Imports needed: `allEmergencyDepartments, wardSites` added to the existing `ward-sites` import in
  the test file (alongside `allUnits, NOW_ANCHOR` already imported) — one line, same module, no new
  dependency edge, no circular-import risk.
- Cross-product size: 2 reasons × 2 labels × (23 + 17 + 8 = 48 names) ≈ 100 string-containment
  checks. Trivially fast; no performance concern even if `WITHDRAWAL_REASONS` grows.

## Biggest trap for the implementer

The registers are cheap and safe to import, but the payoff is a **latent** gap, not a live leak —
do not describe a fix as closing an active leak. The real trap is scope creep: `WITHDRAWAL_REASONS`
labels are hardcoded literals, so the derived check will find nothing to fail against _today_ and
must be trusted as a tripwire for tomorrow, the same way the existing unit check already is
(the file's own history shows it going red exactly once, when `referrer_withdrew` was added). Also
worth flagging to whoever picks this up: the identical `allUnits()`-only pattern repeats in
`tests/ward-screen-fd23-leaks.dom.test.tsx` line 214 (render-level, not source-level) — a complete
fix likely wants both files touched, though only the first was in scope for this recon.
