// Client-side Sentry access indirection. Error boundaries call
// captureClientException() without ever statically importing @sentry/nextjs, so
// a build WITHOUT NEXT_PUBLIC_SENTRY_DSN ships zero Sentry code: instrumentation-
// client.ts only loads the SDK (and registers it here) when a DSN is present at
// build time. Until then every call here is a no-op.
type SentryClientModule = {
  captureException: (error: unknown) => string;
};

let client: SentryClientModule | null = null;

export function registerSentryClient(mod: SentryClientModule): void {
  client = mod;
}

export function captureClientException(error: unknown): void {
  client?.captureException(error);
}
