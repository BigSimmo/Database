import * as Sentry from "@sentry/nextjs";

import {
  privacySafeErrorEvent,
  privacySafeTransactionEvent,
  resolveTracesSampleRate,
} from "@/lib/observability/error-tracking";
import { isSentryLoggingEnabled, privacySafeLog } from "@/lib/observability/sentry-logging";

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const sentryDsn = process.env.SENTRY_DSN?.trim();
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

try {
  Sentry.init({
    ...(sentryDsn ? { dsn: sentryDsn } : {}),
    release: sentryRelease,
    environment: sentryEnvironment,
    tracesSampleRate: resolveTracesSampleRate(),
    sendDefaultPii: false,
    dataCollection: {
      databaseQueryData: false,
      // Mirror the server runtime: AI inputs/outputs are never collected.
      genAI: { inputs: false, outputs: false },
    },
    // Same privacy-safe Logs gate as the Node server runtime (no console capture).
    enableLogs: isSentryLoggingEnabled(),
    maxBreadcrumbs: 0,
    beforeSend(event) {
      return privacySafeErrorEvent(event);
    },
    beforeSendTransaction(event) {
      // Local scrubber shape is structural; cast back to the SDK transaction type.
      return privacySafeTransactionEvent(event) as typeof event;
    },
    beforeSendLog(log) {
      return privacySafeLog(log as Parameters<typeof privacySafeLog>[0]) as typeof log | null;
    },
  });
} catch {
  // Optional observability must never take down the clinical edge runtime.
}
