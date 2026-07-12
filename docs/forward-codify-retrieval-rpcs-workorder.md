# Work order: forward-codify the live-ahead retrieval RPCs

Status: **staged, awaiting operator run.** Drift backlog item 0
(`docs/database-drift-detection.md#reconciliation-backlog`).

This is the fill-in-the-blanks procedure for reconciling the retrieval RPCs
whose **live bodies are ahead of the repo**. Everything that does not touch the
live project is prepared and committed (this doc, the capture query, and a guard
test). The remaining steps require a **quiescent live database** and **explicit
operator approval**, because capturing the bodies reads the live project and
applying the migration writes migration history to it.

## Why this exists (read before running)

The four hybrid retrieval RPCs plus several siblings were, historically, edited
directly on the live `Clinical KB Database` via raw SQL. Migration
`20260705210000` tried to reconcile them but carried **older** bodies than live;
applying it would have regressed production retrieval, so it was
**neutralized** on 2026-07-08. Since then the live bodies have kept churning
under concurrent multi-session editing, and they have diverged in **both**
directions — e.g. `match_document_chunks_hybrid` in `supabase/schema.sql` already
carries the fail-closed `retrieval_owner_matches(...)` predicate (applied via
`20260708160001`), while live is ahead on richer candidate construction (the
left-joined `document_index_quality.quality_score`, multi-strategy text ranking,
an `hnsw.ef_search=100` wrapper on `match_document_chunks`).

Because of that two-way divergence, **do not hand-author these bodies.** The
only correct source is a verbatim `pg_get_functiondef` capture from live. The
established precedent is `20260701140631_codify_live_retrieval_rpcs.sql` and
`20260707000000_codify_live_observed_drift.sql`: transcribe live verbatim,
validate byte-faithful, then apply as an idempotent no-op.

## Target set (7 functions)

The authoritative target set is every `functions` entry in
`supabase/drift-allowlist.json` whose `kind` is `mismatch` and whose `reason`
begins with **`LIVE IS AHEAD`**. As of this writing that is exactly seven:

| Signature (`oid::regprocedure`, `search_path=''`)                                                  |
| -------------------------------------------------------------------------------------------------- |
| `public.get_related_document_metadata(uuid[],uuid)`                                                |
| `public.match_document_chunks(extensions.vector,integer,double precision,uuid,uuid)`               |
| `public.match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)` |
| `public.match_document_chunks_text(text,integer,uuid[],uuid)`                                      |
| `public.match_document_table_facts_text(text,integer,uuid[],uuid)`                                 |
| `public.match_documents_for_query(text,integer,uuid)`                                              |
| `public.repair_strict_enrichment_gate_batch(integer)`                                              |

This list is duplicated in `scripts/sql/capture-live-retrieval-rpcs.sql`;
`tests/forward-codify-retrieval-targets.test.ts` fails if the two ever drift
apart, so reconciling a sibling (removing its allowlist entry) forces a matching
update to the capture query.

**Already reconciled siblings — do not re-add** (they are not in the allowlist
`LIVE IS AHEAD` set): `match_document_embedding_fields_text` was applied to live
via `20260706130000` and now matches the repo; `20260701140631` codified the
hybrid cores `match_document_embedding_fields_hybrid`,
`match_document_index_units_hybrid`, and the memory-cards wrapper +
`match_document_memory_cards_hybrid_v2`. Note that `match_document_chunks_hybrid`
_was_ codified by `20260701140631` but has since **re-drifted ahead** on live, so
it is back in the seven targets above — a reminder that codifying a churning RPC
buys parity only until the next live edit.

## Preconditions

- [ ] Explicit operator approval to read and later write the live project.
- [ ] The live retrieval RPCs are **quiescent** — no other session is mid-edit.
      A capture taken during churn is stale before it lands. Coordinate a window.
- [ ] Docker is running (`docker info` succeeds) — needed for the byte-faithful
      replay in `npm run drift:manifest`.
