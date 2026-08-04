import "server-only";

import * as Sentry from "@sentry/nextjs";

import { isSentryDbTracingEnabled } from "@/lib/observability/error-tracking";

/**
 * Node-only Supabase client instrumentation for privacy-safe DB spans.
 * Kept out of `error-tracking.ts` so Edge instrumentation can import scrubbers
 * without pulling Node core modules or the Node Sentry entry.
 */
export function instrumentSupabaseClientForTracing(supabaseClient: unknown): void {
  if (!isSentryDbTracingEnabled() || !supabaseClient) {
    return;
  }

  try {
    Sentry.instrumentSupabaseClient(supabaseClient, { sendOperationData: false });
  } catch {
    // Optional observability must never take down Supabase access.
  }
}
