/**
 * Upload size limits shared by the browser and the API route.
 *
 * This module is deliberately dependency-free so a client component can import
 * it: `src/lib/http.ts` (the authoritative check) pulls in `next/server`, and
 * `src/lib/env.ts` holds server-only secrets, so neither can cross into the
 * bundle.
 *
 * The server's effective limit is `env.MAX_UPLOAD_MB`, whose schema caps it at
 * `MAX_UPLOAD_MB_CEILING` — an operator can configure a *lower* limit, never a
 * higher one. The browser pre-check reads optional `NEXT_PUBLIC_MAX_UPLOAD_MB`
 * (clamped to the same ceiling) so the UI can match a lowered server limit;
 * when that public env is unset it falls back to the ceiling. The server
 * remains the authority for anything that still reaches `/api/upload`.
 */

/** Hard ceiling for a single uploaded file, in MB. */
export const MAX_UPLOAD_MB_CEILING = 150;

const BYTES_PER_MB = 1024 * 1024;

/**
 * Effective client-side upload limit in MB.
 * Reads `NEXT_PUBLIC_MAX_UPLOAD_MB` when set to a positive integer, clamps to
 * the ceiling, and otherwise uses the ceiling (safe default when operators
 * have not mirrored a lowered `MAX_UPLOAD_MB`).
 */
export function getClientMaxUploadMb(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB?.trim();
  if (!raw) return MAX_UPLOAD_MB_CEILING;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return MAX_UPLOAD_MB_CEILING;
  return Math.min(parsed, MAX_UPLOAD_MB_CEILING);
}

/**
 * True when a file exceeds the effective client pre-check limit.
 *
 * This is deliberately the only size predicate exported: with the public env
 * unset it falls back to the ceiling, so it subsumes the absolute
 * "larger than any limit the server can accept" check. Keeping a second,
 * ceiling-only predicate alongside it would let a call site silently bypass a
 * lowered operator limit.
 */
export function exceedsClientUploadSize(sizeInBytes: number): boolean {
  return sizeInBytes > getClientMaxUploadMb() * BYTES_PER_MB;
}

/**
 * The single wording for an over-limit file, so the pre-check reads exactly the
 * same as the server's 413 rather than inventing a second phrasing.
 */
export function uploadSizeLimitMessage(maxUploadMb: number): string {
  return `File exceeds ${maxUploadMb} MB upload limit.`;
}
