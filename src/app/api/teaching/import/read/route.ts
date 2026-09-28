import { PublicApiError } from "@/lib/http";
import { withTeachingApi } from "@/lib/teaching/api";
import { IMPORT_MAX_FILE_BYTES } from "@/lib/teaching/depth-model";
import {
  IMPORT_TOO_LARGE_MESSAGE,
  IMPORT_UNREADABLE_MESSAGE,
  readXlsxRows,
  type SheetRow,
} from "@/lib/teaching/import-sheet-reader";

export const runtime = "nodejs";

/*
 * Reads a chosen term-import .xlsx into rows, on the server and in memory only, so exceljs never
 * ships to the browser. Nothing is stored or logged: the rows go straight back to the caller, who
 * previews them through the depth route as before. Stateless, so demo mode reads too (Import's
 * demo preview), while a signed-in read spends from the Teaching rate limit.
 */
// A little slack over the file limit for multipart boundary and header overhead.
const MAX_CONTENT_LENGTH = IMPORT_MAX_FILE_BYTES + 64 * 1024;

async function readRows(request: Request): Promise<{ rows: SheetRow[] }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CONTENT_LENGTH) {
    throw new PublicApiError(IMPORT_TOO_LARGE_MESSAGE, 413, { code: "payload_too_large" });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    throw new PublicApiError("Choose a CSV or XLSX file.", 400, { code: "invalid_form_data" });
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new PublicApiError(IMPORT_TOO_LARGE_MESSAGE, 413, { code: "payload_too_large" });
  }
  try {
    return { rows: await readXlsxRows(new Uint8Array(await file.arrayBuffer())) };
  } catch (error) {
    const message =
      error instanceof Error && error.message === IMPORT_TOO_LARGE_MESSAGE ? error.message : IMPORT_UNREADABLE_MESSAGE;
    throw new PublicApiError(message, message === IMPORT_TOO_LARGE_MESSAGE ? 413 : 400, {
      code: message === IMPORT_TOO_LARGE_MESSAGE ? "payload_too_large" : "unreadable_file",
    });
  }
}

export async function POST(request: Request) {
  return withTeachingApi(request, () => readRows(request), { demo: () => readRows(request) });
}
