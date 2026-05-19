import { NextResponse } from "next/server";

export function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status });
}

export function assertAllowedFile(file: File, maxUploadMb: number) {
  const allowed = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]);

  if (!allowed.has(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}. Use PDF, DOCX, XLSX, or TXT.`,
    );
  }

  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${maxUploadMb} MB upload limit.`);
  }
}
