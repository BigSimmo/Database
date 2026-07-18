# Deploy runbook — public-title corrector migrations (F10)

Covers the ordered corrector migrations
`supabase/migrations/20260717120000_corrector_public_titles_only.sql` and
`supabase/migrations/20260717171000_public_title_corrector.sql` for the live
**Clinical KB Database** project (`sjrfecxgysukkwxsowpy`).

**What it does:** scopes `public.correct_clinical_query_terms` (the clinical query-term
corrector) so its spell-correction vocabulary is built only from the **public
(null-owner) corpus** — both `rag_aliases` reads and the document-title scan. This
closes a cross-tenant side-channel where a `SECURITY DEFINER` read leaked private
documents' title/alias tokens into other tenants' query corrections.

**Risk:** medium and reversible with a reviewed forward migration. The `…120000`
privacy baseline is a signature-compatible `CREATE OR REPLACE FUNCTION`. The later
`…171000` implementation creates and backfills `document_title_words`, adds indexes
and a synchronization trigger, then replaces the same corrector. It does not rewrite
clinical source content, but its DDL, index build, and backfill require the normal
production-change controls and the stale-row blocker below must be cleared first.

**Repository status:** both corrector migrations and their schema mirror are merged.
Live apply state is deliberately **unconfirmed** in this document. Never assume either
corrector migration is the sole pending migration; inspect the linked migration table
and review the complete pending sequence immediately before an authorized apply.

## Required migration order

Supabase applies migrations by filename. The relevant ordered sequence is:

1. `20260717120000_corrector_public_titles_only.sql` — establishes the public-only
   privacy baseline.
2. `20260717170000_registry_projection_cleanup.sql` — the earlier performance
   migration in the current chain; see
   [operator-apply-performance-latency-remediation.md](operator-apply-performance-latency-remediation.md).
3. `20260717171000_public_title_corrector.sql` — installs the indexed public-title
   vocabulary. Its trigger keeps new rows public-only, but the migration does not purge
   unsafe rows inserted by the earlier `20260714180000` migration.

Other reviewed repository migrations can appear between or after these entries. Do
not selectively mark migrations applied, reorder filenames, or skip an earlier pending
migration to reach the corrector.

## 🛑 Rollout blocker — stale title-word rows

The repository migration chain includes
`20260714180000_patch_rag_and_corrector_scalability.sql`, which originally backfilled
`document_title_words` from **all** indexed documents. `20260717171000` uses
`CREATE TABLE IF NOT EXISTS` and a public-only `INSERT ... ON CONFLICT DO NOTHING`; it
does not remove private or non-indexed rows already in that table. Because the final
corrector reads every `document_title_words.word`, applying the chain as written can
reintroduce private-title vocabulary into the `SECURITY DEFINER` result.

Do **not** authorize a linked/live apply that includes `20260717171000` until all of
the following are true:

1. A separately reviewed forward migration is present in the pending chain and deletes
   every `document_title_words` row whose joined document has `owner_id IS NOT NULL` or
   `status IS DISTINCT FROM 'indexed'` before corrector traffic is re-enabled.
2. If `20260717171000` and that cleanup will apply in the same rollout, keep corrector
   traffic disabled for the complete migration window so the intermediate unsafe state
   cannot serve requests.
3. The following invariant returns `0` after the cleanup and before traffic resumes:

   ```sql
   select count(*) as unsafe_title_word_rows
   from public.document_title_words as title_word
   join public.documents as source_document on source_document.id = title_word.document_id
   where source_document.owner_id is not null
      or source_document.status is distinct from 'indexed';
   ```

4. The cleanup migration, backup, lock plan, and verification output receive explicit
   production approval. Do not paste the `DELETE` ad hoc into production or repair the
   migration-history table.

If the cleanup migration is absent or the invariant is non-zero, **stop**. This runbook
records the blocker; it does not itself authorize or implement the database cleanup.

---

## Prerequisites

- The repo cloned locally, Node 24.x / npm 11.x.
- Your **production** secrets in `.env.local` (the same ones the live app uses):
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF=sjrfecxgysukkwxsowpy`,
  `SUPABASE_PROJECT_NAME=Clinical KB Database`, `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase CLI access: a login token (`npx supabase login`) and the project's
  **database password** (Supabase dashboard → Project Settings → Database).
- No dedicated install needed — `npx supabase …` fetches the CLI on first use.

There is **no CI/CD job** that auto-applies migrations to production; this is a
deliberate manual/operator action.

---

## Option A — from a terminal (recommended)

Use the terminal on your own computer: **Terminal** (macOS), **PowerShell** (Windows),
or the VS Code terminal — on the machine where the repo is cloned.

### 1. Go into the project

```bash
cd ~/path/to/Database   # replace with your clone path; `ls` should show supabase/ src/ package.json
```

### 2. Log in + link to production (one-time; safe to re-run)

```bash
npx supabase login                                        # opens a browser — approve
npx supabase link --project-ref sjrfecxgysukkwxsowpy      # may prompt for the DB password
```

### 3. 🛑 Safety gate — confirm you're on production, and see what's pending

```bash
npm run check:supabase-project        # must print: Clinical KB Database / sjrfecxgysukkwxsowpy
npx supabase migration list --linked  # review every local/remote row and its order
```

