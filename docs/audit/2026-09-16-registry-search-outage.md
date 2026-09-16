# Registry search returned nothing for seven days

**Status:** mitigated in the application and now monitored. Root cause still open — it needs a
migration, and merging one reaches the live clinical database within seconds, so it needs an
approved window.
**Window:** 2026-09-09 to 2026-09-16. Found by an operator report, not by any gate.
**Impact:** Forms, Medications and Services search returned zero results on `psychiatry.tools`, for
every query, for every user. Not slow. Empty.

## What was measured

Against the deployed head `66105e18`, on 2026-09-16, anonymous and read-only:

```
GET /api/search/universal?q=transport&domains=forms,services,medications
server-timing: medications;dur=2502, services;dur=2504, forms;dur=2505, total;dur=2511

{"kind":"medications","total":0,"items":[],"latencyMs":2501,"error":true}
{"kind":"services",   "total":0,"items":[],"latencyMs":2502,"error":true}
{"kind":"forms",      "total":0,"items":[],"latencyMs":2503,"error":true}
```

Every domain pinned at 2500 ms, which is `registryDomainTimeoutMs` exactly. Three consecutive runs
gave the same figures, so this was not intermittent. The controls were healthy in the same window:

- `dsm`, `dictionary`, `tools`, `differentials` returned real results immediately. They read the
  in-bundle catalogue and never touch the database.
- `documents` returned real results in 2.7 s. It uses the retrieval path, not the catalogue read.

That split is the diagnosis on its own: **only the three domains that read
`read_site_content_public_records` were broken, and all three were.**

## Root cause, in order

1. **2026-09-09, `b753ed2b1`** replaced `loadOwnerCatalogue()` with
   `readCanonicalSiteContentRecords()` in `src/lib/universal-search.ts`. Moving to the canonical
   published record is correct. Three properties were dropped in the same move and none was
   replaced:
   - the **cache** (`owner-catalogue-cache`: 5 s TTL, single flight, LRU). That module is still in
     the tree, wired to nothing.
   - the **column projection**. The old read asked for roughly twenty named ranking columns. The
     RPC returns the whole `record` and `render_payload` JSON for every row.
   - the **owner condition**. The database was previously reached only for a signed-in owner.
2. **The read is slower than the budget it runs under.** Inside the function, `classified` computes
   `kind` as a `coalesce` over a column from the nullable side of a LEFT JOIN to
   `site_content_publications`, and only the _next_ CTE filters on it. The planner cannot push that
   predicate beneath the join, so every call builds the whole active release across all five kinds
   and discards four of them. Read from the SQL, not yet confirmed by a plan; see the queued EXPLAIN.
3. **A slow read becomes an empty one.** `universal-search` gives a registry domain 2500 ms. On
   timeout the domain is caught and converted to `{ total: 0, items: [], error: true }`.
4. **An empty one is indistinguishable from "no matches".** The endpoint returns HTTP 200 with a
   well-formed body. Nothing about the response says the catalogue is unreachable.

Step 3 is not a defect. "One slow or broken adapter must never blank the whole response" is the
right design. The defect is that when _every_ catalogue domain fails, that graceful degradation
degrades to nothing at all, silently, and no one is told.

## Why seven days passed

Four independent safety nets were in place. All four were blind to this.

| Net                               | Why it missed                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline test suite (20k+ tests)   | No test exercises a registry domain against a slow or failing catalogue read. The suite either runs demo mode or stubs a read that resolves instantly, so the timeout path had no coverage at all. |
| CI browser suite                  | Runs against a build with no live database. Registry search is served from in-bundle data there, so it passes whatever the production catalogue is doing.                                          |
| `live-domain-monitor` (every 6 h) | Probes HTTP status codes on routes and the shallow `/api/health`. A search returning zero results is a 200. The monitor cannot see it.                                                             |
| Error reporting                   | `universal-search` swallows the domain failure into `error: true` with no log line and no captured exception. There is no error-rate signal to spike.                                              |

**It was in fact seen, and misfiled.** Live QA on 2026-09-13 recorded ledger row `#6GR6B8`, "Tablet:
forms transport search blank", the same query and the same blank result, three days before it was
diagnosed. It was classified P1 but as a _tablet viewport/routing_ issue, because the reporter saw a
blank panel rather than a failed request. A backend outage spent three days filed as a UI bug.

## What has been done

- **The list routes had no budget at all.** `/api/registry/records` and `/api/medications` read the
  catalogue with no timeout, so during the outage they did not even fail fast — they held the
  request open. That is why Forms sat on "Searching…" rather than showing an empty result, and it
  was not found until 2026-09-16, after the search path had already been fixed. Both routes now use
  the seed fallback with a budget sized for a list read rather than a search read.
- **`PR #2805`** restored a cache in front of the catalogue read, with stale-while-revalidate and a
  regression guard that counts round trips. Correct and worth having, but it could never fix this:
  the cache only stores a _successful_ read, and the read never succeeded.
- **This change** adds `readCatalogueWithSeedFallback`. When the canonical read cannot answer inside
  1200 ms, the domain serves the in-bundle catalogue instead of nothing, and skips the read for 30 s
  so the rest of a typing burst is immediate. It re-probes after the cooldown, so it heals itself
  with no deploy the moment the database is fixed. It reports `degraded` rather than hiding it.
