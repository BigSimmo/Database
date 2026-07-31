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
import * as Sentry from "@sentry/nextjs";
import { sentryPrivacyHooks } from "@/lib/sentry-scrubber";

config({ jitless: true });

// Inert until NEXT_PUBLIC_SENTRY_DSN is configured — see src/sentry.server.config.ts
// for the dataCollection/privacy rationale (omitted here for the same reason:
// sendDefaultPii stays false). Session Replay and Logs are separate signals,
// deliberately not enabled by this baseline setup. Events tunnel through the
// app's own /monitoring route (see next.config.ts) rather than calling
// *.sentry.io directly, so CSP connect-src does not need to widen beyond 'self'.
// Fail-closed beforeSend / beforeSendTransaction / beforeBreadcrumb live in
// sentryPrivacyHooks so clinical query text never leaves once a DSN is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  ...sentryPrivacyHooks,
});

// Hook into App Router navigation transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
