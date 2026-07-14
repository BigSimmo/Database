// SSE liveness for long-running answer streams. Generation legitimately goes
// silent for stretches (e.g. strong-route reasoning and deterministic quality
// gates, bounded by OPENAI_ANSWER_TIMEOUT_MS). A periodic comment line keeps
// intermediaries from idling out the connection and gives the client's stall
// watchdog a byte-level liveness signal. Comment lines (leading ":") are
// ignored by SSE parsers, so clients need no changes to tolerate them.

export const answerStreamHeartbeatIntervalMs = 15_000;

// A bare SSE comment line followed by a blank line — a complete, ignorable frame.
export const sseHeartbeatFrame = ": heartbeat\n\n";

/**
 * Start emitting heartbeat frames via `enqueue` every `intervalMs`. Returns a
 * stop function. If `enqueue` throws (stream closed or cancelled by the
 * client), the heartbeat stops itself.
 */
export function startSseHeartbeat(enqueue: (frame: string) => void, intervalMs = answerStreamHeartbeatIntervalMs) {
  const timer = setInterval(() => {
    try {
      enqueue(sseHeartbeatFrame);
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);
  // Node's setInterval keeps the event loop alive; unref where available so a
  // stray stream cannot pin the process. No-op in edge/browser runtimes.
  (timer as unknown as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
}