- **This change also makes the degradation visible**, which matters more than it sounds. A fallback
  that quietly absorbs a broken catalogue would have made the next occurrence of this outage harder
  to find than the first, because the screen would look right. So:
  - the fallback logs an error on the transition into seeds and an info line on recovery, rate
    limited to one pair per kind per cooldown, carrying the catalogue kind and failure shape and
    never a query;
  - a fan-out where every requested domain failed logs an error, because that is an outage rather
    than the graceful degradation the per-domain tolerance is for;
  - the response marks a group `degraded` when it was served from seeds, and `live-domain-monitor`
    now runs one real query per catalogue domain against production and fails on `error`, on zero
    results, and on `degraded` with equal severity. It probes only the catalogue domains, so it
    triggers no embedding call and stays inside that workflow's no-secrets, no-providers contract.

## The root-cause fix

`20260916103000_push_kind_filter_into_site_content_public_records.sql` rewrites the function so the
filter sits where the planner can use it. No new column and no index, which is what makes it
shippable: the table constraints already guarantee the two cases the classification needs.

- `target_publication_id is not null`. The foreign key on `(target_publication_id, logical_id)`
  guarantees the publication row exists, and `publications.kind` is `NOT NULL`, so the left join
  always matched and the `coalesce` always resolved to `p.kind`. Written as an inner join,
  `p.kind = p_kind` is a predicate on the inner relation and reaches the scan.
- `target_publication_id is null`. The old `WHERE` admitted this only for the bootstrap release,
  where no publication row exists, so kind and slug came from the logical-id prefix. Written as a
  prefix test rather than a `case`.

Equivalence was proven before the migration was written: from the constraints above, and by running
both definitions side by side on Postgres 16 across 224 `(scenario, kind, slug)` combinations — the
four release states, every valid kind plus an invalid one plus null, `LIKE` metacharacters, an
apostrophe, an empty slug, a missing slug, a publication whose kind deliberately disagrees with its
logical-id prefix, tombstoned and hidden records, and a bootstrap logical id matching no prefix. Row
for row identical in every case, with a non-vacuous sanity count alongside.

**It is not measured.** The speed reasoning is read from the SQL and the constraints, not from a
plan. It is a single transactional function replacement, reversible by replaying the previous
definition, and it builds nothing.

## What is still open

1. **Merging the migration.** Merging reaches the live clinical database within seconds, so it needs
   an approved window. Nothing else about it is outstanding.
2. **The EXPLAIN**, `scripts/operator-explain-site-content-public-records.sql`. Read-only, unrun.
   Step 0 alone settles whether the push-down theory above is right.
3. **`degraded` reaches the search results but not the mode list pages.** A search group served
   from seeds now says "may be out of date" beside its heading. The `/api/registry/records` and
   `/api/medications` responses cannot carry the flag yet: their client contract validates against
   a strict key allow-list, so adding a field without extending the parser in step would make every
   degraded response parse as an error. Threading it through is queued.

## Preventing the next one

Ordered by what would have caught _this_, soonest first.

1. **Assert results, not status codes.** LANDED. `live-domain-monitor` now runs one query per
   catalogue domain against production and fails on an errored, empty, or degraded domain. This is
   the single check that would have caught the outage within six hours instead of seven days, and
   it is cheap. Its verdict logic is a pure function with offline tests, following the
   deployment-freshness precedent where the first version measured the wrong thing and only a test
   caught it.
2. **Make a fully-degraded search loud.** LANDED. A fan-out where every requested domain failed now
   logs an error, and the seed fallback reports each transition into and out of degraded mode.
   Silent graceful degradation is only safe when something is watching the degradation.
3. **Cover the timeout path offline.** LANDED. A registry domain whose catalogue read rejects or
   never settles must still return items. Verified by removing the fallback and watching both cases
   fail; the reporting and `degraded` guards were mutation-tested the same way.
4. **Treat "blank results" as a backend symptom until proven a UI one.** `#6GR6B8` was filed as a
   viewport bug on the strength of a screenshot. A blank result set is a request outcome; check the
   response body before the component.
5. **When a mechanism is swapped, enumerate what it carried.** This is the generalisable lesson.
   `b753ed2b1` changed the _source_ of the catalogue and silently dropped a cache, a projection and
   an access condition that the old source had accumulated over months. None was mentioned in the
   change. A swap of this shape should list the properties of the thing being replaced and say, for
   each, whether it is preserved or deliberately dropped.

## Two additions from the Sentry side of the same day

Reviewed after this audit landed, from production telemetry rather than the search path.

### `/api/medications` was dropping `degraded` on the floor

`catalogue-seed-fallback` returns `degraded` precisely so a caller can tell the reader the list may
lag anything published since the last release, and its own header says never to drop it. The
universal-search surface honours that. The medication catalogue route did not: it took the fallback
and answered 200 with a seed catalogue presented as live. It now sets `retainedSnapshot` on the body
and `MedicationResultsView` renders the "Retained copy" notice, pointing the reader at the record's
own page, which still reads canonically. Pinned by the two cases added to
`tests/medications-route.test.ts`.

This is the same failure shape as point 2 above, one layer out. Making degradation loud in the logs
does not make it visible to the person reading the screen.

### A second, unrelated outage the same week

On 2026-09-15 at 18:00 UTC the project's Supabase edge returned HTTP 520 (x20) plus 521, 522, 525 and 503. Those are Cloudflare origin-connection codes and they carry an HTML error page rather than a
PostgREST body, which is why fragments of that page ("What happened?", "the bottom of this error
page") appear as bogus frames in the captured stack. Sentry recorded 247 events across four days on
`/api/medications`. This is an upstream availability failure, distinct from the slow read this audit
is about, and the budget-and-fallback mechanism already absorbs it.

Diagnosing it surfaced a separate defect in the error tracker: the fingerprint took the minified
filename and function verbatim, and both are regenerated on every build, so one recurring fault had
split across 25 separate Sentry issues. See `docs/error-tracking.md` for the normalisation and why
the minified-identifier pattern stops at two characters.
