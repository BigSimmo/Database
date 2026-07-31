import * as Sentry from "@sentry/nextjs";
import { sentryPrivacyHooks } from "@/lib/sentry-scrubber";

// Edge runtime init (src/proxy.ts and any edge route handlers), loaded from
// src/instrumentation.ts's register() when NEXT_RUNTIME === "edge". Inert
// until SENTRY_DSN is configured — see src/sentry.server.config.ts for the
// dataCollection/privacy rationale, which applies here too. Shares the same
// fail-closed scrubber hooks as the Node and browser inits.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  ...sentryPrivacyHooks,
});
