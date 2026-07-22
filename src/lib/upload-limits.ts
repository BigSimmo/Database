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
 * higher one. A browser-side pre-check at the ceiling therefore only ever
 * rejects a file the server was certain to reject too; anything under it is
 * still sent, and the server remains the authority.
 */

/** Hard ceiling for a single uploaded file, in MB. */
export const MAX_UPLOAD_MB_CEILING = 150;

const BYTES_PER_MB = 1024 * 1024;

/** True when a file is larger than any limit the server can be configured to accept. */
export function exceedsUploadSizeCeiling(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_UPLOAD_MB_CEILING * BYTES_PER_MB;
}

/**
 * The single wording for an over-limit file, so the pre-check reads exactly the
 * same as the server's 413 rather than inventing a second phrasing.
 */
export function uploadSizeLimitMessage(maxUploadMb: number): string {
  return `File exceeds ${maxUploadMb} MB upload limit.`;
}
