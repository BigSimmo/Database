# Every public catalogue read re-hashed the whole frozen corpus

**Status:** mitigated in the application on 2026-09-16 and the mitigation is committed. The root
cause is still live: it needs a migration, and merging one reaches the live clinical database within
seconds, so it needs an approved window.
**Window:** 2026-09-09 to 2026-09-16. Found by the owner, in a browser. No gate reported it.
**Impact:** every anonymous Services, Forms, Medications and Differentials request on
`psychiatry.tools` spent roughly four seconds inside one database function. Catalogue search gives
up at 1,200 ms, so search had been answering from the bundled copy shipped in the build rather than
from the database. List reads sat on their 6,000 ms budget, which is why the same page was sometimes
quick and sometimes not.

This is the second audit of the same week and the same function. The first
([`2026-09-16-registry-search-outage.md`](2026-09-16-registry-search-outage.md)) explains why
registry search returned nothing for seven days. This one explains why, once it returned something,
it took seconds — a different defect on the same read path, found while confirming the first was
fixed.

## What was measured, and what was not

**Measured against production, 2026-09-16, anonymous.** The owner probed the deployed site from a
browser and the investigations repeated it. Roughly 4.2 s for a catalogue read; the working notes
record 4.5–6.5 s across repeats, a 6.4 s `?kind=service` list and a 4.6 s single-record detail whose
body was about 8 KB. The spread is real: the list routes sit on a 6,000 ms internal budget, so a read
that crosses it is abandoned and answered from bundled data instead. Treat the individual numbers as
a range from a handful of probes, not a distribution.

**The detail response is the decisive one.** 8 KB of output took as long as the whole catalogue. The
cost is therefore not the payload, not the row count and not the filter — it is fixed work the
function does before it looks at what was asked for.

**Reconstructed offline, and confirmed by hash.** The frozen epoch-zero population was rebuilt from
the blob in the applied migration and the SQL canonicaliser reimplemented in JavaScript:

```
rows                         843
canonical document bytes     9,522,923
total JSON nodes             164,820
container nodes               55,103
sha256 of canonical bytes    57f6ec90225fc4341b446705f50a48b132f2872172d8f93888bf921fe7bfa1bc
```

That hash equals the `release_digest` pinned by
`supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql:910`. So the shape and
size of the work are established rather than estimated. What is _not_ established is the per-unit
cost: no `EXPLAIN (ANALYZE)` has been run against this function, and the arithmetic below that turns
node counts into seconds is an inference. `scripts/operator-explain-site-content-public-records.sql`
is the ready-to-run, read-only script that would settle it; it is provider-backed and unrun
(ledger `#YE6BZB`).

## Root cause, in order

1. **2026-08-30, `20260830121000_bind_site_content_release_transitions.sql`** put
   `site_content_bootstrap_digest(r.id)` inside `site_content_retained_bootstrap_valid` (`:141`) and
   on the reader itself (`:591`). Harmless at the time, because no public request reached the
   database.
2. **2026-09-09, `b753ed2b1`** deleted the anonymous early return from
   `src/app/api/registry/records/route.ts` and replaced it — along with `loadOwnerCatalogue()` in
   `src/lib/universal-search.ts` — with `readCanonicalSiteContentRecords`. Until that commit the
   public catalogue was served from an in-bundle copy with a five-minute browser cache and an hour
   at any shared cache, and the database was reached **only for a signed-in owner**. After it, every
   anonymous page view ran the function from step 1.
3. **The function hashes the entire frozen corpus twice per call.** Both sites are reached whenever
   the active release is one of the retained epoch-zero bootstraps, which is what production has
   served since 2026-08-24:
   - `supabase/schema.sql:16844` — directly, in the reader's `transition` CTE
     (`supabase/migrations/20260916160000_triple_pin_retained_bootstrap_release_ids.sql:111`).
   - `supabase/schema.sql:16392` — again, indirectly, because the reader's first CTE calls
     `site_content_current_transition_kind`, which calls `site_content_retained_bootstrap_valid`,
     which contains the same equality.

   Each evaluation canonicalises 9.52 MB through `site_content_canonical_json`
   (`supabase/schema.sql:12746`), a **recursive plpgsql** function that runs one invocation per JSON
   node and a `string_agg` subquery at every container. Two evaluations is roughly 330,000 plpgsql
   invocations and 110,000 planned aggregate subqueries per HTTP request. The SHA-256 itself is
   trivial by comparison. _This node-count-to-seconds step is read from the SQL, not profiled._

