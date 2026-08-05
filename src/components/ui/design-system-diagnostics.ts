type DiagnosticEmitter = (message: string) => void;

const DEFAULT_CAPACITY = 100;

/**
 * Deduplicates noisy resilience diagnostics without retaining attacker- or
 * data-controlled keys forever. Once full, the oldest key is evicted.
 */
export function createBoundedDiagnosticRecorder({
  capacity = DEFAULT_CAPACITY,
  emit = (message) => console.warn(message),
}: {
  capacity?: number;
  emit?: DiagnosticEmitter;
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Design-system diagnostic capacity must be a positive integer.");
  }
  const recentKeys = new Map<string, true>();

  return (key: string, message: string) => {
    if (recentKeys.has(key)) return;
    if (recentKeys.size >= capacity) {
      const oldest = recentKeys.keys().next().value;
      if (typeof oldest === "string") recentKeys.delete(oldest);
    }
    recentKeys.set(key, true);
    emit(message);
  };
}
