import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details?: { code?: string; requestId?: string | null },
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

function publicErrorMessage(error: unknown, status: number) {
  if (error instanceof PublicApiError) return error.message;
  if (error instanceof ZodError) return "Invalid request.";
  if (status === 401) return "Authentication required.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Request failed.";
  return "Request could not be completed.";
}

function logSafeError(error: unknown, status: number) {
  if (process.env.NODE_ENV === "test") return;
  const name = error instanceof Error ? error.name : typeof error;
  const details = error instanceof PublicApiError ? error.details : undefined;
  console.error("API request failed", { status, name, code: details?.code, requestId: details?.requestId });
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