4. **A third full pass over the same rows, in the same call.**
   `site_content_retained_bootstrap_valid` also runs a `NOT EXISTS` over all 843 rows
   (`supabase/schema.sql:16393-16410`) that detoasts each row's `record` JSON and compares
   `record->>'body'` against `normalized_text` — another decompress-and-compare sweep of essentially
   the same 9.5 MB. Fixing only the digest leaves this behind.
5. **Nothing about the request changes the cost.** The digest sits in the `state` and `transition`
   CTEs, before the `p_kind`/`p_slug` filter is applied and independent of how many rows come back.
   That is why `20260916103000_push_kind_filter_into_site_content_public_records.sql` — a correct
   fix for the _join_ cost, and the subject of the previous audit — did not move the latency at all.
6. **The budgets then turned slowness into stale content.** Catalogue search abandons the read at
   `catalogueSeedFallbackBudgetMs = 1_200` (`src/lib/site-content/catalogue-seed-fallback.ts:37`)
   and serves the in-bundle catalogue for 30 s. A four-second read never beats that budget, so
   **catalogue search has been answering from bundled data, not the database, since the fallback
   landed.** List reads get `catalogueListFallbackBudgetMs = 6_000` (`:48`) — close enough to the
   measured time that the same URL can be canonical on one request and bundled on the next.

## What the per-read check was actually proving

The digest equality is the fail-closed switch. If it is false the reader returns no records and the
snapshot state becomes `unavailable`, so a tampered or half-populated corpus is withheld rather than
served as clinical reference content. That behaviour is right and must survive any fix.

But the property it re-proves on every page view is already held by three cheaper things, which is
the whole argument for moving it:

- The corpus was verified against this exact digest **transactionally, when the migration applied**
  — `20260824122000_add_site_content_release_and_outbox.sql:907-913` compares the digest and the row
  count in the same transaction as the seed `insert` and raises
  `site_content_bootstrap_population_mismatch` otherwise. Applied live 2026-09-11.
- The rows have been **immutable against `UPDATE` and `DELETE` by trigger** ever since
  (`supabase/schema.sql:12722-12724`).
- The release id the reader pins is **cryptographically bound to the stored digest** by
  `r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')`
  (`supabase/schema.sql:16388`) — a four-key hash costing microseconds, which cannot be satisfied by
  a rewritten digest short of a SHA-256 preimage.

There is one genuine gap, and it argues for a stronger fix rather than for keeping the check:
`INSERT` into the bootstrap release is not blocked by anything. The digest is the only thing that
notices, and it notices after the fact, 9.5 MB at a time, on every reader's request.

## Why every gate missed it

