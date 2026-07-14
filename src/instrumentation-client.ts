// Runs on the client after the HTML loads but before React hydration (see
// node_modules/next/dist/docs/.../instrumentation-client.md), so this preempts
// the first client-side Zod schema compile.
//
// Why: the production CSP (src/lib/security-headers.ts) has no 'unsafe-eval'.
// Zod 4's JIT compiler probes for eval with `new Function("")` inside a try/catch
// (node_modules/zod/src/v4/core/util.ts) — the throw is swallowed and validation
// still works, but the browser reports the caught eval as a
// `securitypolicyviolation` on every page. Disabling JIT skips the probe entirely
// (validation stays correct, just interpreted rather than compiled). The server
// has no CSP, so it keeps the faster JIT path — this is client-only by design.
import { config } from "zod";
import { registerSentryClient } from "@/lib/observability/sentry-client";

config({ jitless: true });

// Gated browser error tracking, the client counterpart to the server-side
// @sentry/node capture in src/instrumentation.ts. `__SENTRY_ENABLED__` is a
// build-time literal boolean injected by DefinePlugin (next.config.ts) — true only
// when a public DSN is set at build. As a real compile-time constant it lets the
// webpack production build dead-code-eliminate this whole block (and the entire
// @sentry/browser chunk) when false, so an unconfigured build ships ZERO Sentry
// bytes. The `typeof` guard keeps it safe under the Turbopack dev server, which
// does not run the webpack DefinePlugin and so leaves the identifier undefined.
// Events go through the same-origin tunnel (/api/monitoring) so the strict
// clinical CSP (connect-src 'self' …) needs no Sentry ingest host.
declare const __SENTRY_ENABLED__: boolean;

if (typeof __SENTRY_ENABLED__ !== "undefined" && __SENTRY_ENABLED__) {
  void (async () => {
    const [Sentry, { scrubClientSentryEvent }] = await Promise.all([
      import("@sentry/browser"),
      import("@/lib/observability/sentry-scrub"),
    ]);
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tunnel: "/api/monitoring",
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      // Errors only: no performance tracing (avoids shipping navigation-timing/PII).
      tracesSampleRate: 0,
      sendDefaultPii: false,
      // Same privacy boundary as the server init: strip request + breadcrumbs, and
      // never record breadcrumbs in the first place.
      beforeSend: scrubClientSentryEvent,
      beforeBreadcrumb: () => null,
    });
    registerSentryClient(Sentry);
  })().catch(() => {
    // Loading/initializing the SDK is best-effort observability; a failed dynamic
    // import (e.g. blocked chunk) must never surface as an unhandled rejection.
  });
}
