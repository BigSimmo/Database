# Registry search returned nothing for seven days

**Status:** mitigated in the application, root cause still open (needs a migration in an approved window).
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

- **`PR #2805`** restored a cache in front of the catalogue read, with stale-while-revalidate and a
  regression guard that counts round trips. Correct and worth having, but it could never fix this:
  the cache only stores a _successful_ read, and the read never succeeded.
- **This change** adds `readCatalogueWithSeedFallback`. When the canonical read cannot answer inside
  1200 ms, the domain serves the in-bundle catalogue instead of nothing, and skips the read for 30 s
  so the rest of a typing burst is immediate. It re-probes after the cooldown, so it heals itself
  with no deploy the moment the database is fixed. It reports `degraded` rather than hiding it.

## What is still open

1. **The migration.** A stored, indexed `kind` column on `site_content_release_records` so the filter
   can reach the scan, plus a narrower return for ranking callers. Queued in the ledger with its
   gate: merging a migration reaches the live clinical database within seconds, so it needs an
   approved window, and `CREATE INDEX CONCURRENTLY` cannot run in that transaction.
2. **The EXPLAIN**, `scripts/operator-explain-site-content-public-records.sql`. Read-only, unrun.
   Step 0 alone settles whether the push-down theory above is right.
3. **Nothing renders `degraded`.** The signal now exists in the response and no UI consumes it. A
   reader cannot currently tell that the list they are searching may lag behind what was published.

## Preventing the next one

Ordered by what would have caught _this_, soonest first.

1. **Assert results, not status codes.** Extend `live-domain-monitor` to run one query per
   catalogue domain against production and fail when a domain returns `error: true` or zero items
   for a query with a known match. This is the single check that would have caught it within six
   hours instead of seven days, and it is cheap.
2. **Make a fully-degraded search loud.** A response where every requested domain errored should
   emit a captured exception, not just a field in the body. Silent graceful degradation is only safe
   when something is watching the degradation.
3. **Cover the timeout path offline.** Landed with this change: a registry domain whose catalogue
   read rejects or never settles must still return items. Verified by removing the fallback and
   watching both cases fail.
4. **Treat "blank results" as a backend symptom until proven a UI one.** `#6GR6B8` was filed as a
   viewport bug on the strength of a screenshot. A blank result set is a request outcome; check the
   response body before the component.
5. **When a mechanism is swapped, enumerate what it carried.** This is the generalisable lesson.
   `b753ed2b1` changed the _source_ of the catalogue and silently dropped a cache, a projection and
   an access condition that the old source had accumulated over months. None was mentioned in the
   change. A swap of this shape should list the properties of the thing being replaced and say, for
   each, whether it is preserved or deliberately dropped.
