import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
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
  console.error("API request failed", { status, name });
}

export function jsonError(error: unknown, status = 500) {
  logSafeError(error, status);
  return NextResponse.json({ error: publicErrorMessage(error, status) }, { status });
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
