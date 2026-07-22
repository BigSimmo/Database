# Webhooks

This repo ships three webhook integrations. Two are inbound receivers under
`src/app/api/webhooks/`; one is an outbound GitHub Actions notifier. All three
share the same optional chat destinations.

| #   | Integration                          | Direction | Entry point                                   |
| --- | ------------------------------------ | --------- | --------------------------------------------- |
| 1   | Railway deploy → chat                | inbound   | `POST /api/webhooks/railway`                  |
| 2   | GitHub CI failure → chat             | outbound  | `.github/workflows/notify-ci-failure.yml`     |
| 3   | Supabase document change → ingestion | inbound   | `POST /api/webhooks/supabase/document-change` |

## Chat destinations (shared)

Set either, both, or neither. A receiver with no destination configured still
accepts the event and reports it as undelivered.

- `SLACK_WEBHOOK_URL` — a Slack incoming webhook (`{ "text": … }`).
- `DISCORD_WEBHOOK_URL` — a Discord webhook (`{ "content": … }`).

The GitHub workflow reads these from repository **secrets** of the same name; the
inbound receivers read them from server env (`src/lib/env.ts`).

Store every secret below in Railway/GitHub secret stores — never in the repo.

## 1. Railway deploy → chat

`POST /api/webhooks/railway` forwards notable Railway deploy status changes
(`SUCCESS`, `FAILED`, `CRASHED`, `REMOVED`) for the app + worker services to chat.
This reports the deploy outcome GitHub cannot see.

**Auth.** Railway lets you configure only a target URL (no custom headers or
signing), so the shared secret `RAILWAY_WEBHOOK_SECRET` (min 16 chars) travels as
a `?token=` query parameter and is compared constant-time. The receiver fails
closed (`503`) when the secret is unset and returns `401` on a bad token.

**Setup.** Railway → Project → Settings → Webhooks → add:

```
https://psychiatry.tools/api/webhooks/railway?token=<RAILWAY_WEBHOOK_SECRET>
```

Transient phases (`BUILDING`, `DEPLOYING`, `QUEUED`, …) are dropped to keep the
channel quiet; the receiver answers `200 { "skipped": true }` for them.

> Note: the receiver runs inside the app being deployed, so a notification about
> a deploy that takes the app fully down may not be delivered. Pair it with an
> external uptime monitor for hard-down detection.

## 2. GitHub CI failure → chat

`.github/workflows/notify-ci-failure.yml` triggers on `workflow_run: completed`
for the key workflows (CI, SAST, Secret Scan, PR Policy, and the scheduled
monitors) and pings chat when a run on `main` or `release/*` fails.

**Setup.** Add repository secrets `SLACK_WEBHOOK_URL` and/or `DISCORD_WEBHOOK_URL`.
No secret → the workflow logs "nothing to notify" and exits cleanly. It posts with
`curl` only (no external actions), so the pinned-action allowlist is not involved.

## 3. Supabase document change → ingestion

`POST /api/webhooks/supabase/document-change` turns the polling ingestion path
into an event-driven one: when a `public.documents` row is inserted outside the
app upload flow, or an existing row is flagged for reindex, the receiver enqueues
one `ingestion_jobs` row that the worker then claims.

**Auth.** Supabase Database Webhooks can send custom headers, so the shared secret
`SUPABASE_INGESTION_WEBHOOK_SECRET` (min 16 chars) is sent as
`Authorization: Bearer <secret>` (or `x-webhook-secret`) and compared
constant-time. Fails closed (`503`) when unset, `401` on a bad secret.

**When it enqueues (idempotent + loop-safe):**

- **INSERT** of a not-yet-`indexed` document → enqueue. Note this is what the
  _receiver_ does with an INSERT event; the **recommended trigger below does not
  send INSERT events** because the app upload route deletes its own just-created
  document if _its_ job insert loses the one-open-job race, so a webhook enqueue
  winning that race would break the upload. Drive external inserts through the
  `reindex_requested` flag instead (see Setup).
