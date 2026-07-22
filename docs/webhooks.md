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

- **INSERT** of a not-yet-`indexed` document → enqueue. The app upload route also
  enqueues, but the `ingestion_jobs` one-open-job-per-document unique index makes
  the duplicate insert a benign no-op (`already_active`).
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

**4. Create the fail-safe trigger.** It fires only on the transitions the receiver
acts on, reads the secret from Vault, and — critically — never aborts a document
write if the secret is missing or the POST fails (it just does nothing, mirroring
the receiver's inert `503`). `net.http_post` is asynchronous, so it does not block
the write.

> **Delivery is at-most-once.** `net.http_post` is fire-and-forget — it returns a
> request id and does not retry on failure. So if the app is down, the secret is
> mismatched, or the receiver 500s _before_ enqueueing, that single event is lost.
> The receiver's "500 → provider retries" guarantee (§ above) is a property of a
> **managed Supabase Database Webhook** (which has built-in retry), _not_ of this
> raw trigger. The durability backstop for a missed event is the polling recovery
> path (`hasIncompleteDocumentsWithoutOpenJobs` → `ingestion-recovery`, driven by
> the Ingestion Autopilot) — but note that autopilot currently runs read-only
> unless `INGESTION_AUTOPILOT_APPLY=true`. **If you need at-least-once delivery for
> inserts made outside the app upload path, use the managed Database Webhook
> (below) instead of this trigger, or enable the recovery apply path as the
> backstop.** This trigger is a low-latency optimisation on top of that recovery
> layer, not a replacement for it.

```sql
create or replace function public.notify_document_change_ingestion_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_secret     text;
  v_base_url   text;
  v_actionable boolean := false;
begin
  -- Match the receiver's policy so we never POST an event it would just skip:
  --   * INSERT of a not-yet-indexed document, or
  --   * an UPDATE where metadata.reindex_requested transitions to true.
  if tg_op = 'INSERT' then
    v_actionable := coalesce(new.status, '') is distinct from 'indexed';
  elsif tg_op = 'UPDATE' then
    v_actionable := coalesce((new.metadata->>'reindex_requested')::boolean, false)
                    and not coalesce((old.metadata->>'reindex_requested')::boolean, false);
  end if;

  if not v_actionable then
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
create trigger documents_ingestion_webhook
  after insert or update on public.documents
  for each row execute function public.notify_document_change_ingestion_webhook();
```

To request a reindex of an existing document, set
`metadata.reindex_requested = true` on its row; the trigger POSTs, the receiver
enqueues the job and clears the flag.

**Managed alternative (recommended for durability).** A Supabase **Database
Webhook** on `public.documents` (INSERT/UPDATE) pointed at the URL above with an
`Authorization: Bearer <secret>` header has **built-in delivery retry**, so it —
not the raw trigger — is the right choice when a missed event must not be dropped.
Its trade-off is that it fires on _every_ update (the receiver then skips the
non-actionable ones), whereas the SQL trigger above avoids that per-write POST
churn by gating in SQL. It is still a committed migration only insofar as any
schema object it adds must be reconciled the same way; the dashboard-created
webhook itself is operator/live state and should be recorded in the drift
allowlist if it appears in the inventory.
