# Corpus health panel — handover

**Status: both changes are merged to `main`. Nothing is in flight.** What remains is confirmation
against the real library, which a cloud container cannot do.

| Change                                                                       | PR                                                      | State                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------- |
| Corpus health panel (`/mockups/development/corpus-health`)                   | [#2504](https://github.com/BigSimmo/Database/pull/2504) | Merged as `c944fcdad` |
| Environment strip document count reads with a credential that has privileges | [#2512](https://github.com/BigSimmo/Database/pull/2512) | Merged                |

## What was built

A developer-hub panel answering one question the hub could not answer: **which of my documents are
broken?** The ingestion panel shows documents _moving_ through the queue; this one shows the library
at rest, which is where a document that finished and produced nothing usable hides — it is not
queued, it is not an error, and its row says `indexed`.

It reports counts by status; documents that are `indexed` with zero chunks; failures with the reason
the worker recorded; the extraction-quality distribution; and the lowest-scoring documents with
their recorded issues.

- Data: `src/lib/developer-area/corpus-health.ts` (`resolveCorpusHealth`, `resolveQualitySpread`)
- Page: `src/app/mockups/development/corpus-health/page.tsx`
- Tests: `tests/developer-corpus-health.test.ts`, `tests/developer-corpus-health-page.dom.test.tsx`
- Registry entry: `src/lib/developer-area/hub-panels.ts` (`corpus-health`, group `system`, phase 1)

## The finding that shaped both changes

The panel was first written against the cookie-bound user client, on the reasoning that the
owner-read policies would scope it in the database. **That client cannot read these tables at all.**

- `supabase/schema.sql:5299` revokes all `public` table privileges from `anon` and `authenticated`,
  and the grant block below it names `documents` and `document_index_quality` for `service_role` only.
- `supabase/migrations/20260725000000_audit_security_remediation.sql:81` re-applies that revoke after
  every earlier `grant select … to authenticated`. No migration after `20260725000000` restores it —
  the only later `to authenticated` hits are RLS policies in `20260823090000_user_favourite_sets.sql`.
- The schema says so in its own comment: browser clients receive no direct table privileges, signed-in
  access is mediated by the server routes, and the owner policies remain only as defence in depth.

Row-level security cannot restore a missing SQL `SELECT` privilege, so every such read returned
permission denied — silently, because both modules degrade a failed read to `null` by design. Raised
as a P1 by Codex on #2504 and confirmed against the schema and the migration chain before being acted on.

`environment-facts.ts` had carried the same defect since it merged, which is why the hub's document
count could only ever render "document count unavailable".

**The variant check is done and closed.** Every `createSupabaseServerClient` caller in `src/` was
audited on `main` at `45a3dcacb`:

| Module                                        | Verdict                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/lib/developer-area/access.ts`            | Auth only, no table read — correct                                                             |
| `src/app/auth/callback/route.ts`              | Auth only, no table read — correct                                                             |
| `src/lib/sources/document-source-loader.ts`   | Already correct: user client for `viewerId`, admin client + `withOwnerReadScope` for the query |
| `src/lib/developer-area/corpus-health.ts`     | Fixed in #2504                                                                                 |
| `src/lib/developer-area/environment-facts.ts` | Fixed in #2512                                                                                 |

No third instance exists. Do not re-open this as a hunt.

## Rules a future session must not undo

1. **Never restore the cookie-bound user client for these table reads.** It reads nothing and fails
   by looking healthy. Both modules carry a comment saying so.
2. **The explicit `.eq("owner_id", …)` on every query is the whole owner-scoping guarantee**, not a
   second layer over row-level security — the service-role client is not subject to those policies.
   `tests/developer-corpus-health.test.ts` asserts it on all eleven issued queries and that no query
   runs without the administrator claim; `tests/developer-hub-environment-facts.test.ts` asserts it
   on the one query it issues.
3. **Every failure returns `null`, never `0`.** On this panel `0` is the reassuring answer, so a read
   that did not happen must not impersonate it. An unread count renders as the words "Not read".
4. **Each read is guarded separately.** The Supabase client _rejects_ rather than resolving with an
   `{ error }` on an aborted request or exhausted retries; an unhandled rejection would fail the whole
   page instead of degrading one line.
5. **Counts are computed in Postgres (`head: true`), not by counting fetched rows** — PostgREST caps
   returned rows, and a truncated fetch would under-report breakage.
6. **The page's honesty wording is page content, not decoration**, and each caveat sits above the
   evidence it qualifies. DOM tests pin the wording; deleting a caveat turns a test red.

## What is NOT verified

**No part of either change has been seen against the real library or on screen.** Both were built in
a cloud container with no live database and no browser. Every test uses stand-in data. That is the
whole of the outstanding work.

### The uniform quality-score question

The original task carried an unverified report that every document in the library may hold an
identical placeholder `quality_score`, which would make the quality half of the panel meaningless.
**It could not be checked here, and the repository holds no committed record of the live score
distribution.** So the panel was built to report that condition rather than hide it:
`resolveQualitySpread` reads both ends of the score range and distinguishes five cases — `unreadable`,
`none`, `single`, `uniform`, `varied`. On `uniform` the page says so in bold, states that the quality
figures are not usable as a measure of any document, and adds that a uniform `0` is also what a corpus
nobody ever scored looks like (`quality_score` defaults to `0`, `extraction_quality` to `unknown`).

If the live data turns out to be uniform, that is a finding to raise about the scoring pipeline, not
a panel to quietly ship.

## How to confirm — the next session's first task

Requires a machine with live Supabase configuration and a signed-in administrator account.

1. `npm run ensure` and open the URL it prints. Never assume a port.
2. Open `/mockups/development` and confirm the environment strip shows a real document count instead
   of "document count unavailable".
3. Open `/mockups/development/corpus-health` and confirm the four status tiles show numbers rather
   than "Not read".
4. Read the extraction-quality section and record which of the five spread cases it reports. If it
   says every scored document carries an identical score, that confirms the rumour — capture it as a
   ledger issue against the scoring pipeline.
5. Sanity-check one entry in "Finished but unsearchable" against the real document: an indexed
   document with zero chunks should genuinely have no retrievable text.

## Context worth knowing

- **Two sessions worked this branch at once.** A sibling session implemented the same corpus-health
  security fix independently while this one did; the duplicate was dropped and the branch reset to the
  shared head. If a future task touches this area, check for concurrent work before starting.
- **A `Lighthouse budget` failure on #2512 was a runner-timing flake, not a regression.** Four
  render-timing metrics came in a few points over percentage tolerances on routes the diff cannot
  reach, while the same content graded green on `main` at `ea7c5c3d7`
  ([job 99920997048](https://github.com/BigSimmo/Database/actions/runs/33527187009/job/99920997048)).
  It passed on one re-run. Ledger item `#QSHHGK` already tracks that nothing schedules a
  Lighthouse baseline refresh; if these metrics drift persistently, that is the underlying cause and it
  belongs on `main`, not on a feature PR.
- **`ReadingTile`** (a count tile that can say "Not read") is deliberately local to the corpus-health
  page rather than in `panel-primitives.tsx`: it is the only panel whose numbers come from a live
  database read and can therefore be missing. Promote it the day a second page needs it.
