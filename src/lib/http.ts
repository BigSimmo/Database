import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details?: {
      code?: string;
      requestId?: string | null;
      causeName?: string | null;
      causeMessage?: string | null;
      sqlState?: string | null;
    },
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

// Cache headers for seeded, rarely-changing catalog content (registry records,
// medications, differentials). `private` keeps owner-scoped payloads out of
// shared caches; `Vary: Authorization` keys entries per user within one browser
// profile (requests carry a bearer header); stale-while-revalidate lets repeat
// navigations render the last copy while the browser refreshes it. Apply to
// 200 responses only — errors and 404s must never be cached.
export const seededContentCacheHeaders = {
  "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
  Vary: "Authorization",
} as const;

function publicErrorMessage(error: unknown, status: number) {
  if (error instanceof PublicApiError) return error.message;
  if (error instanceof ZodError) return "Invalid request.";
  if (status === 401) return "Authentication required.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Request failed.";
  return "Request could not be completed.";
}

function logSafeError(error: unknown, status: number) {
  const details = error instanceof PublicApiError ? error.details : undefined;
  logger.error("API request failed", {
    status,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: details?.code,
    requestId: details?.requestId,
    causeName: details?.causeName,
    causeMessage: details?.causeMessage,
    sqlState: details?.sqlState,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function jsonError(error: unknown, status = 500) {
  const responseStatus = error instanceof PublicApiError ? error.status : status;
  logSafeError(error, responseStatus);
  return NextResponse.json({ error: publicErrorMessage(error, responseStatus) }, { status: responseStatus });
}

export function assertAllowedFile(file: File, maxUploadMb: number) {
  const allowed = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]);

  if (!allowed.has(file.type)) {
    throw new PublicApiError(`Unsupported file type: ${file.type || "unknown"}. Use PDF, DOCX, XLSX, or TXT.`);
  }

  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new PublicApiError(`File exceeds ${maxUploadMb} MB upload limit.`);
  }
}

// OOXML documents (DOCX/XLSX) are ZIP archives; a local-file-header begins "PK\x03\x04",
// and the empty/spanned variants begin "PK\x05\x06" / "PK\x07\x08".
function hasZipSignature(head: Uint8Array) {
  return (
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) &&
    (head[3] === 0x04 || head[3] === 0x06 || head[3] === 0x08)
  );
}

const fileContentSignatures: Record<string, (head: Uint8Array) => boolean> = {
  // PDFs start with "%PDF-".
  "application/pdf": (head) => head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": hasZipSignature,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": hasZipSignature,
  // text/plain has no reliable magic number and is intentionally not signature-checked.
};

// The browser-supplied MIME type (file.type) is trivially spoofable, so for the binary
// formats we accept we also verify the actual byte signature before persisting the file.
// This rejects polyglot/mislabeled uploads (e.g. an executable renamed to .pdf) at the
// ingestion boundary of a clinical document store.
export function assertFileContentSignature(fileType: string, content: Uint8Array) {
  const check = fileContentSignatures[fileType];
  if (!check) return;
  if (!check(content.subarray(0, 8))) {
    throw new PublicApiError(
      `File content does not match its declared type (${fileType}). The file may be corrupt or mislabeled.`,
    );
  }
}
