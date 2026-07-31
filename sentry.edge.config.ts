import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent, scrubSentryTransaction } from "@/lib/observability/sentry-scrub";

// Loaded from src/instrumentation.ts only when SENTRY_DSN is set (Edge runtime).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryTransaction,
  beforeBreadcrumb() {
    return null;
  },
});
