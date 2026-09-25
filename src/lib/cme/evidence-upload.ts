import "server-only";
import sharp from "sharp";
import { PublicApiError, assertFileContentSignature } from "@/lib/http";
import { CME_EVIDENCE_MAX_BYTES } from "@/lib/cme/evidence-model";

/** Bound the actual stream, including chunked requests, before parsing multipart. */
export async function readCmeEvidenceForm(request: Request): Promise<FormData> {
  const limit = CME_EVIDENCE_MAX_BYTES + 64 * 1024;
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) {
    throw new PublicApiError("Evidence upload exceeds the 10 MB limit.", 413);
  }
  if (!request.body) throw new PublicApiError("Choose an evidence file.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new PublicApiError("Evidence upload exceeds the 10 MB limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new PublicApiError("Invalid evidence upload. Choose the file again.", 400);
  }
}

/** Admission only: no OCR, text extraction, indexing, or AI processing. */
export async function validateCmeEvidenceFile(file: File): Promise<Buffer> {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    throw new PublicApiError("Choose a PDF, JPEG or PNG file.", 400);
  }
  if (!file.size || file.size > CME_EVIDENCE_MAX_BYTES) {
    throw new PublicApiError("Choose a non-empty file no larger than 10 MB.", 413);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    assertFileContentSignature(file.type, bytes);
    if (
      !bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-") ||
      !bytes
        .subarray(Math.max(0, bytes.length - 8192))
        .toString("latin1")
        .trimEnd()
        .endsWith("%%EOF")
    ) {
      throw new PublicApiError("This PDF appears incomplete or mislabeled.", 400);
    }
  } else {
    const signature =
      file.type === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!signature) throw new PublicApiError("The file does not match its image type.", 400);
    try {
      const metadata = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" }).metadata();
      if (metadata.format !== (file.type === "image/png" ? "png" : "jpeg") || !metadata.width || !metadata.height)
        throw new Error();
    } catch {
      throw new PublicApiError("This image could not be read, or is too large to preview safely.", 400);
    }
  }
  return bytes;
}