- [ ] Live service-role env is present for `npm run check:drift`
      (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_NAME`,
      `SUPABASE_SERVICE_ROLE_KEY`) and points at ref `sjrfecxgysukkwxsowpy`.
- [ ] Working on a feature branch (never author migrations on `main`).

## Step 1 — Capture the verbatim live bodies (provider read)

Run `scripts/sql/capture-live-retrieval-rpcs.sql` against live via the Supabase
Dashboard SQL editor, an approved service-role SQL path, or the Supabase MCP
`execute_sql` tool. It is read-only (`pg_proc` only). **Expect exactly 7 rows**,
each a `signature` + a full `CREATE OR REPLACE FUNCTION …` `definition`.

If you get fewer than 7 rows, a target signature no longer resolves on live.
Find which with:

```sql
set search_path = '';
select s as missing_signature
from unnest(array[
  'public.get_related_document_metadata(uuid[],uuid)',
  'public.match_document_chunks(extensions.vector,integer,double precision,uuid,uuid)',
  'public.match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)',
  'public.match_document_chunks_text(text,integer,uuid[],uuid)',
  'public.match_document_table_facts_text(text,integer,uuid[],uuid)',
  'public.match_documents_for_query(text,integer,uuid)',
  'public.repair_strict_enrichment_gate_batch(integer)'
]) as s
where to_regprocedure(s) is null;
```

Resolve the mismatch (update the target set + allowlist) before continuing.

> Note: the Dashboard SQL editor shows only the last statement's result set. If
> you use it, run the capture `select` on its own so its 7 rows are visible.
> `psql`/`execute_sql` return every result set.

## Step 2 — Author the forward migration

Create `supabase/migrations/<UTC-timestamp>_codify_live_retrieval_rpcs_forward.sql`
(e.g. `20260713NNNNNN_…`). Use the skeleton below. Paste each captured
`definition` **verbatim** into its slot — do not reformat, re-indent, or
"clean up" the body; verbatim is what makes the apply a byte-faithful no-op.

```sql
-- Forward-codify the live-ahead retrieval RPC bodies (drift backlog item 0).
--
-- The live Clinical KB Database carried newer raw-SQL retrieval bodies than the
-- repo for these 7 functions; migration 20260705210000 (older bodies) was
-- neutralized so a db push could not regress live. These definitions are
-- transcribed VERBATIM from live pg_get_functiondef (captured on a quiescent DB
-- via scripts/sql/capture-live-retrieval-rpcs.sql) and validated byte-faithful
-- before applying, so applying to live is a no-op while a clean replay now
-- reproduces exactly what production runs. Supersedes the older definitions in
-- the migration chain for these functions.
--
-- See docs/forward-codify-retrieval-rpcs-workorder.md.

set search_path = public, extensions, pg_temp;

-- 1. public.get_related_document_metadata(uuid[],uuid)
-- <<< PASTE captured definition verbatim >>>

-- 2. public.match_document_chunks(extensions.vector,integer,double precision,uuid,uuid)
-- <<< PASTE captured definition verbatim >>>

-- 3. public.match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)
-- <<< PASTE captured definition verbatim >>>

-- 4. public.match_document_chunks_text(text,integer,uuid[],uuid)
-- <<< PASTE captured definition verbatim >>>

-- 5. public.match_document_table_facts_text(text,integer,uuid[],uuid)
-- <<< PASTE captured definition verbatim >>>

-- 6. public.match_documents_for_query(text,integer,uuid)
-- <<< PASTE captured definition verbatim >>>

-- 7. public.repair_strict_enrichment_gate_batch(integer)
-- <<< PASTE captured definition verbatim >>>