Confirm that any pending corrector entries use the exact filenames above, that
`…120000` precedes `…171000`, and that `…170000` is not skipped when it is pending.
It is valid for an earlier migration to already be recorded remotely. **Stop** if
`check:supabase-project` shows staging/another project, any pending migration has not
been reviewed and authorized as part of this rollout, or local/remote history looks
divergent (see `docs/supabase-migration-reconciliation.md`). Also stop if the
stale-title-word cleanup described above is missing from the reviewed pending chain.

Optional — before applying, `npm run check:drift` can identify repository/live schema
differences. Treat its output as evidence to review, not proof that the corrector is the
only pending change.

### 4. Apply

```bash
npx supabase db push        # applies every pending migration; review the full list before confirming
```

### 5. Verify

```bash
npm run check:drift && npm run check:supabase-project
# check:drift must now report: "No unexpected schema drift" (live matches the repo)
```

Optional functional proof:

```bash
npx supabase db query --linked "select pg_get_functiondef('public.correct_clinical_query_terms(text,real)'::regprocedure) ilike '%owner_id is null%' as scoped;"
# expect: scoped = true
```

Also run the zero-unsafe-row invariant from the rollout-blocker section. Both checks
must pass before corrector traffic is enabled.

Optional (retrieval-affecting): `npm run eval:retrieval:quality` — must stay 36/36 (needs live keys).

---

## Option B — via the Codex app

Codex runs the commands for you, but **only if its environment has the production
Supabase credentials** (login token + DB password). If it doesn't, its read-only checks
in step 1 will fail — then use Option A instead.

Keep Codex's **"ask before running commands" / approval** setting ON. Start a task on
`BigSimmo/Database` and paste:

> Deploy the already-merged corrector migrations
> `supabase/migrations/20260717120000_corrector_public_titles_only.sql` and
> `supabase/migrations/20260717171000_public_title_corrector.sql`
> to the **live production** Supabase project **Clinical KB Database** (ref
> `sjrfecxgysukkwxsowpy`), using the repo's linked-migration workflow. This is a
> production clinical database — treat every step as confirmation-required and **pause
> for my explicit approval before applying anything**.
>
> 1. Run `npm run check:supabase-project` and show me the full output. Confirm it targets
>    `sjrfecxgysukkwxsowpy` (production), not staging. If it targets anything else, **stop**.
> 2. Run `npx supabase migration list --linked` and show me the output. Confirm local
>    and remote history are aligned; if pending, `20260717120000` must precede
>    `20260717170000`, which must precede `20260717171000`. Enumerate every other
>    pending migration. If any pending entry has not been reviewed for this rollout,
>    or history is divergent, **stop and ask me**.
> 3. Confirm a separately reviewed forward migration purges private/non-indexed
>    `document_title_words` rows. If it is absent, **stop**; do not apply `20260717171000`.
>    Keep corrector traffic disabled until that cleanup and its zero-row invariant pass.
> 4. If either command above fails because production credentials aren't configured in
>    this environment, **stop and tell me** — do not try to work around it.
> 5. **PAUSE and wait for me to reply "go" before applying anything.**
> 6. After I approve the exact list: run `npx supabase db push` to apply that reviewed
>    pending sequence. Stop if the CLI proposes a different list.
> 7. Verify: run the zero-unsafe-title-word invariant, `npm run check:drift` (must report
>    "No unexpected schema drift"), and `npm run check:supabase-project`. Show me all
>    outputs before corrector traffic is re-enabled.
>
> Do not run OpenAI, modify other code, or push commits. Only the steps above.

Your two decision points:

- After steps 1–4: reply **"go"** only if the project is `Clinical KB Database /
sjrfecxgysukkwxsowpy` and every pending migration, in order, is expected and
  authorized, including the forward title-word cleanup. Otherwise stop and review the
  output.
- After the push: ✅ unsafe title-word count = `0` and `check:drift` = "No unexpected
  schema drift" → done.

---

## Rollback

Do **not** restore the pre-`…120000` unscoped corrector: that would reopen the private
title/alias side channel. If the indexed `…171000` implementation must be backed out,
prepare and review a new forward migration that first restores the exact public-scoped
function definition from `20260717120000_corrector_public_titles_only.sql`, then removes
the title-word trigger/table/indexes only after dependency and lock review. Keep the
public-only predicate throughout, take the normal backup, and verify drift and the
function definition after the authorized apply. Never edit migration history or run an
ad hoc unscoped `CREATE OR REPLACE` in production.

## Why `check:drift` flips green after applying

When live is behind the repository, `main` carries the final corrector and related
objects in `schema.sql` plus the drift manifest. Applying the complete reviewed pending
sequence brings live into line; only then should the post-apply `check:drift` match the
manifest and report clean. A clean result does not replace the migration-history check.

## Related

- `docs/supabase-migration-reconciliation.md` — migration drift/repair policy
- `docs/operator-apply-july8-batch.md` — example operator apply runbook
- `docs/database-drift-detection.md` — how `check:drift` / the manifest work
- `docs/tenancy-defense-in-depth-review.md` — the owner-scoping model this fix aligns with
