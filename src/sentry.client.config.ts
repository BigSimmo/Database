import * as Sentry from "@sentry/nextjs";

import { privacySafeErrorEvent } from "@/lib/observability/error-tracking";

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim();
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

try {
  Sentry.init({
    ...(sentryDsn ? { dsn: sentryDsn } : {}),
    release: sentryRelease,
    environment: sentryEnvironment,
    // Browser telemetry stays off by default (docs/error-tracking.md). If a DSN is
    // ever present, still scrub free-form exception content before export.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    enableLogs: false,
    maxBreadcrumbs: 0,
    beforeSend(event) {
      return privacySafeErrorEvent(event);
    },
  });
} catch {
  // Optional client observability must never break the app shell.
}