-- ACLs: pg_get_functiondef does NOT include grants. check:drift compares the
-- `acl` field too, so add the revoke/grant statements only for functions whose
-- acl actually differs from schema.sql (Step 4 reports this). Precedent
-- (service-role-only), append per differing function:
--   revoke execute on function <signature> from public, anon, authenticated;
--   grant  execute on function <signature> to service_role;
```

## Step 3 — Reconcile `supabase/schema.sql`

For each of the 7 functions, replace its existing definition **statement** in
`supabase/schema.sql` with the captured verbatim definition. Each block starts at

```
create or replace function public.<name>(
```

and ends at its dollar-quote terminator (`$$;` or `$function$;`). Current
start lines (they shift as you edit — search by name, don't trust the numbers):

| Function                              | `create or replace function` at |
| ------------------------------------- | ------------------------------- |
| `match_document_chunks`               | ~line 2188                      |
| `match_document_chunks_hybrid`        | ~line 2243                      |
| `match_documents_for_query`           | ~line 3186                      |
| `match_document_chunks_text`          | ~line 3272                      |
| `get_related_document_metadata`       | ~line 3540                      |
| `match_document_table_facts_text`     | ~line 3593                      |
| `repair_strict_enrichment_gate_batch` | ~line 3881                      |

Leave the surrounding statements alone: only `repair_strict_enrichment_gate_batch`
has its own `revoke`/`grant` lines immediately after it (keep them, or update
them if Step 4 shows an `acl` diff); the `match_*` / `get_related_*` functions
have no adjacent per-function grants — their privileges come from the schema's
default/bulk grants, so do not invent new grant lines for them unless check:drift
reports an `acl` mismatch.

Verbatim `pg_get_functiondef` renders `CREATE OR REPLACE FUNCTION` in uppercase
with `$function$` delimiters; that cosmetic difference from schema.sql's
lowercase style is fine — check:drift and the manifest compare a
comment/whitespace-stripped hash, not raw text.

## Step 4 — Validate byte-faithful (Docker + live)

1. Regenerate the expected-state manifest from the edited schema (Docker replay):

   ```
   npm run drift:manifest
   ```

   This replays `supabase/schema.sql` into a scratch `supabase/postgres`
   container and recaptures `schema_drift_snapshot()`. It never touches live.

2. Confirm the manifest's `def_hash` for the 7 functions now equals live's. The
   cleanest proof is the full check:

   ```
   npm run check:drift        # needs live service-role env
   ```

   The 7 target functions should **no longer** appear as drift. (They will still
   be listed while their allowlist entries exist — as _allowlisted_, not as
   unexpected drift; remove the entries in Step 5 and they disappear entirely.)

3. Offline gate — manifest freshness + snapshot parity:

   ```
   npm run test -- tests/drift-detection.test.ts tests/forward-codify-retrieval-targets.test.ts
   ```

4. Retrieval quality is unchanged (required) and schema health is green:

   ```
   npm run eval:retrieval:quality      # expect 36/36 (provider-backed; approve)
   ```

   `select public.search_schema_health();` should return `ok`.

If a `def_hash` still differs after replay, the pasted body was altered in
transit (whitespace inside a dollar-quoted string, a smart-quote, a dropped
line). Re-capture and re-paste verbatim; do not "fix" it by editing the body.

## Step 5 — Remove the allowlist entries

Delete the 7 `functions`/`mismatch` entries whose reason begins `LIVE IS AHEAD`
from `supabase/drift-allowlist.json`, update
`tests/forward-codify-retrieval-targets.test.ts`'s expectation to empty (or
delete the guard once the backlog item is closed), mark item 0 done in
`docs/database-drift-detection.md`, and re-run `npm run check:drift` — it should
now report **no** allowlisted retrieval divergence and **no** stale entries.

## Step 6 — Apply to live

Apply the new migration through the normal linked migration workflow (operator).
Because the bodies were captured from live, this is an **idempotent no-op** on
the live project; its value is that `supabase db reset`, branch/preview DBs, and
disaster-recovery replays now rebuild production's retrieval layer exactly.

## Rollback / safety

- The migration only issues `create or replace function` (+ any needed grants).
  If a body was captured wrong and applied, re-running with a corrected capture
  supersedes it; there is no destructive DDL here.
- Never edit these functions on live with raw SQL — that is how this incident
  class started. Fixes go through migrations only.
- If the DB was not actually quiescent (a concurrent edit landed between capture
  and apply), `check:drift` will flag the residual diff. Re-capture and repeat.

## Division of labor

- 🤖 **Prepared (committed, no live access):** this work order, the read-only
  capture query, the offline guard test, and the backlog link.
- 🧑 **Operator (needs approval + a quiescent DB):** run the capture (Step 1),
  paste the verbatim bodies (Steps 2–3), run the Docker + live validation
  (Step 4), prune the allowlist (Step 5), and apply (Step 6).
