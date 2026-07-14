import type { ErrorEvent } from "@sentry/browser";

// Client-side Sentry event scrubber. Mirrors the server-side privacy boundary in
// src/instrumentation.ts (beforeSend): in this clinical app, queries, document
// content, page URLs and headers must never leave the browser.
//
// The browser SDK populates `event.request.url` with the full current URL (which
// can carry `q`/`query` search params on clinical flows) and records breadcrumbs
// from console/fetch/navigation that can echo the same text. Both are dropped
// wholesale rather than field-by-field — over-deletion only loses debugging
// detail, under-deletion leaks patient data. `event.user` is dropped too so no
// IP/email/id is attached. Events then carry only the error itself.
export function scrubClientSentryEvent(event: ErrorEvent): ErrorEvent {
  delete event.request;
  delete event.breadcrumbs;
  delete event.user;
  return event;
}