| Gate                                     | Why it missed                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline unit suite                       | The defect is the runtime cost of SQL. The suite has no database; the site-content tests slice function bodies out of migration files as _text_ and assert on their structure, which a slow-but-correct body passes.                                                                                          |
| CI browser suite                         | Runs against a build with no live database, so these routes are served from bundled data there — exactly the fast path that production had stopped using.                                                                                                                                                     |
| `Migration replay`                       | Replays the whole chain on a local Postgres and proves it applies. It times nothing. No gate anywhere sets a latency budget for a request-path RPC.                                                                                                                                                           |
| `check:drift`, `check:migration-history` | Compare live schema and applied history against the repository. A function that is present, correct and slow is not drift.                                                                                                                                                                                    |
| `live-domain-monitor` (every 6 h)        | Fixed by the previous audit to assert on _results_ rather than status codes. It passed here, correctly: the seed fallback returns a full, non-empty, plausible catalogue within budget. It has no latency assertion and could not distinguish bundled data from live.                                         |
| Error reporting                          | A slow HTTP 200 is not an exception. Nothing was thrown.                                                                                                                                                                                                                                                      |
| The process cache added the same day     | `42261cdbd` (PR #2805) added a 15 s process cache for precisely this read. It could never store anything: `rowsAreCacheable` required `snapshot.state === "current"`, and the RPC reports `unavailable` for a retained bootstrap — which is what production has been. The cache was inert for its whole life. |

**And it was half-known.** Ledger row `#458SAC` records that `read_site_content_health()` costs
about seven seconds against the live database and had failed 24 production deploys between
2026-09-11 and 2026-09-14; the comment at `src/lib/health-response.ts:148-158` records the same.
That was diagnosed as a health-endpoint problem and taken off the readiness gate. The seven seconds
and the four seconds have the same cause — a whole-corpus canonicalisation in plpgsql — and nobody
joined them, because one was filed under deploys and the other had not yet been noticed.

## What has been changed

**`5cb1bfc0b` (this branch) — application side only.**

- `rowsAreCacheable` now also retains a **valid retained epoch-zero bootstrap**, not just a `current`
  snapshot. The discriminator is exact rather than a guess: the RPC emits `releaseId` as
  `case when s.valid then s.active_release_id else null end`, so a non-null `releaseId` means the
  release passed its integrity check _on that very read_. A response carrying no records is still
  never stored, so a mid-publication read cannot pin an empty catalogue.
- The four whole-catalogue list reads — `/api/registry/records`, `/api/medications` and both
  branches of `/api/differentials` — now opt in. Detail and publication reads deliberately do not,
  so an operator still sees their own change immediately.

Net effect: one request in each 15 s window pays the four seconds instead of all of them, and the
stale ceiling is ten minutes behind a background refresh. **Detail-page reads still pay it in full,
every time**, and search still loses its 1,200 ms race on the read that does go through.

**The database fix is drafted, uncommitted and unreviewed.**
`supabase/migrations/20260916190000_seal_bootstrap_release_and_drop_per_read_digest.sql` exists in
the working tree as this is written; it is not committed, not reviewed and not merged, so treat the
description below as the intended shape rather than as what ships. It (i) re-verifies the digest
once, inside its own transaction, so it aborts rather than blessing a corpus that has already
drifted; (ii) seals the retained bootstrap releases against `INSERT` and the table against
`TRUNCATE` with `enable always` triggers, closing the one real gap; (iii) replaces the per-read
digest equality — in both the reader and the transition classifier — with the existing release-id
binding plus an index-only row count; and (iv) takes the 843-row structural sweep off the read path
with it. The full cryptographic re-derivation stays in `read_site_content_health()` and in the
mutation RPCs, where it already runs.

Merging it reaches the live clinical database within seconds, so it needs an approved window, and it
must not carry auto-merge.

## What is still open

1. **Reviewing and merging the migration above.** Nothing else about the four seconds is
   outstanding.
2. **The `EXPLAIN`.** `scripts/operator-explain-site-content-public-records.sql` — read-only, still
   unrun (ledger `#YE6BZB`). Its step 0 reads `pg_stat_statements` and settles the real per-call
   cost without an `EXPLAIN` at all.
3. **The third full pass** (root cause 4) survives any digest-only fix. The drafted migration
   removes it from the read path; nothing has proved that yet.
4. **`read_site_content_health()` repeats the same whole-corpus work several times in one call.**
   Counting call sites in `supabase/schema.sql:15112-15342`: four `site_content_bootstrap_digest`
   evaluations (`:15184`, `:15185`, `:15285`, `:15286`) plus two further whole-release aggregates
   via `site_content_release_digest` and `site_content_dynamic_state_digest`. One investigation put
   the figure at five; the count above is what the current mirror actually contains. How many are
   _evaluated_ per call depends on planner materialisation and on which branches are reachable, and
   has not been measured. Queued.
5. **Whether the live public catalogue is still the 2026-08-24 freeze**, and therefore whether WA
   service contact details corrected in the repository since then are on the site at all. Inferred
   from code and CI evidence, never confirmed by a live read. Already queued as an inbox request;
   clinically relevant, and it needs an approved window to settle.

## Preventing the next one

Ordered by what would have caught _this_, soonest first.

1. **The durable rule: a request-path read may never re-verify an immutable corpus.** Written into
   [`docs/site-content-sync-runbook.md`](../site-content-sync-runbook.md) § "Verification of the
   freeze belongs at write time, not on the read path", which is the document that owns the freeze
   and its immutability. That rule, applied on 2026-08-30, would have stopped this being written.
2. **Give the request-path RPC a latency budget in a gate that can time it.**
   `npm run check:site-content-control-plane` already replays the control plane against a real
   Postgres in Docker. A bounded `EXPLAIN (ANALYZE)` budget on `read_site_content_public_records`
   there would have gone red the day the digest was added, offline, with no provider access.
3. **Assert that the reader contains no whole-corpus aggregate**, structurally, the way
   `tests/site-content-public-records-kind-filter.test.ts` already asserts the kind filter cannot
   regress. Both regressions were invisible in review for the same reason: the body is a wall of SQL
   and one call among many looks like the others.
4. **A degraded answer needs a latency signal, not just a degraded flag.** `live-domain-monitor`
   passing on bundled data is correct behaviour and was also the reason nobody looked. A monitor
   that records how long the canonical read took, and says so when it never completes, would have
   made "search is answering from the build" visible rather than inferable.
5. **When a mechanism is swapped, enumerate what it carried.** This is the previous audit's closing
   lesson, and `b753ed2b1` is now its second instance in the same file: that commit dropped a cache,
   a column projection, an owner condition **and** an HTTP cache policy, and moved an anonymous read
   onto a function whose cost nobody had reason to think about. A swap of this shape should list the
   properties of the thing being replaced and say, for each, whether it is preserved or deliberately
   dropped.
