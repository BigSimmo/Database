import { describe, expect, it } from "vitest";
import { assertFileContentSignature, PublicApiError } from "../src/lib/http";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function bytes(...values: number[]) {
  return new Uint8Array(values);
}

const PDF_HEAD = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37); // "%PDF-1.7"
const ZIP_HEAD = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00); // "PK\x03\x04..."
const NOT_MATCHING = bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00); // "MZ.." (PE executable)

describe("assertFileContentSignature", () => {
  it("accepts a PDF whose bytes start with %PDF", () => {
    expect(() => assertFileContentSignature("application/pdf", PDF_HEAD)).not.toThrow();
  });

  it("rejects a PDF whose bytes are not a PDF", () => {
    expect(() => assertFileContentSignature("application/pdf", NOT_MATCHING)).toThrow(PublicApiError);
  });

  it("accepts OOXML (DOCX/XLSX) with a ZIP local-file-header signature", () => {
    expect(() => assertFileContentSignature(DOCX, ZIP_HEAD)).not.toThrow();
    expect(() => assertFileContentSignature(XLSX, ZIP_HEAD)).not.toThrow();
  });

  it("rejects DOCX/XLSX that are not ZIP archives", () => {
    expect(() => assertFileContentSignature(DOCX, PDF_HEAD)).toThrow(/does not match its declared type/);
    expect(() => assertFileContentSignature(XLSX, NOT_MATCHING)).toThrow(PublicApiError);
  });

  it("does not signature-check text/plain or unknown types", () => {
    expect(() => assertFileContentSignature("text/plain", NOT_MATCHING)).not.toThrow();
    expect(() => assertFileContentSignature("application/octet-stream", NOT_MATCHING)).not.toThrow();
  });
});
