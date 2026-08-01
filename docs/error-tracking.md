# Privacy-safe production error tracking

Production server exception tracking is an optional, provider-gated Sentry integration. It is inert unless `SENTRY_DSN` is configured. Browser telemetry and session replay are not enabled — there is no client Sentry bundle path. Structured server/edge **Logs** are available under the privacy rules below. Runtime init is owned by `src/sentry.{server,edge}.config.ts` (loaded once from Next server/edge instrumentation); do not add a second `Sentry.init()` path or a browser SDK import.

## Data envelope

### Errors

The application sends only an error type, scrubbed code stack-frame locations, the static Next.js route pattern, route/router type, release/environment identifiers, and an event identifier. Before export it discards exception messages, requested URLs and query strings, headers, cookies, bodies, users, breadcrumbs, arbitrary context, local variables, prompts, clinical queries, answers, and document content. Do not add those fields to the allowlist. The same `privacySafeErrorEvent` scrubber runs on server and edge `beforeSend` hooks.

The static route pattern (for example `/api/documents/[id]`) is safe operational metadata; the actual request path is deliberately ignored. Error grouping uses the route pattern, a fixed JavaScript runtime error type, and scrubbed code-frame location. Custom error names are treated as untrusted free-form text and collapse to `Error`; grouping never uses an owner, patient, query, document, or request identifier.

### Performance traces (DB query visibility)

Server/edge tracing is enabled at a low default sample rate (`tracesSampleRate` defaults to `0.1`; override with `SENTRY_TRACES_SAMPLE_RATE`, or set `0` to disable). The Supabase JS integration (Node server only — `src/lib/observability/supabase-tracing.ts`) instruments PostgREST operations so Sentry's Queries dashboard can show slowest tables/operations. Integration and admin-client instrumentation stay inert unless `SENTRY_DSN` is set and the resolved sample rate is greater than zero.

Privacy constraints for traces:

- `sendOperationData` / `dataCollection.databaseQueryData` stay **false** — PostgREST filter values and mutation bodies are never attached as `db.query` / `db.body`.
- Span descriptions are rewritten to `select from(<table>)` (operation + table only) by `privacySafeTransactionEvent` before export.
- Allowed span attributes: `db.table`, `db.schema`, `db.system`, `db.operation`, `db.sdk`, `http.status_code`, and Sentry op/origin metadata.
- Breadcrumbs remain disabled (`maxBreadcrumbs: 0`). Request URLs, users, and free-form context are stripped from transactions the same way as errors.

View samples in Sentry under **Explore → Traces**, and aggregated DB performance under **Dashboards → Sentry Built → Queries**.

### AI agent monitoring (OpenAI spans)

The OpenAI client is wrapped by `src/lib/observability/agent-monitoring.ts` (`Sentry.instrumentOpenAiClient`, SDK ≥ 10.67) so Sentry's AI/agents views show per-call operation, model, latency, and token usage. The wrap is inert unless `SENTRY_DSN` is set, the resolved traces sample rate is greater than zero, **and** the runtime actually initialized Sentry — so it is always a no-op in the ingestion worker and in tests, which import the module but never run `Sentry.init()`.

Privacy constraints for agent monitoring:

- `recordInputs` / `recordOutputs` are **false** on the wrap and `dataCollection.genAI` is `{ inputs: false, outputs: false }` in both runtime configs — prompts, clinical queries, source evidence, generated answers, and embedding inputs are never recorded.
- `privacySafeTransactionEvent` allowlists only gen_ai metadata attributes (system, operation name, request/response model, response id, finish reasons, token usage, conversation id) and rebuilds gen_ai span descriptions as `<operation> <model>` from those attributes. Message, prompt, tool-payload, and embedding-input attributes are stripped on export even if a future SDK version records them.
- Each answer / stream / document-summarize request calls `Sentry.setConversationId(<interactionId>)` **before** OpenAI work — the request's synthetic UUID — so the embedding/generation calls of one request group into one conversation without carrying any query text.
- User identification (`Sentry.setUser`) is deliberately **not** wired: the committed privacy boundary strips `user` from every outgoing event (see the tests), and linking clinical-query telemetry to an identity would need its own governance review first.
- `responses.parse` (schema-parsed generation) is not in the SDK's instrumentation registry and emits no gen_ai span; `responses.create` and `embeddings.create` are covered.

Rollback matches tracing: set `SENTRY_TRACES_SAMPLE_RATE=0` (agent spans stop; error capture stays) or remove `SENTRY_DSN`. Raising the sample rate above the 0.1 default captures a larger share of answer requests in the agents view and is an operator decision.

### Sentry “Agent Monitoring” wizard mapping

The product wizard’s copy is generic. Map it to this repo as follows — do **not** paste the wizard’s sample code:

