type ClientCapture = {
  captureException: (error: unknown) => unknown;
};

let client: ClientCapture | null = null;

/** Register the browser SDK after a successful gated init. Pass null to clear. */
export function registerSentryClient(next: ClientCapture | null | undefined) {
  client = next ?? null;
}

/**
 * Capture a client-side exception. No-op until the browser SDK is initialized
 * (NEXT_PUBLIC_SENTRY_DSN set at build). Never throws.
 */
export function captureClientException(error: unknown) {
  try {
    client?.captureException(error);
  } catch {
    // Capture is best-effort; a boundary must still render its recovery UI.
  }
}
