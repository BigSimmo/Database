import * as Sentry from "@sentry/nextjs";

import { privacySafeErrorEvent } from "@/lib/observability/error-tracking";

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const sentryDsn = process.env.SENTRY_DSN?.trim();
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

const ignoredServerErrors = [
  /404/,
  /Not Found/i,
  /Cannot find module/i,
  /Request failed with status code 404/i,
  "NotFoundError: Not Found",
  /^SyntaxError: Unexpected token </,
  "NotFoundError",
  "NotFound",
  "BotAccessDenied",
  "RateLimitedError",
];

function isBotTrafficEvent(event: Sentry.Event): boolean {
  const userAgentHeader = event.request?.headers?.["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : (userAgentHeader as string | undefined);
  if (!userAgent) return false;
  return /bot|spider|crawler|curl|python|monitoring|uptimerobot|semrush|ahrefs|pingdom|headless|googlebot|bingbot|duckduckgo|petalbot/i.test(
    userAgent,
  );
}

try {
  Sentry.init({
    ...(sentryDsn ? { dsn: sentryDsn } : {}),
    release: sentryRelease,
    environment: sentryEnvironment,
    // Privacy posture: no traces, logs, breadcrumbs, locals, or PII (docs/error-tracking.md).
    tracesSampleRate: 0,
    sendDefaultPii: false,
    includeLocalVariables: false,
    enableLogs: false,
    attachStacktrace: true,
    maxBreadcrumbs: 0,
    ignoreErrors: ignoredServerErrors,
    beforeSend(event) {
      if (isBotTrafficEvent(event)) return null;
      return privacySafeErrorEvent(event);
    },
  });
} catch {
  // Optional observability must never take down the clinical server.
}
