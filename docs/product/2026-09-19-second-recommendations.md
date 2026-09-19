# Seven more recommendations, from reading the code rather than the roadmap

**Date:** 2026-09-19 · **Status:** findings and proposals. Nothing decided, nothing scheduled.

Second pass, after
[`2026-09-19-doctor-compliance-and-feature-brainstorm.md`](2026-09-19-doctor-compliance-and-feature-brainstorm.md).
That document proposed features. This one reports what four parallel investigations found in the
repository, and the recommendations follow from the findings rather than from a wish list.

Two mockup studies come with it:

- [`/mockups/clinical-sign-off-actions`](../../src/components/clinical-sign-off-actions-mockups.tsx) — four boards.
- [`/mockups/coverage-gaps`](../../src/components/coverage-gaps-mockups.tsx) — four boards.

Every claim below was checked against the code, not taken from a summary. Where a number is
quoted it comes from a committed test or a file that was read.

---

## R1 — The sign-off queue can see the work. Nothing can do it.

**Finding, verified.** A clinical sign-off queue already ships:
`src/lib/developer-area/sign-off-queue.ts` loads seven families and
`src/components/developer-area/hub/sign-off-queue-page-content.tsx` renders them at
`/mockups/development/clinical-sign-off`, behind the administrator gate. Counts are pinned by
`tests/sign-off-queue.test.ts`:

| Family        | Waiting   |
| ------------- | --------- |
| Specifiers    | 603       |
| Dictionary    | 429       |
| Differentials | 232       |
| Therapy       | 205       |
| Sources       | 75        |
| WA MHA forms  | 54        |
| Formulation   | 12        |
| **Total**     | **1,610** |

Both source files state, in their own words, that nothing on them signs: _"It is read-only.
Nothing here publishes, approves or unhides a record"_ and _"It reads, and never signs."_

**Why this is the top recommendation.** Building the inventory first was correct — a read-only
count is a safe thing to ship. But the consequence is that the largest block of P1 work in the
whole outstanding-issues ledger is now visible, counted, and still has no mechanism anywhere in
the app. The bottleneck has moved from _not knowing_ to _not being able to_.

**Proposal:** study 4. Four boards on the action rather than the list — an attestation that is
three fields rather than a button; a batch rule for the families where one-at-a-time is a week
of evenings; seven vocabularies kept intact under one shared action; and the consequence of
signing shown before you sign.

**Start where the mechanism is provable, not where the backlog is biggest.** Forms and
formulation are 66 records between them, and forms already encodes the completeness rule
(`src/lib/form-catalog.ts` treats a record as reviewed only when `status`, `reviewedBy` and
`reviewedAt` are all present, and falls back to `drafted` otherwise). Prove it there. Specifiers
and dictionary are 1,032 of the 1,610 and need the batch rule settled first.

---

## R2 — Seven review vocabularies. Keep them, add one action.

**Finding, verified.** Each family stores review state its own way:

| Family        | Field                                  | Pending value              |
| ------------- | -------------------------------------- | -------------------------- |
| WA MHA forms  | `status` + `reviewedBy` + `reviewedAt` | `drafted`                  |
| Formulation   | `reviewStatus`                         | `clinical_review_required` |
| Differentials | derived, not stored                    | `unverified`               |
| Dictionary    | `clinicalApproval.status`              | `pending`                  |
| Specifiers    | `review.clinicianReviewStatus`         | `clinician-review-pending` |
| Therapy       | `reviewStatus`                         | `needs_review`             |
| Sources       | `disposition` + `validationStatus`     | `unverified`               |

The queue module deliberately keeps each family's `nativeStatus` verbatim rather than mapping
them onto a shared enum.

**Recommendation: leave that alone.** `needs_review` on a therapy record and `drafted` on a form
guidance record are not the same claim, and flattening them would assert an equivalence nobody
checked. What is missing is not a shared _state_; it is a shared _action_ — one attestation
shape (who, when, what they confirmed) writing into each family's own field.

