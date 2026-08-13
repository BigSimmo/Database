/**
 * Provider-safe detail token for collapsed generation errors.
 *
 * Routing preserves the broad, stable `generation_quality_failed` category. This helper
 * retains only the underlying deterministic gate or incomplete-generation token for
 * telemetry, never raw provider or answer text.
 */
export function generationFailureDetailToken(error: unknown) {
  const message = (error instanceof Error ? error.message : typeof error === "string" ? error : "").toLowerCase();
  const gate = message.match(/quality gate failed: ([a-z0-9_]+)/);
  if (gate) return gate[1];
  const incomplete = message.match(/generation incomplete: ([a-z0-9_]+)/);
  if (incomplete) return incomplete[1];
  return null;
}
