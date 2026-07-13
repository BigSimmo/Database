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

// Gated browser error tracking. `__SENTRY_ENABLED__` is a build-time literal
// boolean injected by DefinePlugin (next.config.ts) — true only when a public DSN
// is set at build. Because it is a real compile-time constant, the webpack
// production build dead-code-eliminates this whole block when it is false, so the
// dynamic import (and the entire Sentry SDK chunk) is never emitted: ZERO bytes
// shipped until configured. The `typeof` guard keeps this safe under the Turbopack
// dev server, which does NOT run the webpack DefinePlugin and so leaves the
// identifier undefined (a plain reference would throw). Events go through the
// same-origin tunnel (/api/monitoring) so the strict clinical CSP needs no Sentry
// ingest host.
declare const __SENTRY_ENABLED__: boolean;

let forwardRouterTransition: ((href: string, navigationType: string) => void) | undefined;

if (typeof __SENTRY_ENABLED__ !== "undefined" && __SENTRY_ENABLED__) {
  void (async () => {
    const [Sentry, { scrubSentryErrorEvent }] = await Promise.all([
      import("@sentry/nextjs"),
      import("@/lib/observability/sentry-scrub"),
    ]);
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tunnel: "/api/monitoring",
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      // Errors are the priority; performance tracing defaults off to keep the
      // client light and avoid shipping navigation-timing PII. Opt in later.
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0) || 0,
      sendDefaultPii: false,
      beforeSend: scrubSentryErrorEvent,
    });
    registerSentryClient(Sentry);
    forwardRouterTransition = Sentry.captureRouterTransitionStart;
  })();
}

// Next calls this on client-side navigations. It stays a no-op until the gated
// SDK above has loaded and wired the real handler.
export function onRouterTransitionStart(href: string, navigationType: string): void {
  forwardRouterTransition?.(href, navigationType);
}
