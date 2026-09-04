# Ward Flow — synthetic bed-flow prototype (DRAFT, not for merge)

**This is a draft for visibility and off-machine safety. It is not proposed for merging, and it
cannot merge as it stands — the branch is ~299 commits ahead of `main` and conflicts with it.**

## Summary

Ward Flow is an **offline synthetic prototype** of a statewide psychiatric bed-flow coordination
hub, built as design scratch. It is not clinical decision support, it is not validated, and it
reaches no real data.

- **All routes live under `src/app/mockups/ward-flow/**`**, which 404s in production.
- **All components live under `src/components/ward-management/**`.**
- **Nothing** touches the search app, RAG/retrieval, Supabase, auth, ingestion, or any clinical
  answer path. Verified file-by-file, not sampled.
- Outside its own directories it touches 11 files, almost all additive: two lines of Playwright
  configuration, a few lines teaching `ci-change-scope` that ward paths are ward paths, and a
  hardened `check:dead-code-candidate` (Ward Flow exposed a real hole in it — four zero-importer
  symbols that were all alive).

## ⚠️ Synthetic data — read this before reviewing

The fixtures contain **eight name-shaped patient records** with dates of birth, UMRNs, legal status
and Mental Health Act form codes. **Every one is invented.**

The naming is a deliberate design decision, documented in `ward-patients-seed.ts` itself: the
surnames were invented so that **no real person can match**, while still giving related-name search
genuine near-misses to demonstrate — `Halloway` beside `Hallowin`, `Marrowby` beside `Marrowbee`.
Dates of birth are fixed rather than computed so screenshots stay consistent. Every screen that
renders them carries a visible synthetic-data marker.

**No Mental Health Act figure, timeframe or threshold is invented anywhere in this prototype.** Form
codes appear as names only (`No form`, `1A`, `3B`, `3D`, `4A`, `4C`) with no durations attached.

## What landed most recently

- **Urgency is spelled out wherever a human chooses or reads it.** Three pickers rendered a bare
  `1 2 3` while every display surface said "Tier 1 · most urgent"; the ED referral form defaults to
  `3`, which is _least_ urgent. A clinician reading a bigger number as more urgent would have filed
  the sickest patient last. The default is deliberately unchanged — opening on the least urgent tier
  is the software declining to escalate on a clinician's behalf.
- **The governance median is suppressed below five recorded cases**, with the existing disclosure
  rule left standing beneath it. It will read "Not enough data to compute" until enough referral
  arrival instants exist — that is the change working, not a regression.
- **Ward blindness (`FD-23`)**: no ward-facing surface reveals where else a patient has been
  referred. A guard now enforces it and found two further leaks on introduction.

## Known state

- **Incomplete by design.** The community hub is specified and unbuilt; the ward screen rebuild is
  pending; roughly a dozen values (catchment suburbs, transport providers, community teams, the
  urgent-mark reasons) are placeholders awaiting the owner's real-world data.
- **CI will likely be red**, from 299 commits of divergence rather than from defects. Local state at
  the time of opening: 1550 unit tests passing, typecheck clean, eslint clean.
- **Documents**: 137 ward documents are consolidated onto this line, including the safety checklist,
  the task ledger, and nine design specifications.

## Verification

Local only — no provider-backed gate was run and none is claimed.

```
1550 passed · 0 failed · typecheck 0 errors · eslint 0 errors
```
