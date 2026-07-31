import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent, scrubSentryTransaction } from "@/lib/observability/sentry-scrub";

// Loaded from src/instrumentation.ts only when SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  // Errors + tracing (SDK recommended baseline). Scrubbers strip request/query PII.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Do NOT enable includeLocalVariables — locals can hold clinical query text.
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryTransaction,
  beforeBreadcrumb() {
    return null;
  },
});
