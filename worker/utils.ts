/**
 * Pure utility functions shared across worker stage modules.
 *
 * These helpers have no side-effects and do not touch Supabase or OpenAI.
 * They can be imported freely by any worker module without risk of circular
 * dependencies or unexpected I/O.
 */

import { createHash } from "node:crypto";
import { env } from "../src/lib/env";
import { safeErrorLogDetails } from "../src/lib/privacy";

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/** Strip null bytes and normalise surrogate pairs so Postgres accepts the value. */
export function cleanString(val: string): string {
  if (typeof val !== "string") return val;
  return val
    .replace(/\u0000/g, "")
    .replace(/\\u0000/g, "")
    .toWellFormed();
}

// ---------------------------------------------------------------------------
// JSONB helpers
// ---------------------------------------------------------------------------

export type JsonbValue = string | number | boolean | null | { [key: string]: JsonbValue } | JsonbValue[];
export type JsonbRecord = { [key: string]: JsonbValue };

/** Recursively clean a value so it is safe to store as JSONB in Postgres. */
export function sanitizeJsonb(val: unknown): JsonbValue {
  if (typeof val === "string") return cleanString(val);
  if (Array.isArray(val)) return val.map((entry) => sanitizeJsonb(entry));
  if (val !== null && typeof val === "object") {
    const raw = val as { [key: string]: unknown };
    const res: JsonbRecord = {};
    for (const [key, value] of Object.entries(raw)) {
      res[key] = sanitizeJsonb(value);
    }
    return res;
  }
  return val as JsonbValue;
}

/** Return a sanitised JSONB-safe record, falling back to `{}` for non-objects. */
export function sanitizeJsonbRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeJsonb(value);
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized) ? sanitized : {};
}

// ---------------------------------------------------------------------------
// Hash helpers
// ---------------------------------------------------------------------------

export function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashText(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

export function hashEmbeddingFieldContent(content: string) {
  return createHash("md5").update(content).digest("hex");
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Collapse whitespace and truncate to `limit` characters, preserving whole
 * words where possible.
 */
export function compactSearchText(value: unknown, limit = 900) {
  const compact = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  return compact.length > limit ? compact.slice(0, limit).trim() : compact;
}

// ---------------------------------------------------------------------------
// Worker-specific helpers
// ---------------------------------------------------------------------------

/** Increment the count for a skip reason in the shared skip-reason map. */
export function noteSkippedImage(skipReasons: Map<string, number>, reason: string) {
  skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
}

/**
 * Return `true` when the Supabase error indicates a missing RPC / schema
 * mismatch so the worker can decide whether to retry after a migration.
 */
export function isMissingSchemaError(error: { message?: string; code?: string }) {
  return /could not find the function|schema cache|PGRST20\d/i.test(error.message ?? "") || error.code === "PGRST202";
}

/** Calculate an exponential back-off delay for the polling loop. */
export function workerBackoffMs(failures: number) {
  return Math.min(env.WORKER_HEALTH_BACKOFF_MS, env.WORKER_POLL_MS * 2 ** Math.max(0, failures - 1));
}

/** Log a non-fatal write failure without propagating the error. */
export function optionalIndexWriteWarning(stage: string, error: unknown) {
  console.warn(`Optional ${stage} write failed`, safeErrorLogDetails(error));
}

/**
 * Create a structured Error from a Supabase response error, preserving the
 * Postgres error code, details and hint for upstream logging.
 */
export function supabaseStageError(
  stage: string,
  error: { message?: string; code?: string; details?: string; hint?: string },
) {
  const wrapped = new Error(`${stage}: ${error.message ?? "Supabase request failed"}`);
  Object.assign(wrapped, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return wrapped;
}
