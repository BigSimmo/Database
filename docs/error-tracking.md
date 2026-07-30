# Privacy-safe production error tracking

Production server exception tracking is an optional, provider-gated Sentry integration. It is inert unless `SENTRY_DSN` is configured and the process is the production Node.js runtime. Browser telemetry, performance tracing, logs, and session replay are not enabled.

## Data envelope

The application sends only an error type, scrubbed code stack-frame locations, the static Next.js route pattern, route/router type, release/environment identifiers, and an event identifier. Before export it discards exception messages, requested URLs and query strings, headers, cookies, bodies, users, breadcrumbs, arbitrary context, local variables, prompts, clinical queries, answers, and document content. Do not add those fields to the allowlist.

The static route pattern (for example `/api/documents/[id]`) is safe operational metadata; the actual request path is deliberately ignored. Error grouping uses the route pattern, a fixed JavaScript runtime error type, and scrubbed code-frame location. Custom error names are treated as untrusted free-form text and collapse to `Error`; grouping never uses an owner, patient, query, document, or request identifier.

## Operator approval and rollout

Before setting `SENTRY_DSN`, the operator must approve the vendor/project, data region, retention period, access roles, sampling/cost envelope, and alert destination. Configure a server-side DSN only; never use a `NEXT_PUBLIC_*` DSN. Keep provider-side IP/user enrichment disabled and restrict project access. Start with a non-production synthetic exception and inspect the received event before enabling production alerts.

No source-map upload is configured: builds do not contact Sentry and do not require a Sentry auth token. This reduces provider coupling, at the cost of less useful minified production frames. Reconsider source maps only through a separate privacy and build-provider review.

## Disable and rollback

Remove `SENTRY_DSN` and restart the service. The tracker then makes no provider calls. Provider-side deletion and retention remain operator responsibilities under the approved Sentry project policy.