---

## R3 — Eleven implementations of "how old is this", and they disagree

**Finding, verified.** Eleven user-facing surfaces independently answer "when was this last
checked", eight of which do their own date arithmetic. They do not agree:

- **Thresholds:** 12 months (On Call) · 365 days, strict `>` (registry records) · 365 days,
  inclusive `<=` (medications) · a stored `review_due_at` (differentials) · none (stamps).
- **`FUTURE_DATE_TOLERANCE_DAYS = 1` is declared three separate times** — in
  `src/lib/differential-records.ts:117`, `src/lib/medication-records.ts:33` and
  `src/lib/registry-records.ts:119` — each with a comment saying it deliberately mirrors rather
  than shares the others.
- **Wording splits five ways:** "Checked / Never checked / needs checking" · "confirmed N months
  ago" · "Review due" · "Verified on / Not verified since" · "content as of … N days old".
- **Two of them describe the same field with different words and different month arithmetic.**
  On Call's badge and the developer hub's On Call panel both read `lastVerifiedAt`; one counts
  calendar months with a leap-day clamp, the other divides by 30.44-day months.

**Recommendation.** One module: a single freshness function, one tolerance constant, one set of
words. Per-surface thresholds stay configurable — a phone number and a guideline genuinely age
differently — but the arithmetic, the boundary rule and the vocabulary should not. This is a
small refactor with an unusually good ratio: it removes a whole class of "why does this say
something different over here" and it is exactly the primitive the compliance tracker in study 3
would otherwise become the twelfth copy of.

---

## R4 — A specified safety control was never built

**Finding, verified.** `docs/on-call/design/on-call-hub-build-prompt.md` §2.8 says the On Call
editor _"must refuse to save a credential in any field, at any privacy level: reject Wi-Fi
passwords, door keycodes, PINs and remote-access secrets with a clear inline error. Write the
validator and its test first."_ §5 repeats "test first".

It does not exist. There is no credential module in `src/lib/on-call/`, no refine on
`api-schemas.ts`, and no test in `tests/`. The editor surfaces generic Zod field errors only.

The one credential validator in the repo, `assertNoIngestionCredentialShape` in
`src/lib/ingestion-audit.ts`, is server-side, ingestion-only, and unreachable from any UI.

**Why this matters more than its size.** The On Call hub is world-readable by design; only
`is_personal` rows are withheld. A door keycode typed into a non-personal logistics entry is
published. The control that was supposed to prevent that was specified, marked as the first
thing to build, and silently did not ship — and nothing failed, because nothing tested for it.

**Recommendation.** Build it, test-first as the prompt says. Then ask the more uncomfortable
question: what else in that prompt was marked mandatory and quietly skipped? The conformance
ledger tracks the _drawing_; nothing tracks the _prose_.

---

## R5 — Consolidate the clipboard before guarding it

**Finding, verified.** Copy-to-clipboard is implemented four ways across roughly 23 call sites:
one shared helper (`src/lib/copy-to-clipboard.ts`), three independent re-implementations of the
same primitive, and nine places calling `navigator.clipboard.writeText` directly, bypassing
every helper.

No identifier-shaped validation exists anywhere in `src/lib/**` — no record-number, no
date-of-birth, no name patterns. `query-privacy.ts` is redaction at persistence, not input
validation.

**Recommendation, and the sequencing is the whole point.** The earlier brainstorm listed a
"refuse to copy something that looks like a patient identifier" guard as cheap. It is not cheap
today: it would need thirteen edits and would be defeated by the fourteenth call site somebody
adds next month. Route everything through the one helper first — a mechanical, individually
reviewable change — and the guard afterwards is a handful of lines in one place. Doing it in the
other order produces a guard with holes and the false confidence that goes with it.

---

