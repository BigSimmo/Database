# What the 2026-09-17 external audit got wrong

**Status:** record only. Nothing here is a work item. It exists so a seventh audit does not
re-report findings this repository has already answered, and so the hours spent re-deriving each
refutation are not spent again.
**Subject:** an external audit of `psychiatry.tools`, supplied as `PSYCHSIFT-AUDIT-REPORT-2026-09-17.md`.
**Checked against:** `origin/main` 6f0a3d444 on 2026-09-17 (session `01B5auxdz8JsfzSnDezMWz1n`, three
parallel code-review agents, PR #2860). Six of the eight refutations below were independently
re-read against `origin/main` 28dabe0c3 on 2026-09-18 while writing this record; those are marked.
The two unmarked ones (findings 1 and 7) rest on that earlier session's evidence.

## The single biggest reason it was wrong

**The audit read commit `a5c3c42b6`, thirty-two commits behind the `main` it was checked against (`git rev-list --count a5c3c42b6..6f0a3d444` = 32; the ledger row that prompted this record said thirty-one, and that figure was never re-measured).** Of the eight findings
refuted below, **three had already been fixed by work committed here before the audit was written**
(its L1/L2 hang, its C3 tenancy report, and the numeric-truncation half of C4), **four describe code
that was never broken** (the webhook compare, the auth-callback redirect, the claim-support cap and
the prompt chip), and one is a notice working as designed.

That is not a criticism of the auditor so much as a process note: an audit of this repository must
state the commit it read, and the commit must be current, or a good part of its output is
archaeology.

## Refuted, with the evidence

### 1. Answer and Documents hang (its L1, L2, and its number-one recommendation)

Already root-caused and fixed by PR #2849 and PR #2855 on 2026-09-16/17, before the audit was
delivered. `read_site_content_public_records` re-hashed the whole 9.5 MB frozen corpus on every
public read — measured on the live database at mean 8,656 ms, max 17,263 ms. Full account:
[`2026-09-16-catalogue-read-latency.md`](2026-09-16-catalogue-read-latency.md).

### 2. Search-scope tenancy hole (its C3, and hypothesis H1) — re-verified 2026-09-18

Reported as a live hole. The database forbids it. The constraint
`documents_ownerless_requires_publication_marker`
(`supabase/migrations/20260902110500_ownerless_documents_require_publication_marker.sql`, added and
validated 2026-09-02) requires every ownerless row to carry `public_corpus` or sit in
`status='failed'` quarantine, and `resolveSearchScope` already filters `status='indexed'`. The two
predicates differ in wording and agree in force.

`#ZBAC9D` is the identifier of the change that **closed** this. It is not an open finding, and it
should not be cited as one.

### 3. Safety-chip numeric truncation (part of its C4) — re-verified 2026-09-18

Refuted, and it should not be re-checked. `truncateAtSafeBoundary`
(`src/lib/clinical-safety.ts:77-88`) drops a whole numeric token rather than cutting inside one. It
was fixed twice since audit L111 and is pinned by two committed tests.

The _other_ half of C4 is real and is tracked separately — see "Real, and being acted on" below.

### 4. Railway webhook secret not timing-safe (part of its C11) — re-verified 2026-09-18

It is timing-safe. `src/lib/webhooks/secret-auth.ts` gates on byte length (line 14) _before_
calling `timingSafeEqual` (line 15), which is the comparison a crafted multi-byte token would
otherwise exploit. A header is consulted (line 28) before the query token (line 37).

### 5. Auth callback open redirect via backslash (its H2, part of C12) — re-verified 2026-09-18

Not exploitable. `src/app/auth/callback/route.ts` builds the origin from the forwarded host and
concatenates it ahead of the path, so the host is fixed before any parser sees the path; only
same-origin relative redirects are honoured. The 2026-09-17 session measured `/\evil.com`,
`/\/evil.com`, `/..//evil.com` and a CRLF payload, all resolving to our own origin. Identity-provider
errors go to a query parameter rendered as a React text node, never as HTML.

### 6. Claim support can still report `high` (part of its C7) — re-verified 2026-09-18

It cannot. Every exit from `assessAndEnforceClaimSupport` caps it
(`src/lib/rag/rag-claim-support.ts`, the two return sites near lines 1325 and 1430): where any claim
is not `direct`, a `high` confidence is rewritten to `medium`.

### 7. Retained-copy notice (its L5)

That is the notice working as designed. The real gap is the surfaces that fall back **without**
showing it, which are already open as `#V98SPY`, `#8GB18R` and `#3PW9TY`.

### 8. Differentials prompt chip (its L8) — re-verified 2026-09-18

Every quick-action chip in every mode fills the search box and waits for submit
(`src/components/clinical-dashboard/master-search-header.tsx:746-920`). None of them submits on
click: across that whole range there is not one call to `requestSubmit` or `handleSubmit(`.

## Real, but already decided — do not reverse

- **C8** (VerificationNotice hidden on source-only answers): ledger `#227` over `#207`, owner
  decision 2026-08-03.
- **C10** (empty list reads audited as allowed): deliberate, and test-pinned.
- **C11 residual**: a Railway platform constraint, not a code choice.
- **T1**: open as P1 `#2M4PX1` (tablet prompt chips clipped at the right edge).

## Real, and being acted on

- **C4, the labelling half.** `extractSafetyFindings` labels a passage using the first entry in a
  severity-ordered array whose regular expression matches, over tokens broad enough to appear in
  ordinary clinical prose. The more dangerous direction is the false negative: a passage whose
  entire content is a stop instruction ("cease this drug") produced no finding at all. Tracked as
  `#GHC4XZ`; the vocabulary change and the separate question of whether a keyword match should hold
  the headline position are recorded as an open assurance decision
  (`SAFETY-CHIP-VOCABULARY` in `docs/clinical-hazard-controls.json`).

## Still open, and worth a person

Both were blocked by network policy from the session that did this work, and remain unanswered:

1. Whether the live site is actually fast again after PR #2849 and PR #2855.
2. Whether `CARING_CONTACTS_DEMO_ENABLED` is set in production.

## For the next audit

State the commit you read, and read a current one. Three of the findings above were already fixed
here at the time of writing, and two of those had a dated record in this same directory explaining
how. Four more describe code that had never behaved the way the finding claimed.
