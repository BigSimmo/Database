// src/lib/caring-contacts/fingerprint.ts
//
// The idempotency fingerprint every store uses to tell a genuine replay from a key reused for a
// different write.
//
// Extracted so the in-memory and Postgres stores share one definition. Two copies would be two
// definitions of "the same request", and the day they drifted, one store would replay a write the
// other refused — which for this domain means one store sending a second caring contact.
//
// Stable and order-independent: object keys are sorted and undefined entries dropped, so a caller
// that builds the same request twice fingerprints it identically both times.

export function fingerprintOf(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return `D:${value.getTime()}`;
  if (Array.isArray(value)) return `[${value.map(fingerprintOf).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${key}:${fingerprintOf(entry)}`).join(",")}}`;
  }
  return `${typeof value}:${String(value)}`;
}