| Wizard step                      | This repo                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install `@sentry/nextjs` ≥ 10.67 | npm dependency (`^10.67.0`, lock ≥ 10.67); do not switch to pnpm                                                                                                         |
| `Sentry.init` + tracing          | `src/sentry.server.config.ts` / `src/sentry.edge.config.ts`; DSN from `SENTRY_DSN` only (never hardcode); default `tracesSampleRate` 0.1 via `SENTRY_TRACES_SAMPLE_RATE` |
| `dataCollection.genAI`           | Explicitly `{ inputs: false, outputs: false }`                                                                                                                           |
| `instrumentOpenAiClient`         | `instrumentOpenAIClientForAgentMonitoring` in `createOpenAIClient()` — `recordInputs`/`recordOutputs` **false**                                                          |
| `setConversationId`              | `setAgentConversationId(interactionId)` on `/api/answer`, `/api/answer/stream`, and `/api/documents/[id]/summarize`                                                      |
| `setUser` (optional)             | **Rejected** — scrubbers strip `user`; do not wire                                                                                                                       |

Leaving wizard checkboxes for “record inputs/outputs” or “identify users” unchecked is expected and correct for this clinical app.

### Structured logs (Sentry Logs)

Server/edge `enableLogs` turns on when `SENTRY_DSN` is set (disable with `SENTRY_ENABLE_LOGS=false`). There is still no browser logging path and no `consoleLoggingIntegration` — console output is too easy to leak clinical text.

Privacy constraints for logs:

- Emit only through `sentryLog` / the app `logger` bridge in `src/lib/observability/sentry-logging.ts`.
- Prefer **wide events**: a static allowlisted message plus structured attributes (`bucket`, `code`, `status`, `retry_after_seconds`, …). Never interpolate queries, answers, prompts, document text, emails, or owner ids into the message.
- `beforeSendLog` → `privacySafeLog` is fail-closed: drops `trace`/`debug`, unknown messages, and non-allowlisted attributes.
- The Node runtime registers `forwardAppLogToSentry` after init so existing `logger.warn` / `logger.error` calls reach Sentry with the same scrubber (unknown messages collapse to `Application warn` / `Application error`).

Examples already wired:

- Rate-limit denials and durable-limiter fallbacks in `src/lib/api-rate-limit.ts` (`API rate limited`, fallback messages).
- API failures via `jsonError` → `logger.error("API request failed", …)` (bridged).
- Upload cleanup warnings via the existing logger messages (allowlisted).

#### Sentry Logs wizard mapping

| Wizard step                                                                            | This repo                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm install @sentry/nextjs` (min `9.41.0`)                                            | `@sentry/nextjs@^10.69.0` (installed `10.69.0`)                                |
| Hardcoded `dsn: "https://…@….ingest…"`                                                 | Env-only `SENTRY_DSN` — never commit a DSN                                     |
| `enableLogs: true`                                                                     | `enableLogs: isSentryLoggingEnabled()` in `src/sentry.{server,edge}.config.ts` |
| `consoleLoggingIntegration({ levels: ["log","warn","error"] })`                        | **Not enabled** — too leaky for clinical text; use `sentryLog` / logger bridge |
| Verify: `Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })` | `sendSentryTestLog()` after Node init when `SENTRY_SEND_TEST_LOG=true`         |

View samples in Sentry under **Explore → Logs**. Set `SENTRY_ENABLE_LOGS=false` to roll logs back without removing the DSN. For a one-shot wizard verify, set `SENTRY_SEND_TEST_LOG=true`, restart once, confirm the log, then unset the flag.

## Operator approval and rollout

Before setting `SENTRY_DSN`, the operator must approve the vendor/project, data region, retention period, access roles, sampling rate, cost budget, and alert destination. Configure a server-side DSN only; never use a `NEXT_PUBLIC_*` DSN. Keep provider-side IP/user enrichment disabled and restrict project access. Start with a non-production synthetic exception and inspect the received event before enabling production alerts.

When enabling tracing, also review a sampled transaction in Sentry and confirm span descriptions contain only table/operation metadata (no filter literals, clinical text, or mutation payloads). Set `SENTRY_TRACES_SAMPLE_RATE=0` to roll tracing back without removing the DSN.

When enabling logs, inspect a sample in **Explore → Logs** and confirm bodies are allowlisted static strings with only operational attributes. Set `SENTRY_ENABLE_LOGS=false` to disable logs without removing the DSN.

No source-map upload is configured: builds do not contact Sentry and do not require a Sentry auth token. This reduces provider coupling, at the cost of less useful minified production frames. Reconsider source maps only through a separate privacy and build-provider review.

## Disable and rollback

Remove `SENTRY_DSN` and restart the service. The tracker then makes no provider calls. To disable only performance tracing while keeping error capture, set `SENTRY_TRACES_SAMPLE_RATE=0` and restart. To disable only structured logs while keeping errors/traces, set `SENTRY_ENABLE_LOGS=false` and restart. Provider-side deletion and retention remain operator responsibilities under the approved Sentry project policy.
