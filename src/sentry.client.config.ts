import * as Sentry from "@sentry/nextjs";

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const tracesSampleRate = Number(process.env.NODE_ENV === "production" ? 0.2 : 1.0);
const replaysSessionSampleRate = 0.05;
const replaysOnErrorSampleRate = 1.0;

function coerceSampleRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

Sentry.init({
  ...(sentryDsn ? { dsn: sentryDsn } : {}),
  release: sentryRelease,
  environment: sentryEnvironment,
  tracesSampleRate: coerceSampleRate(tracesSampleRate),
  sendDefaultPii: false,
  replaysSessionSampleRate: coerceSampleRate(replaysSessionSampleRate),
  replaysOnErrorSampleRate: coerceSampleRate(replaysOnErrorSampleRate),
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
  // Keep request/response bodies out unless explicitly needed for investigations.
  // dataCollection: { httpBodies: [] },
});
