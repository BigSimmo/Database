# Privacy-safe production error tracking

Production server exception tracking is an optional, provider-gated Sentry integration. It is inert unless `SENTRY_DSN` is configured. Browser telemetry, logs, and session replay are not enabled — there is no client Sentry bundle path. Runtime init is owned by `src/sentry.{server,edge}.config.ts` (loaded once from Next server/edge instrumentation); do not add a second `Sentry.init()` path or a browser SDK import.

## Data envelope

### Errors

The application sends only an error type, scrubbed code stack-frame locations, the static Next.js route pattern, route/router type, release/environment identifiers, and an event identifier. Before export it discards exception messages, requested URLs and query strings, headers, cookies, bodies, users, breadcrumbs, arbitrary context, local variables, prompts, clinical queries, answers, and document content. Do not add those fields to the allowlist. The same `privacySafeErrorEvent` scrubber runs on server and edge `beforeSend` hooks.

The static route pattern (for example `/api/documents/[id]`) is safe operational metadata; the actual request path is deliberately ignored. Error grouping uses the route pattern, a fixed JavaScript runtime error type, and scrubbed code-frame location. Custom error names are treated as untrusted free-form text and collapse to `Error`; grouping never uses an owner, patient, query, document, or request identifier.

### Performance traces (DB query visibility)

Server/edge tracing is enabled at a low default sample rate (`tracesSampleRate` defaults to `0.1`; override with `SENTRY_TRACES_SAMPLE_RATE`, or set `0` to disable). The Supabase JS integration instruments PostgREST operations so Sentry's Queries dashboard can show slowest tables/operations.

Privacy constraints for traces:

- `sendOperationData` / `dataCollection.databaseQueryData` stay **false** — PostgREST filter values and mutation bodies are never attached as `db.query` / `db.body`.
- Span descriptions are rewritten to `select from(<table>)` (operation + table only) by `privacySafeTransactionEvent` before export.
- Allowed span attributes: `db.table`, `db.schema`, `db.system`, `db.operation`, `db.sdk`, `http.status_code`, and Sentry op/origin metadata.
- Breadcrumbs remain disabled (`maxBreadcrumbs: 0`). Request URLs, users, and free-form context are stripped from transactions the same way as errors.

View samples in Sentry under **Explore → Traces**, and aggregated DB performance under **Dashboards → Sentry Built → Queries**.

## Operator approval and rollout

Before setting `SENTRY_DSN`, the operator must approve the vendor/project, data region, retention period, access roles, sampling rate, cost budget, and alert destination. Configure a server-side DSN only; never use a `NEXT_PUBLIC_*` DSN. Keep provider-side IP/user enrichment disabled and restrict project access. Start with a non-production synthetic exception and inspect the received event before enabling production alerts.

When enabling tracing, also review a sampled transaction in Sentry and confirm span descriptions contain only table/operation metadata (no filter literals, clinical text, or mutation payloads). Set `SENTRY_TRACES_SAMPLE_RATE=0` to roll tracing back without removing the DSN.

No source-map upload is configured: builds do not contact Sentry and do not require a Sentry auth token. This reduces provider coupling, at the cost of less useful minified production frames. Reconsider source maps only through a separate privacy and build-provider review.

## Disable and rollback

Remove `SENTRY_DSN` and restart the service. The tracker then makes no provider calls. To disable only performance tracing while keeping error capture, set `SENTRY_TRACES_SAMPLE_RATE=0` and restart. Provider-side deletion and retention remain operator responsibilities under the approved Sentry project policy.