- **UPDATE** acts only when `record.metadata.reindex_requested === true`, then
  clears that flag via `apply_document_metadata_patch`. The worker's own
  completion writes (also UPDATEs) never carry the flag, so they cannot retrigger
  an endless loop. If the clear itself fails, the receiver responds `500` (not
  `2xx`) so Supabase retries delivery until the flag is actually cleared — the
  idempotent enqueue means a retry cannot double-queue.
- `checkIngestionMutationSafety` refuses while a job is already active, and the
  enqueue reports `already_active` instead of erroring on a lost race.

Every write is owner-scoped (`owner_id`) — the app's single tenancy layer, since
the service-role client bypasses RLS. Events without an `owner_id`, on other
tables, or of type `DELETE` are skipped with `200`.

### Setup (operator-applied)

The receiver is deployed but inert until a Supabase-side trigger actually calls
it. The trigger function/trigger below must ship as a **committed migration**, not
raw SQL applied to the live database — this repo's drift inventory
(`supabase/drift-manifest.json`) covers functions and triggers, so creating them
directly on live would diverge from `supabase/schema.sql` and **fail the next
`check:drift`**, and a schema restore would omit the webhook entirely. The only
operator-applied live state is the Vault secret (step 2) and the optional base-URL
GUC (step 3).

**Landing the trigger (step 4) needs a local Supabase container** — the schema
mirror + drift manifest are regenerated from a live replay, which cannot be done
offline:

- Add the SQL from step 4 as `supabase/migrations/<timestamp>_document_change_ingestion_webhook.sql`.
- Reconcile it into `supabase/schema.sql` (the checker `check:function-grants`
  reads the snapshot, and the `revoke execute … from public` below must appear there).
- Regenerate the drift manifest with `npm run drift:manifest`, then apply the
  migration to the live project through the normal deploy path.

**1. Set the app env var** — `SUPABASE_INGESTION_WEBHOOK_SECRET` (min 16 chars) on
the Railway `Database` + `worker` services.

**2. Store the same secret in Supabase Vault** so the trigger can read it without
hardcoding it:

```sql
select vault.create_secret('<same-secret-as-the-env-var>', 'ingestion_webhook_secret');
```

**3. (Non-production only) point the base URL at your environment** — production
falls back to `https://psychiatry.tools` when this GUC is unset:

```sql
alter database postgres set app.ingestion_webhook_base_url = 'https://<env-host>';
```

**4. Create the fail-safe trigger.** It fires only on an explicit
`reindex_requested` flip (an `AFTER UPDATE` trigger — **not** `INSERT`, to avoid
racing the app upload route; see the comment in the function), reads the secret
from Vault, and — critically — never aborts a document write if the secret is
missing or the POST fails (it just does nothing, mirroring the receiver's inert
`503`). `net.http_post` is asynchronous, so it does not block the write.

