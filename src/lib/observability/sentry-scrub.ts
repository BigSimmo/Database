/**
 * Clinical privacy scrubber for Sentry events.
 *
 * Queries, document content, page URLs (often carrying `q`/`query`), headers,
 * breadcrumbs, and user identity must never leave the box. Over-deletion only
 * loses debugging detail; under-deletion leaks patient data.
 *
 * Uses a structural type so the same helper works for client ErrorEvent and
 * server/edge Event without importing SDK entrypoints that pull node-only code
 * into the browser bundle.
 */
export type ScrubbableSentryEvent = {
  request?: unknown;
  breadcrumbs?: unknown;
  user?: unknown;
  transaction?: string;
};

export function scrubSentryEvent<T extends ScrubbableSentryEvent>(event: T): T {
  delete event.request;
  delete event.breadcrumbs;
  delete event.user;
  if (event.transaction?.includes("?")) {
    event.transaction = event.transaction.split("?")[0];
  }
  return event;
}

/** Client beforeSend alias. */
export function scrubClientSentryEvent<T extends ScrubbableSentryEvent>(event: T): T {
  return scrubSentryEvent(event);
}

/** Server/edge beforeSendTransaction — drop request payloads and query strings. */
export function scrubSentryTransaction<T extends ScrubbableSentryEvent>(event: T): T | null {
  return scrubSentryEvent(event);
}
