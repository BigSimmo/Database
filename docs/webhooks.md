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

**Setup (Supabase).** Create a Database Webhook (or SQL trigger via
`supabase_functions.http_request`) on `public.documents` for INSERT/UPDATE with:

- URL: `https://psychiatry.tools/api/webhooks/supabase/document-change`
- HTTP header: `Authorization: Bearer <SUPABASE_INGESTION_WEBHOOK_SECRET>`

To request a reindex of an existing document, set
`metadata.reindex_requested = true` on its row; the receiver enqueues the job and
clears the flag.
