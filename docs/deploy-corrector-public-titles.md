# Deploy runbook — public-titles corrector migration (F10)

Applies migration `supabase/migrations/20260717120000_corrector_public_titles_only.sql`
to the live **Clinical KB Database** project (`sjrfecxgysukkwxsowpy`).

**What it does:** scopes `public.correct_clinical_query_terms` (the clinical query-term
corrector) so its spell-correction vocabulary is built only from the **public
(null-owner) corpus** — both `rag_aliases` reads and the document-title scan. This
closes a cross-tenant side-channel where a `SECURITY DEFINER` read leaked private
documents' title/alias tokens into other tenants' query corrections.

**Risk:** low and reversible. It is a `CREATE OR REPLACE FUNCTION` (+ `revoke`/`grant`) —
no data migration, no index build, no locks, signature unchanged. Validated on a
Supabase preview branch and by `npm run drift:manifest` (real Postgres replay).

**Status when this runbook was written:** the code side is fully merged to `main` —
migration (#697), plus `schema.sql` mirror + regenerated `drift-manifest.json` (#701).
The **only remaining step is applying the migration to the live project** (this step).

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
npx supabase migration list --linked  # 20260717120000_corrector_public_titles_only must be the pending one
```

**Stop** if `check:supabase-project` shows staging/another project, if unexpected
migrations are pending, or if local/remote history looks divergent
(see `docs/supabase-migration-reconciliation.md`).

Optional — before applying, `npm run check:drift` will report the corrector as the
pending difference (manifest scoped, live still unscoped). That is expected and is what
the push clears.

### 4. Apply

```bash
npx supabase db push        # review the listed migration, confirm with `y`
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

Optional (retrieval-affecting): `npm run eval:retrieval:quality` — must stay 36/36 (needs live keys).

---

## Option B — via the Codex app

Codex runs the commands for you, but **only if its environment has the production
Supabase credentials** (login token + DB password). If it doesn't, its read-only checks
in step 1 will fail — then use Option A instead.

Keep Codex's **"ask before running commands" / approval** setting ON. Start a task on
`BigSimmo/Database` and paste:

> Deploy the already-merged migration `supabase/migrations/20260717120000_corrector_public_titles_only.sql`
> to the **live production** Supabase project **Clinical KB Database** (ref
> `sjrfecxgysukkwxsowpy`), using the repo's linked-migration workflow. This is a
> production clinical database — treat every step as confirmation-required and **pause
> for my explicit approval before applying anything**.
>
> 1. Run `npm run check:supabase-project` and show me the full output. Confirm it targets
>    `sjrfecxgysukkwxsowpy` (production), not staging. If it targets anything else, **stop**.
> 2. Run `npx supabase migration list --linked` and show me the output. Confirm
>    `20260717120000_corrector_public_titles_only` is pending and local/remote history is
>    aligned. If any other unexpected migration is pending, or history is divergent,
>    **stop and ask me**.
> 3. If either command above fails because production credentials aren't configured in
>    this environment, **stop and tell me** — do not try to work around it.
> 4. **PAUSE and wait for me to reply "go" before applying anything.**
> 5. After I say go: run `npx supabase db push` to apply the pending migration.
> 6. Verify: run `npm run check:drift` (must report "No unexpected schema drift") and
>    `npm run check:supabase-project`. Show me both outputs.
>
> Do not run OpenAI, modify other code, or push commits. Only the steps above.

Your two decision points:

- After steps 1–2: reply **"go"** only if the project is `Clinical KB Database /
sjrfecxgysukkwxsowpy` and the sole pending migration is this one. Otherwise stop and
  review the output.
- After the push: ✅ `check:drift` = "No unexpected schema drift" → done.

---

## Rollback

Not expected — the scoped version is strictly safer and signature-compatible. If ever
needed, `CREATE OR REPLACE` the prior (unscoped) definition and regenerate the manifest;
but there is no functional reason to revert.

## Why `check:drift` flips green after applying

Before the deploy, `main` carries the scoped corrector in `schema.sql` + the drift
manifest, while live still runs the unscoped version — so `check:drift` reports the
corrector as pending. `supabase db push` brings live into line, so the post-apply
`check:drift` matches the manifest and reports clean.

## Related

- `docs/supabase-migration-reconciliation.md` — migration drift/repair policy
- `docs/operator-apply-july8-batch.md` — example operator apply runbook
- `docs/database-drift-detection.md` — how `check:drift` / the manifest work
- `docs/tenancy-defense-in-depth-review.md` — the owner-scoping model this fix aligns with
