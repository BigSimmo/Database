import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import { afterEach, describe, expect, it } from "vitest";
import { extractPdf } from "@/lib/extractors/document";
import { isPdfUnreadableError, PdfUnreadableError } from "@/lib/extractors/pdf-extraction-budget";
import { isRetryableIngestionError } from "@/lib/ingestion";
import { ingestionFailureDecision } from "../worker/behavior";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// A readable text PDF, so that if the JavaScript fallback were entered it would
// succeed and index text — the refusal must win before that can happen.
async function createTextPdf() {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument();
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.text("Text the fallback reader would happily index.");
    document.end();
  });
}

async function unreadableExtractor(reason: string) {
  const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-unreadable-test-"));
  roots.push(root);
  const script = path.join(root, "unreadable-extractor.py");
  const record = path.join(root, "temporary-root.txt");
  await writeFile(
    script,
    [
      "import pathlib, sys",
      `pathlib.Path(${JSON.stringify(record)}).write_text(str(pathlib.Path(sys.argv[2]).parent), encoding='utf-8')`,
      `print(${JSON.stringify(`PDF_UNREADABLE: ${reason}`)}, file=sys.stderr)`,
      "raise SystemExit(4)",
    ].join("\n"),
    "utf8",
  );
  return { script, record };
}

describe("unreadable PDF refusal", () => {
  it.each([
    "PDF is password-protected. Upload an unlocked copy.",
    "PDF could not be opened: it has no pages.",
    "PDF could not be opened (it may be damaged, truncated or not a PDF): cannot open broken document",
  ])("refuses with the plain reason and never falls back: %s", async (reason) => {
    const { script, record } = await unreadableExtractor(reason);
    const error = await extractPdf(await createTextPdf(), { scriptPathOverride: script }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect(isPdfUnreadableError(error)).toBe(true);
    expect((error as Error).message).toBe(`PDF_UNREADABLE: ${reason}`);
    expect(isRetryableIngestionError(error)).toBe(false);
    expect(existsSync(await readFile(record, "utf8"))).toBe(false);
  });

  it("is never retried even when the reason mentions a timeout", () => {
    const error = new Error(
      "PDF_UNREADABLE: PDF could not be opened (it may be damaged, truncated or not a PDF): timeout",
    );
    expect(isPdfUnreadableError(error)).toBe(true);
    expect(isRetryableIngestionError(error)).toBe(false);
  });

  it("fails the upload on the first attempt and stores the plain reason", () => {
    const decision = ingestionFailureDecision({
      error: new PdfUnreadableError("PDF is password-protected. Upload an unlocked copy."),
      attemptCount: 1,
      maxAttempts: 5,
      atomicReindex: false,
    });
    expect(decision).toEqual({
      retry: false,
      documentStatus: "failed",
      stage: "failed",
      errorMessage: "PDF_UNREADABLE: PDF is password-protected. Upload an unlocked copy.",
    });
  });
});
