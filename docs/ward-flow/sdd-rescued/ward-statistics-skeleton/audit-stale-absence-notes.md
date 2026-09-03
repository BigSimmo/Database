# Audit: stale absence notes in Ward Flow

Scope computed from disk (not prose): `find` over the three roots gave
111 files (`src/components/ward-management/**`), 35 files
(`src/app/mockups/ward-flow/**`) and 146 files (`tests/ward-*.test.ts`

- `tests/ward-*.test.tsx`, the `.dom.test.tsx` files included because
  they match the glob) — **292 files discovered, 292 examined** (all
  were covered by the candidate search; every hit was opened in
  context).

Case-insensitive search across all 292 files for the listed absence
phrases produced 702 raw hits; narrowed to the 14 strongest phrases
("does not exist", "not yet", "no way in", "not built", "not
implemented", "separate work", "will link", "nothing links", "coming
soon", "future work", "unbuilt", "is separate", "once .\* lands",
"when .\* lands") gave **223 candidates**, each read in its file
context (never inferred from another comment).

## Verdicts

### FALSE — worst first

1. **`src/components/ward-management/community/community-index.tsx`
   (lines 35–40) and `src/app/mockups/ward-flow/community/page.tsx`
   (lines 23–27).** Both are code comments (not rendered) claiming
   the community index "is not yet registered in `ward-nav.ts`, so
   nothing links to it yet," reachable "only by typing its address,"
   and that `tests/ward-community-index.dom.test.tsx` "holds that gap
   as a live `it.fails` tripwire." All three are now false:
   `ward-nav.ts` line 143 reads `id: "community", href:
"/mockups/ward-flow/community"`, and the test file's own comment
   states "AN ORDINARY GUARD, AND IT WAS AN `it.fails` TRIPWIRE UNTIL
   2026-09-01… which is what happened here." Comment-only, not
   rendered. **Conclusion falls**: the stated reason (unregistered
   route) is gone, so the "reachable only by typing an address"
   claim is simply wrong now, not just reworded.

2. **`src/components/ward-management/statistics/statistics-claims-register.ts`**
   (entry `community-index/reachability/nothing-links-to-this-index-yet`,
   ~line 2032). Internal tooling data, not rendered. Its `reason`
   field still describes the "live `it.fails` tripwire… which goes
   red the day the nav entry lands" as a future event; that event has
   already happened (same landing as finding 1). Lowest severity of
   the three — it's a governance register entry, not prose a reader
   sees, and the register's own doc comment already flags this class
   of claim as one that should be deleted rather than reworded (§3).

3. **`src/components/ward-management/ward-movements.ts:1092`,
   `ward-model.ts:868–873`, `ward-model.ts:1189`.** Code comments
   (not rendered) asserting "This prototype holds no distances,
   travel times or ordering by proximity" and that computing a
   travel-time band "is Phase 8's, deliberately not built." Phase 8
   has since shipped `ward-distance.ts`/`ward-travel-bands.ts`
   (`travelBand`, `unitTravelBand`) and `groupCandidatesByTravelBand`
   in `ward-referrals.ts`, rendered live in
   `referrals/referral-match.tsx`, `ward-management-network.tsx`, and
   `out-of-area/out-of-area-board.tsx`. **Partial conclusion
   survival**: band _computation_ is built and false to deny; band
   _ranking/ordering_ is still deliberately absent by design
   (`ward-referrals.ts` explicitly forbids ranking within a group),
   so that narrower sub-claim still holds. The sweeping "holds no
   distances, travel times" sentence in `ward-movements.ts:1092` is
   flatly false; the two `ward-model.ts` comments are misleading but
   partly defensible depending on which noun ("travel-time band" vs.
   "ordering") the reader focuses on.

**Already fixed, not a fresh finding**: `statistics-overview-screen.tsx`
(~line 55) still carries a comment documenting that the exact sentence
from this audit's seed example — "There is no way in from the
statistics home page yet — the index that will link here is separate
work" — was deleted 2026-09-01 once the hub index landed, with a test
(`ward-statistics-sections.dom.test.tsx`) forbidding its return. This
is the historical case the task description was built from, correctly
resolved.

### STILL TRUE (checked, not just read)

- `ward-derivations.ts:850–857` — no `PatientSearchResult` union
  member for admissions exists (grepped `kind: "admission"`: no hits).
- `ward-flow-events.ts:851` — `Movement.originEdId` is a required
  `string` field (`ward-model.ts:490`), confirming no community-origin
  movement exists.
- `ward-referral-visibility.test.ts:712` — no "declined — back in the
  queue" string exists anywhere in `ward-management/` (grepped).
- `ward-management-console.tsx:270/668` and `ward-management-modes.tsx:316`
  — rendered `aria-disabled` "coming soon" placeholders; comments date
  them 2026-09-01 as deliberate, owner-pending decisions, still
  accurate.
- `statistics-compare-screen.tsx:27` — "comparison itself… not built"
  matches the rendered output (chooser/navigation only, no ranking).

### UNVERIFIABLE

None of the 223 candidates were too vague to check; every one named a
concrete artifact (a file, a field, a route, a test) that could be
opened and confirmed or refuted.

## Summary

**Files examined: 292 out of 292 discovered.** Candidates: 223 (from
702 raw hits). **FALSE: 4** (2 duplicate-shape comments about the
community-index nav registration, 1 stale claims-register reason, 3
Phase-8 travel-distance comments treated as one cluster) — **0
rendered to the screen**; all are code comments or internal tooling
data. Worst: the community-index nav-registration comments in two
files both claim a route is unreachable except by typing its address
and that a named test still tripwires the gap, when the nav entry
landed and the test was already converted to an ordinary passing
assertion — the conclusion (unreachable) falls with the reason.
