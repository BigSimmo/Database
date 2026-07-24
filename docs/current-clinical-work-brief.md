# “Current Clinical Work” — product / privacy / persistence brief (#063)

**Status:** Brief only (2026-07-24). **No storage schema, API, or UI implementation** in this pass.

## Outcome sought by the ledger

Decide whether a workspace combining saved comparisons, partial formulation work, recent tools, and pinned source sets is worth building. Success = define users, data classes, lifecycle, cross-device expectations, deletion, failure states, demand evidence, and the smallest testable slice. Stop if demand or safe persistence cannot be established.

## Working definition

**Current Clinical Work** would be an authenticated clinician workspace that resumes in-progress clinical reference tasks — not a patient chart and not an EHR.

Candidate contents (product hypothesis only):

- Saved / recent comparisons (e.g. differentials presentation compare sets)
- Partial formulation drafts
- Recent Tools launcher destinations
- Pinned source sets / favourites-adjacent collections

Adjacent shipping surfaces today: Favourites / Saved workflows (`/favourites`, Tools catalog `favourites` tile), browser-session recents, and mode-local UI state. None of these yet form a unified “current work” document.

## Users

| Actor                   | Need                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| Authenticated clinician | Resume interrupted multi-step reference work across sessions/devices              |
| Guest / anonymous       | **Out of scope** for durable Current Clinical Work (align with Favourites gating) |
| Administrator / ops     | Not a consumer; may need retention/deletion tooling if server persistence exists  |

## Data classes (privacy)

Classify before any persistence design. Prefer the Safety Plan / PIA posture: **no patient identifiers**, identifier-free working content only.

| Class                           | Examples                                                    | Sensitivity                          | Allowed persistence (draft policy)                                                                                 |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| A — Navigation husks            | Tool ids, mode hrefs, last-opened route                     | Low                                  | Server or device OK if owner-scoped                                                                                |
| B — Clinical working selections | Compare slugs, pinned document ids, formulation section ids | Medium (workflow, not PHI by itself) | Owner-scoped server OK with retention                                                                              |
| C — Free-text working notes     | Formulation prose, comparison notes, untitled drafts        | **High incidental PHI risk**         | Prefer tab-local or explicit “save draft” with retention + deletion; never default-sync raw text to logs/providers |
| D — Source pins                 | Document ids / titles already in corpus                     | Medium                               | Owner-scoped; titles may be corpus public                                                                          |

**Hard stop:** do not implement cross-device sync of Class C until privacy/#053 counsel path accepts retention, residency, and deletion semantics. Do not send Class C to OpenAI as a “workspace restore” side channel.

## Lifecycle

1. **Create** — explicit user action (“Save to Current Work”) or narrow auto-save of Class A/B only.
2. **Update** — last-touched timestamp; replace-in-place per item type.
3. **Resume** — open the owning mode route with restored selection ids (URL-serializable where possible).
4. **Complete / archive** — user marks done; item leaves the “current” list.
5. **Delete** — user delete + account deletion cascade; TTL for abandoned drafts (recommend ≤ 30–90 days for Class C if ever stored).

## Cross-device expectations

| Option                     | Pros                                     | Cons                                           | Recommendation                     |
| -------------------------- | ---------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| Tab-local only             | Matches Safety Plan; lowest privacy risk | No multi-device resume                         | Default until demand proven        |
| Device localStorage        | Survives refresh                         | No cross-device; XSS/shared-device risk        | Acceptable for Class A only        |
| Owner-scoped Supabase rows | Real resume                              | Retention, RLS, deletion, PHI incident surface | Only after demand + Class C policy |

**Product default for v0:** tab-local / URL state; no new tables.

## Failure states

- Signed-out user: hide or disable Current Clinical Work; do not leak previous owner items.
- Missing pinned document: show “source unavailable” and keep the shell item deletable.
- Partial formulation schema drift: fail closed to empty section rather than corrupting clinical text.
- Quota / storage failure: keep in-memory work; surface non-blocking “not saved.”

## Demand evidence (gate)

Before any storage/UI project, record at least one of:

- Repeated clinician requests for resume-across-device of a named workflow, or
- Measured drop-off (e.g. formulation / compare sessions abandoned mid-flow) with owner acknowledgment.

Without that evidence, **close the idea** rather than building speculative persistence.

## Smallest testable slice (only if demand clears)

1. **No backend.** Authenticated-only “Resume last comparison” using existing URL/query state + sessionStorage of compare ids (Class B).
2. Entry from Favourites or Tools “Saved workflows” only — no new mode.
3. Proof: focused DOM test that signed-out users see nothing durable; signed-in restore opens the existing differentials/presentation URL; no `/api/*` writes.

**Out of scope for the first slice:** formulation prose sync, pinned source sets schema, mobile offline, sharing, export.

## Stop rule

If product cannot name (a) a single workflow to resume, (b) a data class that is safe without new legal review, and (c) an owner for deletion/retention — **do not build**. Keep Favourites + URL state as the resume story.