> **Delivery is at-most-once.** `net.http_post` is fire-and-forget — it returns a
> request id and does not retry on failure ([pg_net retries are still an open
> feature request](https://github.com/supabase/pg_net/issues/110)). So if the app
> is down, the secret is mismatched, or the receiver 500s _before_ enqueueing,
> that single event is lost. The receiver's "500 → provider retries" wording only
> holds against a caller that actually retries — **do not assume either the raw
> trigger _or_ a managed Supabase Database Webhook provides that**: managed
> webhooks are themselves a thin wrapper over pg_net, so they share the same
> no-retry limitation today.
>
> **There is no _automatic_ recovery for a dropped delivery.** A fresh insert
> lands as `status = 'queued'` with no `ingestion_jobs` row, but the scheduled
> Ingestion Autopilot's health check (`assessIngestionHealth`) only flags _failed_
> or _stale-processing_ jobs — it never looks at queued documents that have no job
> — so it reports healthy and never enqueues them, even with
> `INGESTION_AUTOPILOT_APPLY=true`. The predicate that _does_ detect this case,
> `hasIncompleteDocumentsWithoutOpenJobs`, is wired only into the **manual**
> `scripts/reindex.ts` CLI, so recovery of a dropped-webhook insert is an operator
> running that command on demand, not something that self-heals.
>
> **So for a document inserted outside the app upload path that must never be
> dropped, do not rely on webhook delivery at all** — ingest it through the app
> upload route (which enqueues its job transactionally), or add a transactional
> outbox / a scheduled sweep that enqueues `queued`/`reindex_requested` rows with
> no open job. This trigger is a low-latency optimisation, not a delivery
> guarantee.

```sql
create or replace function public.notify_document_change_ingestion_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_secret   text;
  v_base_url text;
begin
  -- Fire ONLY on an explicit reindex request (metadata.reindex_requested flips to
  -- true). The INSERT case is deliberately NOT handled here: the app upload route
  -- inserts the document and then its own ingestion job in the same request, and
  -- it DELETES the document if that job insert loses a race against the one-open-
  -- job-per-document unique index (src/app/api/upload/route.ts). A webhook firing
  -- on INSERT could win that race and turn a normal upload into an intermittent
  -- failure. Documents inserted outside the upload flow should set
  -- metadata.reindex_requested = true (which also drives the loop-safe flag-clear).
  --
  -- Compare the JSON value directly to the JSON boolean `true` — matches the
  -- receiver's strict `=== true` (a JSON string "true" is NOT actionable) and,
  -- unlike `->> ... ::boolean`, never raises on a malformed value.
  if new.metadata->'reindex_requested' = 'true'::jsonb
     and new.metadata->'reindex_requested' is distinct from old.metadata->'reindex_requested'
  then
    -- actionable
  else
    return new;
  end if;

  -- Fail SAFE: with no Vault secret the trigger no-ops rather than break the write.
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'ingestion_webhook_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    return new;
  end if;

  v_base_url := coalesce(
    nullif(current_setting('app.ingestion_webhook_base_url', true), ''),
    'https://psychiatry.tools'
  );

  perform net.http_post(
    url := v_base_url || '/api/webhooks/supabase/document-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- A notification failure must never abort the document write.
    raise warning 'notify_document_change_ingestion_webhook failed: %', sqlerrm;
    return new;
end;
$$;

-- SECURITY DEFINER hardening: never callable directly by clients.
revoke execute on function public.notify_document_change_ingestion_webhook() from public, anon, authenticated;

drop trigger if exists documents_ingestion_webhook on public.documents;
-- UPDATE only, by design — see the INSERT-race comment in the function above.
create trigger documents_ingestion_webhook
  after update on public.documents
  for each row execute function public.notify_document_change_ingestion_webhook();
```

To request a reindex of an existing document, set
`metadata.reindex_requested = true` on its row; the trigger POSTs, the receiver
enqueues the job and clears the flag.

**Managed alternative (dashboard convenience).** A Supabase **Database Webhook**
on `public.documents` (INSERT/UPDATE) pointed at the URL above with an
`Authorization: Bearer <secret>` header avoids writing the trigger SQL yourself.
Its only real advantage over the committed migration is convenience — it does
**not** buy you at-least-once delivery (it wraps pg_net, same no-retry limitation
as the raw trigger; see the note above). **Scope it to `UPDATE` only** — a managed
webhook on `INSERT` re-introduces exactly the upload-race the SQL trigger avoids
(the upload route deletes its document if a webhook enqueue beats its own job
insert). Its other trade-offs: it fires on _every_ update (the receiver then skips
the non-actionable ones, versus the SQL gating above), and the dashboard-created
object is operator/live state that must be recorded in
`supabase/drift-allowlist.json` if it appears in the drift inventory. It adds
**no** delivery guarantee — see the at-most-once note above for why neither path
self-heals a dropped insert.
