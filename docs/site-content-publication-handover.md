# Handover — the database work left, and how to finish it

**Written 2026-09-18, after the catalogue read-latency incident was closed. Every figure below was
read from the live project or the repository on that date. Where something is inferred rather than
measured it says so.**

---

## 1. What was wrong, and what is now fixed

`read_site_content_public_records` — the single read behind all seven public registry GET routes,
universal search and the differentials loader — walked the whole 843-row frozen catalogue **three
times per call**, canonicalising 9.5 MB through a recursive PL/pgSQL function each time.

|                                      |                           Before |                 After |
| ------------------------------------ | -------------------------------: | --------------------: |
| `pg_stat_statements` mean            |                     **8,656 ms** | **~80 ms** (min 4 ms) |
| `/api/differentials?limit=1`         |                           7.30 s |                ~1.4 s |
| `/api/registry/records?kind=service` |     6.01 s (the abandon ceiling) |                ~1.6 s |
| Universal search, services           | over budget, served bundled data |    ~130 ms, live data |

**Landed:** `20260916190000_seal_bootstrap_release_and_drop_per_read_digest` (#2855),
`20260917150000_revoke_execute_on_sealed_bootstrap_guard` (#2858),
`bundled-service-catalogue.ts` (#2861), `report-site-content-reconciliation.ts` (#2872), ledger
corrections (#2873, #2876).

**The trap that nearly shipped.** While the read was failing, search fell back to the catalogue
compiled into the app — which is **fresher** than the published release. Fixing the read made
`degraded` go false, search began answering from the 2026-08-24 freeze, and crisis services
disappeared: "sexual assault" stopped returning SARC, "suicide" stopped returning StandBy,
"1800respect" returned nothing. Every metric improved while content vanished. #2861 restores them
behind a gate that switches itself off the moment a real release is activated.

---

## 2. The publication — what is built, what is not, and what only the owner can do

### 2.1 Why this exists

Live holds **one** release: `e4a1dd29-14f6-556c-8fb7-f4f947d8b846`, `state = active`, 843 records,
`initialized = false`. That is the 2026-08-24 epoch-zero freeze. The repository carries 244
services against the release's 227, so the **17 service records added by #2814 are not in the
database**. `#HTZPQ8` (P1) is that gap; `#5AA5CD` (P1) is the rule that it must be closed by
publishing rather than by regenerating the freeze.

The pipeline has **never been run**: zero publications, zero sync events, zero reconciliation
plans, zero release receipts. So this is _initial adoption_, which the runbook says "must not be
compressed into one privileged script".

### 2.2 The measurement, and the good news

`npm run …` → `node scripts/run-tsx.mjs scripts/report-site-content-reconciliation.ts --kind service`

Measured 2026-09-18:

|                                   |                              |
| --------------------------------- | ---------------------------: |
| owner rows (candidates)           |                          222 |
| logical groups                    | 222 — **one candidate each** |
| distinct content hashes per group |                        **1** |
| published groups                  |                          227 |
| published, no owner row           |                            8 |
| owner row, not yet published      |                            3 |

**There are no per-record judgement calls.** An earlier estimate of 1,164 decisions was wrong: it
counted source rows, not groups needing a decision. Every group has exactly one candidate and one
version of itself, so there is nothing to choose _between_.

What the report flags as divergent is divergence from the **published** snapshot, and the field
breakdown says what moved:

| field                                                                         |   differs |
| ----------------------------------------------------------------------------- | --------: |
| `validationStatus`                                                            |   219/219 |
| `sourceStatus`                                                                |   211/219 |
| `version`, `producerClass`, `domain`, `sourceRole`, `access`, `sourceLineage` | **0/219** |

Identity matches exactly, so the comparison is sound and this is real drift in governance metadata
since the freeze — consistent with the source-ageing work merged since August.

**So the review is one policy question — do you accept the current registry state as the new
published state? — plus eleven individual records** (the 8 published with no owner row, the 3 never
published).

### 2.3 What is built

| Artefact                                                  | What it does                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/sql/operator-export-site-content-population.sql` | Read-only export of the exact published population, in the shape `ExistingSiteContentReleaseRecord` declares. Run in the Supabase SQL editor. |
| `scripts/build-site-content-dynamic-input.ts`             | Turns that export into the planner's `--dynamic` file. Holds no credentials.                                                                  |
| `scripts/build-site-content-reconciliation-plan.ts`       | Emits the `--reconciliation` file, and **refuses** when a human must decide.                                                                  |
| `scripts/report-site-content-reconciliation.ts`           | Sizes the review (§2.2). Already on `main`.                                                                                                   |

**Why the export is a SQL file and not a script that connects.** `service_role` has **no SELECT on
any of the six site-content control-plane tables** — verified with `has_table_privilege()` on
2026-09-18:

```
site_content_release_records  false     site_content_publications  false
site_content_releases         false     site_content_sync_events   false
site_content_sync_state       false     clinical_registry_records  TRUE
```

That is deliberate. The control plane is reached through its RPCs, not by a key an application
holds, so the privileged read stays with an operator.

### 2.4 What only the owner can do

`record_reconciliation` and the publication commands go through `/api/site-content/publications`.
The SQL requires `auth.uid()`, locks that exact `auth.users` row, derives administrator authority
from immutable app metadata, and **rejects service-role mutation outright**. An agent cannot
perform these steps, by design. **They are the owner's, signed in, in the app.**

### 2.5 The order, and why it is an order

> 🔴 **RUN AGAINST LIVE 2026-09-21, AND STEP 3 CANNOT COMPLETE.** The order below is correct for an
> _adoption_ — bringing already-public records under control-plane management. This corpus is not
> in that state. `site_content_publications` has **0** rows, `site_content_public_records` has **0**
> rows, and all 222 service rows and 54 form rows in `clinical_registry_records` carry a non-null
> `owner_id`. A group is only comparable when its canonical candidate is published, rendered,
> explicitly reconciled **and** unowned, so no trusted snapshot can be built, and the planner now
> refuses with `PLAN NOT WRITTEN — and this is NOT a finding about the catalogue's content`.
>
> Step 1 works and is worth running; steps 2 and 3 will tell you the same thing. **This is a first
> publication, not an adoption**, and which mechanism applies is an open owner decision. Do **not**
> unblock it by loosening `reconcileCanonicalPublicSiteContent` — that marks owner-scoped rows
> canonical for a clinical publication, which is the judgement the planner exists to refuse.

1. **Operator export** — run `operator-export-site-content-population.sql`, save the JSON.
2. **Size it** — `report-site-content-reconciliation.ts`. Settle the policy question in §2.2.
3. **Build the plan** — `build-site-content-reconciliation-plan.ts --population export.json`.
   It stops if any group still needs a decision.
4. **Owner records it** — POST `{"action":"record_reconciliation","plan":…}` as an authenticated
   administrator.
5. **Publish each `adopt`** in deterministic plan order against the persisted plan digest.
6. **Dynamic input** — `build-site-content-dynamic-input.ts --population export.json --records …`.
   `records` cannot be built before step 4, because a projection needs the reconciliation to have
   decided which candidate is canonical (`adoptCanonicalRegistryProjection` takes a group _plus_
   its trusted snapshot). This is the one real ordering constraint in the whole job.
7. **Plan** — `sync-site-content-corpus.ts` dry run, then the guarded write.
8. **Worker** — enable it; it claims events and calls the embedding provider.
9. **Activate** — with P05 recovery evidence and the content-addressed receipt.

### 2.6 Traps that will cost a window

- **`publicRecordId` has two conventions.** A reconciliation plan's trusted snapshots require
  `publicRecordId === logicalId`. `expectedCanonicalPublicRegistrySnapshot` keys on the candidate's
  own record id. Do not copy one into the other.
- **The frozen release has no embeddings at all** (`embedding_model =
'bootstrap-no-embedding'`, 0/843 with a vector), so nothing can be reused and the first
  publication embeds everything in scope — ~244 records for services. Cost: a few cents.
- **An empty `records` is a teardown, not a no-op.** It plans a publication that retires the whole
  published population. `build-site-content-dynamic-input.ts` therefore refuses to default it.
- **A stalled publication fails closed.** A collection read is all-or-nothing while a head is
  outstanding, so the public catalogue goes blank rather than partial. Do this watching the site.
- **Activation and rollback have never been drilled on real data.** The runbook lists that as an
  open acceptance gate.
- **Never regenerate the freeze to move content.** PR #2814 did, live kept the old identity, and
  the post-merge `live-drift` run went red; #2828 reverted it. `#5AA5CD` is that rule.

---

## 3. Every database issue still open

Read from `main`'s ledger on 2026-09-18.

### P1

| Id        | What it is                                                                                                                                                                                                                      | What closes it                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `#HTZPQ8` | Live catalogue is still the 2026-08-24 freeze, so 17 curated service records are not on the site. **Confirmed by live read**, no longer inferred.                                                                               | The publication (§2). Partially mitigated by #2861.                      |
| `#5AA5CD` | Regenerating the frozen bootstrap re-keys a content-addressed identity that live and applied migrations pin. **Its blocking read is done**: production still serves `e4a1dd29`, so this would be a production-behaviour change. | Publish instead of regenerating. The row's `STOP` now rests on evidence. |
| `#GJHKYC` | Do not re-index until the worker has deployed the extraction fix.                                                                                                                                                               | Deploy the worker fix, then re-index and run the retrieval-quality gate. |

### P2 — cost and correctness on the same read path

| Id                  | What it is                                                                                                                                                                                                                      | Suggested fix                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `#458SAC`           | `read_site_content_health()` costs ~7 s and stalled 24 production deploys. It canonicalises the whole corpus **four times** in one call (`schema.sql:15184, :15185, :15285, :15286`) plus two further whole-release aggregates. | Fold each pair that compares two stored columns to the same freshly computed digest into **one** evaluation via a scalar subquery or lateral. No semantic change, roughly halves the work. Ships as a forward migration.                                                                               |
| `#PX8N86`           | Every catalogue search reads the whole release payload because the kind filter cannot reach the scan beneath the left join to `site_content_publications`.                                                                      | Re-measure first — the digest removal may have changed the plan. `EXPLAIN (ANALYZE)` the reader now before assuming the old diagnosis holds.                                                                                                                                                           |
| Rescued, 2026-09-16 | `site_content_release_records_immutable` is an ordinary row trigger, so `session_replication_role = replica` bypasses it; it covers only UPDATE/DELETE, not INSERT or TRUNCATE.                                                 | `alter table … enable always trigger`. **Partly closed already**: `20260916190000` added `enable always` INSERT and TRUNCATE triggers for the retained bootstrap ids. Promoting the existing row trigger is the remaining one-liner, and wants `check:site-content-control-plane` run in Docker first. |
| Rescued, 2026-09-16 | `site_content_canonical_json` is recursive PL/pgSQL — one invocation per JSON node. Fine at activation today; a 2,000-record release makes activation slow the same way the read path was.                                      | Nothing yet. Before the catalogue grows materially, time one activation against a realistic release and record the node-count-to-seconds curve. **Do not rewrite it as a performance fix** — any byte-level change invalidates every stored fingerprint.                                               |
| Rescued, 2026-09-16 | `read_site_content_health()` repeated hashing — the concrete mechanism behind `#458SAC`.                                                                                                                                        | Read with `#458SAC`; same fix.                                                                                                                                                                                                                                                                         |
| `#QCNE6N`           | Schema drift is gated against `schema.sql` only; the migration chain's semantics are never diffed against the mirror. Chain/mirror parity in CI is **report-only**.                                                             | Commit `supabase/chain-mirror-allowlist.json` from the job summary, add `--strict`, drop the `continue-on-error` lines in the same change. `tests/chain-mirror-parity.test.ts` pins those two facts together.                                                                                          |
| `#CNSDBJ`           | Nothing makes applied migrations immutable in general.                                                                                                                                                                          | **Largely closed**: `scripts/check-migration-immutability.mjs` and `supabase/applied-migration-hashes.json` now seal all 250 migrations by content hash. Re-read the row; it may only need the escape-hatch decision recorded.                                                                         |
| `#H6HPTF`           | The stored lithium row still holds withheld text. Nothing serves it — every read path applies the projection — but a future consumer reading the row directly would re-expose it.                                               | A governed operator run of `sync-site-content-corpus.ts --write`. Rides naturally on the publication (§2).                                                                                                                                                                                             |
| `#8VAY97`           | `document_index_units` retrieval path has no `EXPLAIN` baseline.                                                                                                                                                                | Same method that settled `#YE6BZB`: read `pg_stat_statements` before reaching for `EXPLAIN`.                                                                                                                                                                                                           |
| `#CC8D30`           | Two read-only live reads owed before the migration-history guard and reindex work.                                                                                                                                              | Read-only; schedule with any live window.                                                                                                                                                                                                                                                              |
| `#6APN03`           | Corpus health panel and hub document count never seen against the real library.                                                                                                                                                 | Look at it once against live.                                                                                                                                                                                                                                                                          |
| `#RP00FZ`           | Reindex reaper: the storage-object half of abandoned-generation cleanup is missing.                                                                                                                                             | Build it with the reindex work, not before.                                                                                                                                                                                                                                                            |

### Closed today, recorded so nobody reopens them

- **`#E0FSGS` (P1) — closed as disproven.** It claimed `schema.sql` was unreplayable and
  `drift:manifest` could not run. `drift:manifest` ran twice (47 s, 58 s) and CI's
  `db-reset-verify` passed on both. The row was written **15 hours after** PR #2828 repaired the
  condition. **It mattered**: its remedy was to re-key the bootstrap UUID across the live control
  plane to fix something absent.
- **`#YE6BZB` — closed as measured.** 8,656 ms → ~80 ms.

---

## 4. Not database, but it gates everything above

- **All three automated reviewers are out of quota** — Codex, CodeRabbit and Cursor Bugbot each
  posted a limit notice on today's PRs. Two changes reached the live clinical database with **no
  automated review**. This is the cheapest thing on the list to fix.
- **`Build` is flaky on `main`** — `Cannot find native binding` in `next/font`, the npm
  optional-dependency bug, failing and passing intermittently across unrelated merges. Overlaps
  `#T82ND3`. Flaky red trains people to ignore red.
- **The heavy-run lock is heavily contended.** Four worktrees held it in succession for over two
  hours on 2026-09-18, which blocked `verify:pr-local` on every PR in that window. Not a defect —
  but plan around it, and prefer the focused gates when it is busy.

---

## 5. If you do one thing next

Top up the review bots. Everything else here is scheduled work with a known shape; that one is a
missing control, and it is missing on exactly the changes that reach a live clinical database.
