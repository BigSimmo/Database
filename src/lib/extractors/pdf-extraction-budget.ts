import { stat } from "node:fs/promises";
import type { ExtractedDocument } from "@/lib/types";

export const PDF_EXTRACTION_BUDGET = {
  version: 1,
  maxRenderPixels: 4_000_000,
  maxPages: 5_000,
  maxArtifacts: 10_000,
  maxArtifactBytes: 512 * 1024 * 1024,
  maxTextBytes: 64 * 1024 * 1024,
  maxResultBytes: 64 * 1024 * 1024,
  ocrPageTimeoutSeconds: 60,
  totalTimeoutMs: 15 * 60 * 1_000,
} as const;

export type PdfExtractionBudget = {
  version: number;
  maxRenderPixels: number;
  maxPages: number;
  maxArtifacts: number;
  maxArtifactBytes: number;
  maxTextBytes: number;
  maxResultBytes: number;
  ocrPageTimeoutSeconds: number;
  totalTimeoutMs: number;
};

export const PDF_EXTRACTION_RESOURCE_ERROR_CODES = [
  "PDF_EXTRACTION_BUDGET_EXCEEDED",
  "PDF_EXTRACTION_DEADLINE_EXCEEDED",
] as const;

export type PdfExtractionResourceErrorCode = (typeof PDF_EXTRACTION_RESOURCE_ERROR_CODES)[number];

export class PdfExtractionResourceError extends Error {
  readonly code: PdfExtractionResourceErrorCode;

  constructor(code: PdfExtractionResourceErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "PdfExtractionResourceError";
    this.code = code;
  }
}

export function isPdfExtractionResourceError(error: unknown): error is PdfExtractionResourceError {
  if (error instanceof PdfExtractionResourceError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return PDF_EXTRACTION_RESOURCE_ERROR_CODES.some((code) => message.includes(code));
}

function budgetExceeded(message: string): never {
  throw new PdfExtractionResourceError("PDF_EXTRACTION_BUDGET_EXCEEDED", message);
}

export class PdfExtractionBudgetTracker {
  private pageCount = 0;
  private artifactCount = 0;
  private artifactBytes = 0;
  private textBytes = 0;

  constructor(readonly limits: PdfExtractionBudget = PDF_EXTRACTION_BUDGET) {}

  addPage(text: string) {
    this.pageCount += 1;
    if (this.pageCount > this.limits.maxPages) {
      budgetExceeded(`page count ${this.pageCount} exceeds ${this.limits.maxPages}`);
    }
    this.textBytes += Buffer.byteLength(text, "utf8");
    if (this.textBytes > this.limits.maxTextBytes) {
      budgetExceeded(`extracted UTF-8 text exceeds ${this.limits.maxTextBytes} bytes`);
    }
  }

  addArtifact(byteLength: number) {
    this.assertArtifact(byteLength);
    this.artifactCount += 1;
    this.artifactBytes += Math.max(0, byteLength);
  }

  assertArtifact(byteLength: number) {
    const nextArtifactCount = this.artifactCount + 1;
    if (nextArtifactCount > this.limits.maxArtifacts) {
      budgetExceeded(`artifact count ${nextArtifactCount} exceeds ${this.limits.maxArtifacts}`);
    }
    const nextArtifactBytes = this.artifactBytes + Math.max(0, byteLength);
    if (nextArtifactBytes > this.limits.maxArtifactBytes) {
      budgetExceeded(`temporary artifact bytes exceed ${this.limits.maxArtifactBytes}`);
    }
  }

  assertRenderDimensions(width: number, height: number) {
    const pixels = Math.max(0, width) * Math.max(0, height);
    if (!Number.isSafeInteger(pixels) || pixels > this.limits.maxRenderPixels) {
      budgetExceeded(`rendered image pixels ${pixels} exceed ${this.limits.maxRenderPixels}`);
    }
  }

  assertResult(raw: string | Buffer) {
    const byteLength = typeof raw === "string" ? Buffer.byteLength(raw, "utf8") : raw.byteLength;
    if (byteLength > this.limits.maxResultBytes) {
      budgetExceeded(`result JSON exceeds ${this.limits.maxResultBytes} bytes`);
    }
  }
}

export async function assertExtractedPdfBudget(
  extracted: ExtractedDocument,
  rawResult: string,
  limits: PdfExtractionBudget = PDF_EXTRACTION_BUDGET,
) {
  const tracker = new PdfExtractionBudgetTracker(limits);
  tracker.assertResult(rawResult);
  for (const page of extracted.pages) tracker.addPage(page.text);
  for (const image of extracted.images) {
    const metadata = await stat(image.path).catch(() => null);
    if (!metadata?.isFile()) budgetExceeded(`artifact is missing: ${image.path}`);
    tracker.addArtifact(metadata.size);
  }
}