## R6 — "What changed since you read it" needs two small tables, not a rewrite

**Finding, verified.** The hard part is already solved and the easy parts are missing.

**Already solved:** chunks carry stable, position-independent identities.
`chunkContentKey(documentId, sectionAnchor, content)` in `src/lib/chunking.ts` is explicitly
built so that "re-indexing the same source yields the same key", surviving re-pagination and
reordering, and `document_chunks` also carries `anchor_id` and `content_hash`. A per-section
diff is anchorable without touching the chunker.

**Missing, both ends of the comparison:**

1. **No prior state is retained.** `commit_document_index_generation` deletes every row whose
   `index_generation_id` differs from the committed one, so after a reindex there is nothing
   left to compare against. A change feed needs a small retained table of
   `(document, generation, anchor_id, content_hash, heading)`.
2. **No server-side read record for documents.** `user_favourites.last_opened_at` is constrained
   to `service | form | differential | therapy` — documents cannot be favourited. `audit_logs`
   has no view action. `rag_retrieval_logs` records what retrieval _selected_, not what a person
   _read_, and is purged at 90 days.

Also: no diff library is installed and no text-diff utility exists in the repo.

**Recommendation.** Still the best idea on either list — the dangerous document is not the one
you never read, it is the one you read two years ago — but it is now a scoped piece of work
rather than a vague one: two tables, a retention decision, and a rendering. Worth writing up
properly before it is scheduled.

---

## R7 — Coverage gaps are reportable today, with one honest hole

**Finding, verified.** `rag_query_misses` holds a miss reason, near-miss files, candidate labels
and `candidate_aliases` — canonical clinical terms from the curated vocabulary in
`src/lib/clinical-vocabulary.ts`. `rag_retrieval_logs` holds `is_miss` and `miss_reason`. Both
are retained 90 days and purged by pg_cron.

The question text is not available, by design and correctly: `queryTextForStorage` writes
`redacted-query:<hmac>` unless `RAG_PERSIST_RAW_QUERY_TEXT` is set, that flag defaults to
`false`, production readiness blocks it, and legacy plaintext was irreversibly salted and
scrubbed by migration.

So a gap report can show a **topic with a repeat count** — which happens to be exactly the shape
the WA-first source ladder takes as input, and exactly the shape of the `capturedFor`
justification the source protocol already requires on every capture _and every rejection_.

**The hole, and it is worth naming loudly.** There are two ways the app fails to answer, and
they log differently. A _search_ miss writes `candidate_aliases`, so it has a topic. An _answer_
abstain writes only `is_miss` plus a fallback reason code into `rag_retrieval_logs` and never
touches `rag_query_misses` — so the sharpest signal in the system, the app stating it could not
support a claim from the library (`coverage_gap`), arrives with **no topic at all**.

**Recommendation.** Make the answer path record the aliases the search path already records —
small, and it belongs _before_ the surface, not after. Then build study 5.

---

## What two review agents changed, after the boards were drawn

Recorded because the changes are the useful part, not a postscript. A design-system review and a
clinical-governance review were run over all five studies from this session.

**The governance review rejected two proposals outright, and it was right both times.**

1. **The batch sign-off rule, as first drawn, wrote a false attestation.** The original board B
   let a clean sample _grant_ approval to a whole slice. Combined with board A's attestation
   (a named person, a date, three confirmations) that meant 184 records would carry
   `reviewer: Dr X` when four were read, with nothing on the record distinguishing an examined
   record from an inferred one. Three further objections stuck: the sampling maths was never
   stated (4 of 184 is 2.2%, and a reject-on-any-failure rule passes a 5%-wrong slice about four
   times in five); the homogeneity premise is false for generated text, whose errors concentrate
   in the rare tail a uniform draw is least likely to reach; and it contradicted a rule written
   in the module it is about — `sign-off-queue.ts` already says promotion into the published
   dictionary is "a clinical decision, not a data migration".

   **The rule is now inverted.** A sample can only ever _disqualify_ a slice; a clean sample
   means the slice has not been ruled out, never that it is approved. There is no "sign off
   slice" control on the board any more, and batch review can never set `publicationAllowed` —
   the flag that makes content quotable evidence in a generated answer. The honest finding is
   that triage is batchable and approval is not.

