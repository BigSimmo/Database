import * as Sentry from "@sentry/nextjs";

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const sentryDsn = process.env.SENTRY_DSN;
const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const tracesSampleRate = Number(process.env.NODE_ENV === "production" ? 0.2 : 1.0);

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

function coerceSampleRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isBotTrafficEvent(event: Sentry.Event): boolean {
  const userAgentHeader = event.request?.headers?.["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : (userAgentHeader as string | undefined);
  if (!userAgent) return false;
  return /bot|spider|crawler|curl|python|monitoring|uptimerobot|semrush|ahrefs|pingdom|headless|googlebot|bingbot|duckduckgo|petalbot/i.test(
    userAgent,
  );
}

Sentry.init({
  ...(sentryDsn ? { dsn: sentryDsn } : {}),
  release: sentryRelease,
  environment: sentryEnvironment,
  tracesSampleRate: coerceSampleRate(tracesSampleRate),
  sendDefaultPii: false,
  includeLocalVariables: true,
  enableLogs: true,
  ignoreErrors: ignoredServerErrors,
  beforeSend(event) {
    if (isBotTrafficEvent(event)) return null;
    return event;
  },
});