2. **The supervisor roll-up should not be built as drawn.** It creates a third-party data
   subject with no consent path and no access audit; it repurposes a private memory aid into a
   supervision record that is discoverable and usable in a dispute; initials over a
   three-person cohort identify people absolutely; and "nothing recorded" hands a supervisor a
   claim about a trainee's standing that the app says elsewhere it cannot make. The board is
   kept as the rejected option, with the reasons on it.

**Four more findings changed the drawings:**

- **The exports broke the study's own central rule.** The wallet card printed "Registration —
  current to 30 Sep 2026" and the cover sheet "current at 19 Sep 2026". _Current to_ is a
  verdict, three of those four dates were never checked with the issuing body, and neither
  artefact carried provenance — on precisely the two things that leave the app and reach a
  credentialing body. Both now read "as recorded by the holder", and provenance travels with
  them.
- **The compliance study never actually said the thing the write-up said it said.** The
  drawing had no mention of the ingestion worker at all. That matters, because the existing
  upload path would put a registration certificate in the clinical-documents bucket, OCR it,
  and send its text and images to an overseas provider — so "never appears in search" would be
  false by default rather than true by default. The boards now state the separate store and the
  test as preconditions.
- **The CPD board asserted a regulatory shortfall against numbers the user typed.** "You are
  five hours short" is a compliance judgement; the dangerous case is not the amber one but the
  calm one, where somebody typed the wrong minimum and reads a green page as "on track". Now
  phrased against "the minimums you entered", and imported teaching hours stay uncounted until
  attested, because CPD is a personal attestation to a regulator rather than a tally the app
  may keep on someone's behalf.
- **Two claims in the coverage study were overstated.** The hash is keyed only when the secret
  is set — enforced in production, not in a staging deployment missing it — so the panel now
  prints the deployment's actual state. And the answer-path alias fix is _not_ small:
  `candidate_aliases` feeds label promotion and query expansion, which makes it a
  RAG-ranking-surface change needing a canary pair, and it needs the context-token guard the
  answer path already has, or a query like "62F, eGFR 38, on lithium" would put a clinical
  fingerprint of one episode into 90-day telemetry. Board D also marked a gap "resolved" on
  retrieval success alone; it now waits on a person reading the answer against its source, and
  the eval button names the captured tier rather than the protected golden fixture.

**The design-system review found three real defects**, all fixed: four primary controls drawn
at 32px including the dial-out button on the "who covers this?" board; a foreground-role token
(`--warning-text`) used as a solid background fill, where it has no paired contrast token and no
forced-colours remap; and a `truncate` on the one row where the text being clipped is the
_instruction that replaces an unverified name_ rather than the name itself.

It also noted that `globals.css` has `--danger-solid` / `--danger-solid-contrast` but no
`--warning-solid` pair — worth knowing before someone else reaches for the same wrong token.

---

## What I would do, in order

1. **The clipboard consolidation** (R5). Mechanical, reviewable, and it unblocks a real safety
   control.
2. **The On Call credential validator** (R4). Specified, skipped, and the hub is world-readable.
3. **The freshness primitive** (R3). Small, and everything else stops multiplying copies of it.
4. **Sign-off for forms and formulation** (R1, R2) — 66 records, cleanest fields, proves the
   mechanism.
5. **The answer-path alias fix, then the coverage report** (R7).
6. **Write up "what changed since you read it" properly** (R6), then schedule it.

Items 1–3 are all small and all reduce future work. Nothing in that list needs a live database
window, and only item 4 touches clinical content.
